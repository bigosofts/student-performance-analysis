const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");
const { Agent } = require("undici");
const unzipper = require("unzipper");

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const MIME_FOLDER = "application/vnd.google-apps.folder";
const APP_TAG = "teacher-central-uploads-v1";
const KEEP_BACKUPS = 5;

module.exports = function registerBackupRoutes(
  app,
  { uploadsDir, projectDir, afterRestore },
) {
  const privateDir = path.join(projectDir, ".backup-data");
  const tempDir = path.join(privateDir, "temp");
  const tokenPath = path.join(privateDir, "google-drive-token.json");
  const configPath = path.join(privateDir, "google-drive-config.json");
  const jobs = new Map();
  const oauthStates = new Map();
  let activeOperationId = null;
  fs.mkdirSync(tempDir, { recursive: true, mode: 0o700 });

  // A process can be killed before its finally block runs. Remove only this
  // module's archive files whose owning process is no longer running.
  const cleanupOrphanedArchives = () => {
    for (const name of fs.readdirSync(tempDir)) {
      const match = name.match(
        /^teacher-(?:backup|restore)-(\d+)-([0-9a-f-]+)\.zip$/i,
      );
      if (!match) continue;
      const ownerPid = Number(match[1]);
      let ownerAlive;
      if (ownerPid === process.pid) ownerAlive = jobs.has(match[2]);
      else {
        try {
          process.kill(ownerPid, 0);
          ownerAlive = true;
        } catch (error) {
          ownerAlive = error.code === "EPERM";
        }
      }
      if (!ownerAlive)
        fs.promises
          .unlink(path.join(tempDir, name))
          .catch((error) =>
            console.warn(
              "Could not remove orphaned backup archive:",
              error.message,
            ),
          );
    }
    const entries = fs.readdirSync(projectDir);
    const restores = new Map();
    const previous = new Map();
    for (const name of entries) {
      let match = name.match(/^\.uploads-restore-(\d+)-([0-9a-f-]+)$/i);
      if (match)
        restores.set(`${match[1]}-${match[2]}`, {
          pid: Number(match[1]),
          jobId: match[2],
          path: path.join(projectDir, name),
        });
      match = name.match(/^\.uploads-previous-(\d+)-([0-9a-f-]+)$/i);
      if (match)
        previous.set(`${match[1]}-${match[2]}`, {
          pid: Number(match[1]),
          jobId: match[2],
          path: path.join(projectDir, name),
        });
      // Clean extraction folders created by the first version of this module.
      if (/^\.uploads-restore-[0-9a-f-]+$/i.test(name))
        fs.promises
          .rm(path.join(projectDir, name), { recursive: true, force: true })
          .catch(() => {});
    }
    const isAlive = (pid, jobId) => {
      if (pid === process.pid) return jobs.has(jobId);
      try {
        process.kill(pid, 0);
        return true;
      } catch (error) {
        return error.code === "EPERM";
      }
    };
    for (const [key, old] of previous) {
      if (isAlive(old.pid, old.jobId)) continue;
      const stage = restores.get(key);
      const stagedUploads = stage && path.join(stage.path, "uploads");
      let shouldRestorePrevious =
        !fs.existsSync(uploadsDir) &&
        stagedUploads &&
        fs.existsSync(stagedUploads);
      if (
        !shouldRestorePrevious &&
        stagedUploads &&
        fs.existsSync(stagedUploads) &&
        fs.existsSync(uploadsDir)
      ) {
        try {
          shouldRestorePrevious =
            fs.statSync(uploadsDir).isDirectory() &&
            fs.readdirSync(uploadsDir).length === 0;
        } catch (_) {
          shouldRestorePrevious = false;
        }
      }
      if (shouldRestorePrevious) {
        try {
          fs.rmSync(uploadsDir, { recursive: true, force: true });
          fs.renameSync(old.path, uploadsDir);
        } catch (error) {
          console.error(
            "Could not recover uploads after an interrupted restore:",
            error.message,
          );
        }
      } else {
        try {
          fs.rmSync(old.path, { recursive: true, force: true });
        } catch (error) {
          console.warn(
            "Could not remove orphaned previous uploads:",
            error.message,
          );
        }
      }
    }
    for (const stage of restores.values()) {
      if (!isAlive(stage.pid, stage.jobId)) {
        try {
          fs.rmSync(stage.path, { recursive: true, force: true });
        } catch (error) {
          console.warn(
            "Could not remove orphaned restore files:",
            error.message,
          );
        }
      }
    }
  };
  cleanupOrphanedArchives();
  const orphanCleanupTimer = setInterval(
    cleanupOrphanedArchives,
    60 * 60 * 1000,
  );
  orphanCleanupTimer.unref();
  const temporaryArchive = (kind, jobId) =>
    path.join(tempDir, `teacher-${kind}-${process.pid}-${jobId}.zip`);

  const readJson = (file, fallback) => {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (_) {
      return fallback;
    }
  };
  const writePrivateJson = (file, value) => {
    fs.mkdirSync(privateDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(file, JSON.stringify(value, null, 2), { mode: 0o600 });
  };
  const credentials = () => ({
    clientId: process.env.OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
    clientSecret:
      process.env.OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
  });
  const origin = (req) => {
    const proto = String(req.get("x-forwarded-proto") || req.protocol)
      .split(",")[0]
      .trim();
    const host = String(req.get("x-forwarded-host") || req.get("host") || "")
      .split(",")[0]
      .trim();
    return `${proto}://${host}`;
  };
  const redirectUri = (req) =>
    process.env.GOOGLE_REDIRECT_URI || `${origin(req)}/v1/auth/google/callback`;
  const sourceName = (req) => {
    const configured = process.env.BACKUP_SOURCE;
    if (configured) return configured;
    const hostname = String(
      req.get("x-forwarded-host") || req.get("host") || "unknown",
    )
      .split(",")[0]
      .split(":")[0];
    return /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(hostname)
      ? `localhost (${hostname})`
      : `live (${hostname})`;
  };
  const sendError = (res, error) =>
    res
      .status(error.status || 500)
      .json({ error: error.message || "Backup service failed." });
  const getToken = () => readJson(tokenPath, null);
  const getConfig = () => readJson(configPath, {});
  const fetchAccessToken = async () => {
    const { clientId, clientSecret } = credentials();
    const token = getToken();
    if (!clientId || !clientSecret)
      throw Object.assign(
        new Error(
          "Set OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET on this server.",
        ),
        { status: 503 },
      );
    if (!token || !token.refresh_token)
      throw Object.assign(
        new Error("Connect this server to Google Drive first."),
        { status: 401 },
      );
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: token.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const body = await response.json();
    if (!response.ok)
      throw Object.assign(
        new Error(
          body.error_description ||
            body.error ||
            "Google Drive authorization expired.",
        ),
        { status: 401 },
      );
    return body.access_token;
  };
  const driveRequest = async (url, options = {}) => {
    const accessToken = options.accessToken || (await fetchAccessToken());
    const headers = {
      ...(options.headers || {}),
      authorization: `Bearer ${accessToken}`,
    };
    const response = await fetch(url, {
      ...options,
      headers,
      ...(options.signal ? { signal: options.signal } : {}),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const error = new Error(
        body.error?.message ||
          body.error_description ||
          `Google Drive request failed (${response.status}).`,
      );
      error.status = response.status === 401 ? 401 : 502;
      error.driveStatus = response.status;
      throw error;
    }
    return response;
  };
  const ensureDriveFolder = async () => {
    const config = getConfig();
    if (process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID)
      return process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID;
    if (config.folderId) return config.folderId;
    const query = encodeURIComponent(
      `mimeType='${MIME_FOLDER}' and name='Backup Resources' and trashed=false`,
    );
    const found = await driveRequest(
      `${DRIVE_API}/files?q=${query}&fields=files(id,name)&pageSize=100`,
    );
    const matches = (await found.json()).files || [];
    let folderId = matches[0]?.id;
    if (!folderId) {
      const created = await driveRequest(`${DRIVE_API}/files?fields=id,name`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Backup Resources",
          mimeType: MIME_FOLDER,
          appProperties: { backupModule: APP_TAG },
        }),
      });
      folderId = (await created.json()).id;
    }
    writePrivateJson(configPath, { ...config, folderId });
    return folderId;
  };
  const listDriveBackups = async (folderId) => {
    const query = encodeURIComponent(
      `'${folderId}' in parents and trashed=false and mimeType='application/zip'`,
    );
    const response = await driveRequest(
      `${DRIVE_API}/files?q=${query}&fields=files(id,name,size,createdTime,appProperties)&orderBy=createdTime desc&pageSize=100`,
    );
    return ((await response.json()).files || []).filter(
      (file) => file.appProperties?.backupModule === APP_TAG,
    );
  };
  const updateJob = (job, patch) =>
    Object.assign(job, patch, { updatedAt: Date.now() });
  const startJob = (type) => {
    const id = crypto.randomUUID();
    const job = {
      id,
      type,
      status: "running",
      phase: "Preparing",
      progress: 0,
      bytes: 0,
      totalBytes: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    jobs.set(id, job);
    return job;
  };
  const safeName = (value) =>
    String(value)
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "server";

  app.get("/api/backups/status", async (req, res) => {
    const { clientId, clientSecret } = credentials();
    const token = getToken();
    res.json({
      configured: Boolean(clientId && clientSecret),
      connected: Boolean(token?.refresh_token),
      redirectUri: redirectUri(req),
      source: sourceName(req),
      retention: KEEP_BACKUPS,
    });
  });

  app.get("/api/backups/oauth/start", (req, res) => {
    const { clientId, clientSecret } = credentials();
    if (!clientId || !clientSecret)
      return res.status(503).json({
        error: "Set OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET on this server.",
      });
    const state = crypto.randomBytes(32).toString("hex");
    oauthStates.set(state, {
      redirectUri: redirectUri(req),
      expires: Date.now() + 10 * 60 * 1000,
    });
    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri(req),
      response_type: "code",
      scope: "https://www.googleapis.com/auth/drive",
      access_type: "offline",
      prompt: "consent",
      state,
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${query}`);
  });

  const handleGoogleCallback = async (req, res) => {
    const state = oauthStates.get(String(req.query.state || ""));
    if (!state || state.expires < Date.now())
      return res
        .status(400)
        .send(
          "This Google Drive authorization link expired. Return to Backup Resources and reconnect.",
        );
    oauthStates.delete(String(req.query.state));
    if (req.query.error)
      return res.redirect(
        `/backup-manager.html?drive=${encodeURIComponent(String(req.query.error))}`,
      );
    try {
      const { clientId, clientSecret } = credentials();
      const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: String(req.query.code || ""),
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: state.redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.error_description ||
            body.error ||
            "Google authorization failed.",
        );
      const previous = getToken();
      if (!body.refresh_token && !previous?.refresh_token)
        throw new Error(
          "Google did not return a refresh token. Reconnect and approve Drive access.",
        );
      writePrivateJson(tokenPath, {
        refresh_token: body.refresh_token || previous.refresh_token,
        connectedAt: new Date().toISOString(),
      });
      res.redirect("/backup-manager.html?drive=connected");
    } catch (error) {
      res.redirect(
        `/backup-manager.html?drive=${encodeURIComponent(error.message)}`,
      );
    }
  };
  app.get("/v1/auth/google/callback", handleGoogleCallback);
  // Keep the initial module callback path working for deployments that registered it earlier.
  app.get("/api/backups/oauth/callback", handleGoogleCallback);

  app.get("/api/backups", async (req, res) => {
    try {
      if (!getToken()?.refresh_token)
        return res.json({ connected: false, backups: [] });
      const folderId = await ensureDriveFolder();
      res.json({
        connected: true,
        folderId,
        backups: await listDriveBackups(folderId),
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/backups/jobs/:id", (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: "Backup job not found." });
    res.json(job);
  });

  app.post("/api/backups/create", (req, res) => {
    if (!getToken()?.refresh_token)
      return res
        .status(401)
        .json({ error: "Connect this server to Google Drive first." });
    if (activeOperationId)
      return res.status(409).json({
        error: "A backup or restore is already running on this server.",
      });
    const job = startJob("backup");
    activeOperationId = job.id;
    const originName = sourceName(req);
    (async () => {
      const archivePath = temporaryArchive("backup", job.id);
      let uploadUrl;
      let accessToken;
      let transferAgent;
      let uploadCompleted = false;
      try {
        const date = new Date();
        const stamp = date.toISOString().replace(/[:.]/g, "-");
        const fileName = `agri-resources-backup-${stamp}-${safeName(originName)}.zip`;
        updateJob(job, { phase: "Compressing uploads", progress: 3 });
        const archiver = (await import("archiver")).default;
        await new Promise((resolve, reject) => {
          const output = fs.createWriteStream(archivePath, { mode: 0o600 });
          const zip = archiver("zip", { zlib: { level: 5 } });
          let settled = false;
          const finish = (error) => {
            if (settled) return;
            settled = true;
            if (error) {
              zip.abort();
              output.destroy();
              reject(error);
            } else resolve();
          };
          zip.pipe(output);
          output.once("finish", () => finish());
          output.once("close", () => {
            if (!output.writableFinished)
              finish(
                new Error("Backup archive was interrupted while writing."),
              );
          });
          output.once("error", finish);
          zip.on("warning", (error) =>
            error.code === "ENOENT"
              ? console.warn("Backup skipped missing file:", error.message)
              : finish(error),
          );
          zip.once("error", finish);
          zip.on("progress", (stats) =>
            updateJob(job, {
              phase: "Compressing uploads",
              progress: stats.entries.total
                ? Math.min(
                    38,
                    3 +
                      Math.round(
                        (stats.entries.processed / stats.entries.total) * 35,
                      ),
                  )
                : 3,
            }),
          );
          zip.append("", { name: "uploads/" });
          zip.directory(uploadsDir, "uploads");
          Promise.resolve(zip.finalize()).catch(finish);
        });
        const totalBytes = fs.statSync(archivePath).size;
        updateJob(job, {
          phase: "Uploading to Google Drive",
          progress: 40,
          totalBytes,
          bytes: 0,
        });
        const folderId = await ensureDriveFolder();
        accessToken = await fetchAccessToken();
        // Disable Undici's default body timeout for slow Drive connections.
        transferAgent = new Agent({
          headersTimeout: 0,
          bodyTimeout: 0,
          connect: { timeout: 0 },
        });
        let retryDelay = 1000;
        const retryDeadline = Date.now() + 24 * 60 * 60 * 1000;
        const waitToRetry = async () => {
          const remaining = retryDeadline - Date.now();
          if (remaining <= 0)
            throw new Error(
              "Google Drive stayed unavailable for 24 hours. Temporary backup data was cleaned up.",
            );
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(retryDelay, remaining)),
          );
          retryDelay = Math.min(retryDelay * 2, 60_000);
        };
        let init;
        while (true) {
          try {
            init = await fetch(
              `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,createdTime,appProperties`,
              {
                method: "POST",
                headers: {
                  authorization: `Bearer ${accessToken}`,
                  "content-type": "application/json; charset=UTF-8",
                  "x-upload-content-type": "application/zip",
                  "x-upload-content-length": String(totalBytes),
                },
                body: JSON.stringify({
                  name: fileName,
                  mimeType: "application/zip",
                  parents: [folderId],
                  appProperties: {
                    backupModule: APP_TAG,
                    source: originName,
                    createdAt: date.toISOString(),
                  },
                }),
                dispatcher: transferAgent,
              },
            );
          } catch (_) {
            await waitToRetry();
            continue;
          }
          if (init.ok) break;
          const message = (await init.text().catch(() => "")).slice(0, 300);
          if (init.status >= 500) {
            await waitToRetry();
            continue;
          }
          throw new Error(
            `Drive upload could not start (${init.status}): ${message}`,
          );
        }
        uploadUrl = init.headers.get("location");
        if (!uploadUrl)
          throw new Error("Google Drive did not return an upload session URL.");
        const chunkSize = 8 * 1024 * 1024; // A multiple of Drive's 256 KB resumable-upload unit.
        let offset = 0;
        let record = null;
        const acceptedOffset = (response) => {
          const range = response.headers.get("range");
          const match = range && range.match(/bytes=0-(\d+)/i);
          return match ? Number(match[1]) + 1 : 0;
        };
        const queryUploadState = async () => {
          while (true) {
            try {
              const state = await fetch(uploadUrl, {
                method: "PUT",
                headers: {
                  authorization: `Bearer ${accessToken}`,
                  "content-length": "0",
                  "content-range": `bytes */${totalBytes}`,
                },
                body: Buffer.alloc(0),
                dispatcher: transferAgent,
              });
              if (state.status === 308) {
                const currentOffset = acceptedOffset(state);
                await state.body?.cancel().catch(() => {});
                return { offset: currentOffset };
              }
              if (state.ok) return { record: await state.json() };
              const message = (await state.text().catch(() => "")).slice(
                0,
                300,
              );
              if (state.status < 500)
                throw new Error(
                  `Google Drive upload could not resume (${state.status}): ${message}`,
                );
            } catch (error) {
              if (
                error.message?.startsWith(
                  "Google Drive upload could not resume (",
                )
              )
                throw error;
            }
            await waitToRetry();
          }
        };
        while (offset < totalBytes && !record) {
          const length = Math.min(chunkSize, totalBytes - offset);
          const handle = await fs.promises.open(archivePath, "r");
          const chunk = Buffer.allocUnsafe(length);
          let bytesRead;
          try {
            ({ bytesRead } = await handle.read(chunk, 0, length, offset));
          } finally {
            await handle.close();
          }
          if (bytesRead !== length)
            throw new Error(
              "The temporary backup archive ended unexpectedly during upload.",
            );
          const end = offset + length - 1;
          let response;
          try {
            response = await fetch(uploadUrl, {
              method: "PUT",
              headers: {
                authorization: `Bearer ${accessToken}`,
                "content-type": "application/zip",
                "content-length": String(length),
                "content-range": `bytes ${offset}-${end}/${totalBytes}`,
              },
              body: chunk,
              dispatcher: transferAgent,
            });
          } catch (_) {
            await waitToRetry();
            const state = await queryUploadState();
            if (state.record) {
              record = state.record;
              uploadCompleted = true;
              break;
            }
            offset = state.offset;
            continue;
          }
          if (response.status === 308) {
            const nextOffset = acceptedOffset(response);
            await response.body?.cancel().catch(() => {});
            if (nextOffset > offset) {
              offset = nextOffset;
              retryDelay = 1000;
              updateJob(job, {
                phase: "Uploading to Google Drive",
                progress: 40 + Math.round((offset / totalBytes) * 55),
                bytes: offset,
              });
            } else {
              await waitToRetry();
            }
            continue;
          }
          if (response.ok) {
            uploadCompleted = true;
            record = await response.json();
            offset = totalBytes;
            updateJob(job, {
              phase: "Uploading to Google Drive",
              progress: 95,
              bytes: totalBytes,
            });
            break;
          }
          const message = (await response.text().catch(() => "")).slice(0, 300);
          if (response.status >= 500) {
            await waitToRetry();
            const state = await queryUploadState();
            if (state.record) {
              record = state.record;
              uploadCompleted = true;
              break;
            }
            offset = state.offset;
            continue;
          }
          throw new Error(
            `Drive upload failed (${response.status}): ${message}`,
          );
        }
        updateJob(job, {
          phase: "Keeping the latest five backups",
          progress: 97,
          bytes: totalBytes,
        });
        const backups = await listDriveBackups(folderId);
        const overflow = backups.slice(KEEP_BACKUPS);
        for (const old of overflow)
          await driveRequest(
            `${DRIVE_API}/files/${encodeURIComponent(old.id)}`,
            { method: "DELETE" },
          );
        updateJob(job, {
          status: "complete",
          phase: "Backup complete",
          progress: 100,
          file: record,
          deleted: overflow.length,
        });
      } catch (error) {
        console.error("Backup failed:", error);
        updateJob(job, {
          status: "error",
          phase: "Backup failed",
          error: error.message || "Backup failed.",
        });
      } finally {
        if (uploadUrl && !uploadCompleted) {
          try {
            if (new URL(uploadUrl).origin === "https://www.googleapis.com") {
              await fetch(uploadUrl, {
                method: "DELETE",
                headers: { authorization: `Bearer ${accessToken}` },
                signal: AbortSignal.timeout(15_000),
              });
            }
          } catch (_) {
            /* Google expires abandoned resumable sessions automatically. */
          }
        }
        await fs.promises.unlink(archivePath).catch(() => {});
        if (transferAgent) await transferAgent.close().catch(() => {});
        if (activeOperationId === job.id) activeOperationId = null;
      }
    })();
    res.status(202).json({ jobId: job.id });
  });

  app.post("/api/backups/:id/restore", (req, res) => {
    if (!getToken()?.refresh_token)
      return res
        .status(401)
        .json({ error: "Connect this server to Google Drive first." });
    if (activeOperationId)
      return res.status(409).json({
        error: "A backup or restore is already running on this server.",
      });
    const job = startJob("restore");
    activeOperationId = job.id;
    const fileId = req.params.id;
    (async () => {
      const archivePath = temporaryArchive("restore", job.id);
      const stageDir = path.join(
        projectDir,
        `.uploads-restore-${process.pid}-${job.id}`,
      );
      const oldDir = path.join(
        projectDir,
        `.uploads-previous-${process.pid}-${job.id}`,
      );
      let transferAgent;
      let movedOld = false;
      try {
        updateJob(job, { phase: "Finding backup", progress: 3 });
        const folderId = await ensureDriveFolder();
        const backups = await listDriveBackups(folderId);
        const backup = backups.find((file) => file.id === fileId);
        if (!backup)
          throw new Error(
            "That backup is not in the shared Backup Resources folder.",
          );
        updateJob(job, { phase: "Downloading backup", progress: 8 });
        const metadata = await driveRequest(
          `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id,name,size`,
        );
        const info = await metadata.json();
        const totalBytes = Number(info.size || backup.size || 0);
        if (!Number.isSafeInteger(totalBytes) || totalBytes <= 0)
          throw new Error("Google Drive returned an invalid backup size.");
        updateJob(job, { totalBytes });
        transferAgent = new Agent({
          headersTimeout: 0,
          bodyTimeout: 0,
          connect: { timeout: 0 },
        });
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
        let received = 0;
        let retryDelay = 1000;
        const retryDeadline = Date.now() + 24 * 60 * 60 * 1000;
        const chunkSize = 8 * 1024 * 1024;
        while (received < totalBytes) {
          const rangeEnd = Math.min(received + chunkSize, totalBytes) - 1;
          try {
            const content = await driveRequest(downloadUrl, {
              dispatcher: transferAgent,
              headers: { range: `bytes=${received}-${rangeEnd}` },
            });
            const range = content.headers
              .get("content-range")
              ?.match(/^bytes (\d+)-(\d+)\/(\d+)$/i);
            if (
              content.status !== 206 ||
              !range ||
              Number(range[1]) !== received ||
              Number(range[2]) !== rangeEnd ||
              Number(range[3]) !== totalBytes
            ) {
              await content.body.cancel().catch(() => {});
              throw new Error(
                "Google Drive did not return the requested backup byte range.",
              );
            }
            let attemptBytes = 0;
            const downloadStream = Readable.fromWeb(content.body);
            downloadStream.on("data", (chunk) => {
              attemptBytes += chunk.length;
              updateJob(job, {
                phase: "Downloading backup",
                progress:
                  8 +
                  Math.min(
                    47,
                    Math.round(((received + attemptBytes) / totalBytes) * 47),
                  ),
                bytes: received + attemptBytes,
              });
            });
            await pipeline(
              downloadStream,
              fs.createWriteStream(archivePath, {
                mode: 0o600,
                flags: received ? "a" : "w",
              }),
            );
            received = fs.statSync(archivePath).size;
            if (received > totalBytes)
              throw new Error(
                "Google Drive returned more backup data than expected.",
              );
            if (received !== rangeEnd + 1) {
              const error = new Error(
                "Google Drive ended the backup download before the requested range was complete.",
              );
              error.retryable = true;
              throw error;
            }
            retryDelay = 1000;
          } catch (error) {
            if (fs.existsSync(archivePath))
              received = fs.statSync(archivePath).size;
            if (received > totalBytes)
              throw new Error(
                "Google Drive returned more backup data than expected.",
              );
            const driveStatus = error.driveStatus;
            const code = error.code || error.cause?.code;
            const retryable =
              error.retryable ||
              (driveStatus !== undefined
                ? driveStatus === 408 ||
                  driveStatus === 429 ||
                  driveStatus >= 500
                : error.name === "TypeError" ||
                  (typeof code === "string" &&
                    /^(UND_ERR_|ECONN|EAI_AGAIN|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH)/.test(
                      code,
                    )));
            if (!retryable || Date.now() >= retryDeadline) throw error;
            console.warn(
              `Backup download interrupted at ${received} of ${totalBytes} bytes; resuming:`,
              error.message,
            );
            updateJob(job, {
              phase: "Resuming backup download",
              progress:
                8 + Math.min(47, Math.round((received / totalBytes) * 47)),
              bytes: received,
            });
            await new Promise((resolve) =>
              setTimeout(
                resolve,
                Math.min(retryDelay, retryDeadline - Date.now()),
              ),
            );
            retryDelay = Math.min(retryDelay * 2, 60_000);
          }
        }
        if (received !== totalBytes)
          throw new Error(
            "The downloaded backup size does not match Google Drive metadata.",
          );
        updateJob(job, {
          phase: "Checking and extracting uploads",
          progress: 58,
        });
        const directory = await unzipper.Open.file(archivePath);
        fs.mkdirSync(stageDir, { recursive: true });
        let fileCount = 0;
        for (const entry of directory.files) {
          const relative = entry.path.replace(/\\/g, "/");
          if (
            !relative ||
            relative.startsWith("/") ||
            /^[A-Za-z]:/.test(relative) ||
            relative.split("/").some((part) => part === "..")
          )
            throw new Error(
              "Backup contains an unsafe archive path; current uploads were not changed.",
            );
          if (relative !== "uploads" && !relative.startsWith("uploads/"))
            throw new Error(
              "Backup contains data outside the uploads folder; current uploads were not changed.",
            );
          const kind = entry.type;
          const outputPath = path.resolve(stageDir, ...relative.split("/"));
          if (
            outputPath !== stageDir &&
            !outputPath.startsWith(stageDir + path.sep)
          )
            throw new Error(
              "Backup contains a path outside uploads; current uploads were not changed.",
            );
          if (kind === "SymbolicLink")
            throw new Error(
              "Backup contains a symbolic link; current uploads were not changed.",
            );
          if (kind === "Directory") {
            fs.mkdirSync(outputPath, { recursive: true });
            continue;
          }
          fs.mkdirSync(path.dirname(outputPath), { recursive: true });
          await pipeline(
            entry.stream(),
            fs.createWriteStream(outputPath, { mode: 0o600, flags: "wx" }),
          );
          fileCount++;
          updateJob(job, {
            phase: "Checking and extracting uploads",
            progress:
              58 +
              Math.min(
                28,
                Math.round(
                  (fileCount / Math.max(1, directory.files.length)) * 28,
                ),
              ),
          });
        }
        const stagedUploads = path.join(stageDir, "uploads");
        if (
          !fs.existsSync(stagedUploads) ||
          !fs.statSync(stagedUploads).isDirectory()
        )
          throw new Error(
            "This file does not contain a complete uploads folder; current uploads were not changed.",
          );
        updateJob(job, { phase: "Replacing uploads folder", progress: 91 });
        fs.renameSync(uploadsDir, oldDir);
        movedOld = true;
        try {
          fs.renameSync(stagedUploads, uploadsDir);
        } catch (error) {
          fs.renameSync(oldDir, uploadsDir);
          movedOld = false;
          throw error;
        }
        movedOld = false;
        await fs.promises
          .rm(oldDir, { recursive: true, force: true })
          .catch((error) =>
            console.warn(
              "Could not remove previous uploads after successful restore:",
              error.message,
            ),
          );
        if (afterRestore) {
          try {
            afterRestore();
          } catch (error) {
            console.error(
              "Resources restored, but some in-memory quiz data could not reload:",
              error,
            );
          }
        }
        updateJob(job, {
          status: "complete",
          phase: "Restore complete",
          progress: 100,
          restoredFile: info.name,
          fileCount,
        });
      } catch (error) {
        if (movedOld && !fs.existsSync(uploadsDir)) {
          try {
            fs.renameSync(oldDir, uploadsDir);
            movedOld = false;
          } catch (rollbackError) {
            console.error("Restore rollback failed:", rollbackError);
          }
        }
        console.error("Restore failed:", error);
        updateJob(job, {
          status: "error",
          phase: "Restore failed",
          error: error.message || "Restore failed.",
        });
      } finally {
        await fs.promises.unlink(archivePath).catch(() => {});
        await fs.promises
          .rm(stageDir, { recursive: true, force: true })
          .catch(() => {});
        if (!movedOld)
          await fs.promises
            .rm(oldDir, { recursive: true, force: true })
            .catch(() => {});
        if (transferAgent) await transferAgent.close().catch(() => {});
        if (activeOperationId === job.id) activeOperationId = null;
      }
    })();
    res.status(202).json({ jobId: job.id });
  });
};

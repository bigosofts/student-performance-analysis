const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const XLSX = require("xlsx");
const { spawn } = require("child_process");
const unzipper = require("unzipper");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
  maxHttpBufferSize: 1e7, // 10MB limit for high-res images
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Ensure gallery uploads directory exists
const galleryDir = path.join(uploadsDir, "gallery");
if (!fs.existsSync(galleryDir)) {
  fs.mkdirSync(galleryDir);
}

// ========== PRESENTATION SYSTEM ==========
const PRES_META_FILE = path.join(uploadsDir, "presentations.json");

function loadPresMeta() {
  try {
    if (fs.existsSync(PRES_META_FILE)) {
      return JSON.parse(fs.readFileSync(PRES_META_FILE, "utf8"));
    }
  } catch (e) {
    console.error("Error loading pres meta:", e);
  }
  return [];
}

function savePresMeta(data) {
  try {
    fs.writeFileSync(PRES_META_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("Error saving pres meta:", e);
  }
}

// Convert PPTX to PNG images using PowerShell + PowerPoint COM
function convertPptxToImages(pptxPath, slideDir) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(slideDir)) {
      fs.mkdirSync(slideDir, { recursive: true });
    }
    // PowerShell script that uses PowerPoint COM automation
    const psScript = [
      '$ErrorActionPreference = "Stop"',
      `$pptPath = "${pptxPath.replace(/\\/g, "\\\\")}"`,
      `$outDir  = "${slideDir.replace(/\\/g, "\\\\")}"`,
      "try {",
      "  Add-Type -AssemblyName Microsoft.Office.Interop.PowerPoint 2>$null",
      "  $pptApp = New-Object -ComObject PowerPoint.Application",
      "  $pptApp.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue",
      "  $pres = $pptApp.Presentations.Open($pptPath, $true, $false, $false)",
      "  $count = $pres.Slides.Count",
      "  for ($i = 1; $i -le $count; $i++) {",
      "    $slide = $pres.Slides.Item($i)",
      '    $slide.Export("$outDir\\slide_$i.png", "PNG", 1920, 1080)',
      "  }",
      "  $pres.Close()",
      "  $pptApp.Quit()",
      "  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($pptApp) | Out-Null",
      "  [System.GC]::Collect()",
      "  Write-Output $count",
      "} catch {",
      "  Write-Error $_.Exception.Message",
      "  exit 1",
      "}",
    ].join("\n");

    const ps = spawn("powershell", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      psScript,
    ]);

    let stdout = "";
    let stderr = "";
    ps.stdout.on("data", (d) => (stdout += d.toString()));
    ps.stderr.on("data", (d) => (stderr += d.toString()));

    ps.on("close", (code) => {
      if (code === 0) {
        const count = parseInt(stdout.trim()) || 0;
        resolve(count);
      } else {
        reject(
          new Error(
            stderr.trim() || "PowerShell conversion failed with code " + code,
          ),
        );
      }
    });

    ps.on("error", (err) => reject(err));
  });
}

// Multer for PPTX uploads
const presStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `pres-${Date.now()}-${safe}`);
  },
});
const presUpload = multer({
  storage: presStorage,
  fileFilter: (req, file, cb) => {
    const ok = /\.(pptx|ppt)$/i.test(file.originalname);
    cb(ok ? null : new Error("Only .pptx and .ppt files are allowed"), ok);
  },
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

// ========== MONOPOLY QUIZ SYSTEM ==========
let quizQuestions = [];
let currentQuizIndex = 0;

// ========== MAZE QUIZ SYSTEM ==========
let mazeQuizQuestions = [];
let currentMazeQuizIndex = 0;

function createDemoExcel(filePath) {
  const data = [
    ["Question", "Option A", "Option B", "Option C", "Option D", "Answer"],
    ["ধান কোন ধরনের ফসল?", "রবি ফসল", "খরিফ ফসল", "নগদ ফসল", "দোফসলি", "B"],
    ["বাংলাদেশের প্রধান খাদ্যশস্য কোনটি?", "গম", "ধান", "ভুট্টা", "যব", "B"],
    [
      "সালোকসংশ্লেষণের জন্য কোনটি প্রয়োজন?",
      "অক্সিজেন",
      "নাইট্রোজেন",
      "কার্বন ডাই অক্সাইড",
      "হাইড্রোজেন",
      "C",
    ],
    [
      "কোন মাটি ধান চাষের জন্য উপযুক্ত?",
      "বেলে মাটি",
      "দোঁয়াশ মাটি",
      "কাদামাটি",
      "পলি মাটি",
      "C",
    ],
    [
      "বাংলাদেশে কোন ফসল সবচেয়ে বেশি উৎপাদিত হয়?",
      "গম",
      "পাট",
      "ধান",
      "আখ",
      "C",
    ],
    ["জৈব সার কোনটি?", "ইউরিয়া", "টিএসপি", "কম্পোস্ট", "এমওপি", "C"],
    [
      "ফসলের পোকামাকড় দমনে কোন পদ্ধতি পরিবেশবান্ধব?",
      "রাসায়নিক কীটনাশক",
      "জৈবিক দমন",
      "আগুন",
      "কোনোটিই নয়",
      "B",
    ],
    ["বাংলাদেশের জাতীয় ফল কোনটি?", "আম", "কাঁঠাল", "লিচু", "কলা", "B"],
    ["কোনটি রবি ফসল?", "ধান", "পাট", "গম", "আউশ", "C"],
    [
      "মাটির pH কত হলে ধান চাষ ভালো হয়?",
      "৩-৪",
      "৫.৫-৬.৫",
      "৮-৯",
      "১০-১১",
      "B",
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Quiz Questions");
  XLSX.writeFile(wb, filePath);
  console.log("Demo quiz Excel created at:", filePath);
}

function loadQuizFromExcel(filePath) {
  try {
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    quizQuestions = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row && row[0]) {
        quizQuestions.push({
          question: row[0],
          options: [row[1], row[2], row[3], row[4]],
          answer: (row[5] || "A").toString().toUpperCase(),
        });
      }
    }
    currentQuizIndex = 0;
    console.log(`Loaded ${quizQuestions.length} quiz questions`);
  } catch (e) {
    console.error("Failed to load quiz:", e);
  }
}

function initQuizSystem() {
  const quizPath = path.join(uploadsDir, "quiz-questions.xlsx");
  if (!fs.existsSync(quizPath)) {
    createDemoExcel(quizPath);
  }
  loadQuizFromExcel(quizPath);
}

// ── Maze quiz loader ───────────────────────────────────────────
function loadMazeQuizFromExcel(filePath) {
  try {
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    mazeQuizQuestions = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row && row[0]) {
        mazeQuizQuestions.push({
          question: row[0],
          options: [row[1], row[2], row[3], row[4]],
          answer: (row[5] || "A").toString().toUpperCase(),
        });
      }
    }
    currentMazeQuizIndex = 0;
    console.log(`[Maze] Loaded ${mazeQuizQuestions.length} quiz questions`);
  } catch (e) {
    console.error("[Maze] Failed to load quiz:", e);
  }
}

// ========== MULTER CONFIGS ==========
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const tileId = req.params.tileId || req.body.tileId || "unknown";
    const ext = path.extname(file.originalname);
    cb(null, `tile-${tileId}-${Date.now()}${ext}`); // Added timestamp to prevent cache issues
  },
});

const upload = multer({ storage: storage });

const quizUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, "quiz-upload-temp" + path.extname(file.originalname)),
});
const quizUpload = multer({ storage: quizUploadStorage });

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));
// Serve uploads folder
app.use("/uploads", express.static(uploadsDir));
app.use(express.json());

app.post("/api/reload-quiz", (req, res) => {
  const game = req.body.game;
  if (game === 'monopoly') {
    initQuizSystem();
    res.json({ status: 'ok' });
  } else if (game === 'maze') {
    const mazeQuizPath = path.join(uploadsDir, "maze-quiz-questions.xlsx");
    loadMazeQuizFromExcel(mazeQuizPath);
    res.json({ status: 'ok' });
  } else {
    res.status(400).json({ error: 'Invalid game parameter' });
  }
});

// API to upload image
app.post("/upload/:tileId", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded.");

  const tileId = req.params.tileId;
  const imageUrl = `/uploads/${req.file.filename}`;

  // Broadcast to all clients
  io.emit("image-updated", { id: tileId, url: imageUrl });

  res.send({ status: "ok", url: imageUrl });
});

// API to upload monopoly quiz Excel
app.post("/upload-quiz", quizUpload.single("quizFile"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const dest = path.join(uploadsDir, "quiz-questions.xlsx");
  const tempPath = path.join(uploadsDir, req.file.filename);

  // Remove old quiz file
  if (fs.existsSync(dest)) {
    try {
      fs.unlinkSync(dest);
    } catch (e) { }
  }

  // Rename temp to permanent
  fs.renameSync(tempPath, dest);
  loadQuizFromExcel(dest);

  io.emit("quiz-loaded", { count: quizQuestions.length });
  res.json({ status: "ok", count: quizQuestions.length });
});

// Multer config for maze quiz
const mazeQuizUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, "maze-quiz-upload-temp" + path.extname(file.originalname)),
});
const mazeQuizUpload = multer({ storage: mazeQuizUploadStorage });

// Multer config for video uploads
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    cb(null, "video-" + Date.now() + path.extname(file.originalname));
  },
});
const videoUpload = multer({
  storage: videoStorage,
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype.startsWith("video/");
    cb(ok ? null : new Error("Only video files are allowed"), ok);
  },
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

// API to upload video
app.post("/api/video/upload", (req, res) => {
  videoUpload.single("video")(req, res, function (err) {
    if (err) {
      console.error("Video upload error:", err);
      return res.status(400).json({ error: err.message || "Upload failed" });
    }
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const url = "/uploads/" + req.file.filename;
    res.json({ status: "ok", url, filename: req.file.filename });
  });
});

// API to list uploaded videos
app.get("/api/videos", (req, res) => {
  fs.readdir(uploadsDir, (err, files) => {
    if (err)
      return res
        .status(500)
        .json({ error: "Failed to read uploads directory" });
    const videos = files.filter((f) => f.startsWith("video-"));

    // Get file stats to sort by newest first (optional but good)
    const videoStats = videos.map((f) => {
      const stats = fs.statSync(path.join(uploadsDir, f));
      return {
        filename: f,
        url: "/uploads/" + f,
        mtime: stats.mtime.getTime(),
        size: stats.size,
      };
    });

    videoStats.sort((a, b) => b.mtime - a.mtime);
    res.json(videoStats);
  });
});

// API to delete uploaded video
app.delete("/api/video/:filename", (req, res) => {
  const { filename } = req.params;
  if (!filename.startsWith("video-")) {
    return res.status(400).json({ error: "Invalid video filename" });
  }
  const filePath = path.join(uploadsDir, filename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      res.json({ status: "ok" });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete file" });
    }
  } else {
    res.status(404).json({ error: "File not found" });
  }
});

// API to upload maze quiz Excel
app.post("/upload-maze-quiz", mazeQuizUpload.single("quizFile"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const dest = path.join(uploadsDir, "maze-quiz-questions.xlsx");
  const tempPath = path.join(uploadsDir, req.file.filename);

  if (fs.existsSync(dest)) {
    try {
      fs.unlinkSync(dest);
    } catch (e) { }
  }

  fs.renameSync(tempPath, dest);
  loadMazeQuizFromExcel(dest);

  io.emit("maze-quiz-loaded", { count: mazeQuizQuestions.length });
  res.json({ status: "ok", count: mazeQuizQuestions.length });
});

// Get next maze quiz question (randomised)
app.get("/api/maze-quiz/next", (req, res) => {
  if (mazeQuizQuestions.length === 0) {
    return res.json({ question: null });
  }
  const randomIndex = Math.floor(Math.random() * mazeQuizQuestions.length);
  const q = mazeQuizQuestions[randomIndex];
  currentMazeQuizIndex++;
  res.json({ ...q, index: randomIndex + 1, total: mazeQuizQuestions.length });
});

// Get maze quiz info
app.get("/api/maze-quiz/info", (req, res) => {
  res.json({
    count: mazeQuizQuestions.length,
    currentIndex: currentMazeQuizIndex,
  });
});

// Get next quiz question (randomized)
app.get("/api/quiz/next", (req, res) => {
  if (quizQuestions.length === 0) {
    return res.json({ question: null });
  }
  const randomIndex = Math.floor(Math.random() * quizQuestions.length);
  const q = quizQuestions[randomIndex];
  currentQuizIndex++;
  res.json({ ...q, index: randomIndex + 1, total: quizQuestions.length });
});

// Get quiz info
app.get("/api/quiz/info", (req, res) => {
  res.json({ count: quizQuestions.length, currentIndex: currentQuizIndex });
});

// API to clear uploads with game-specific isolation
app.post("/clear-uploads", (req, res) => {
  const game = req.query.game || req.body.game || null;

  fs.readdir(uploadsDir, (err, files) => {
    if (err) return res.status(500).send(err);

    for (const file of files) {
      if (game === "memory") {
        // Delete files matching /^tile-\d+/ (memory tiles like tile-1-*, tile-2-*, etc.)
        if (/^tile-\d+/.test(file)) {
          fs.unlink(path.join(uploadsDir, file), (err) => {
            if (err) console.error(err);
          });
        }
      } else if (game === "monopoly") {
        // Delete tile-team-* (team photos), quiz-questions.xlsx, and quiz-upload-temp*
        if (
          /^tile-team-/.test(file) ||
          file === "quiz-questions.xlsx" ||
          /^quiz-upload-temp/.test(file)
        ) {
          fs.unlink(path.join(uploadsDir, file), (err) => {
            if (err) console.error(err);
          });
        }
      } else if (game === "maze") {
        // Delete tile-maze-team-* (team photos), maze-quiz-questions.xlsx, and maze-quiz-upload-temp*
        if (
          /^tile-maze-team-/.test(file) ||
          file === "maze-quiz-questions.xlsx" ||
          /^maze-quiz-upload-temp/.test(file)
        ) {
          fs.unlink(path.join(uploadsDir, file), (err) => {
            if (err) console.error(err);
          });
        }
      } else if (game === "wordpuzzle") {
        // Delete tile-wordpuzzle-team-* (team photos)
        if (/^tile-wordpuzzle-team-/.test(file)) {
          fs.unlink(path.join(uploadsDir, file), (err) => {
            if (err) console.error(err);
          });
        }
      } else {
        // Fallback/Default: only delete tile photos and temp quiz uploads (never touch presentations or active quizzes)
        if (
          (/^tile-/.test(file) &&
            !file.includes("quiz-questions") &&
            !file.includes("maze-quiz")) ||
          /^quiz-upload-temp/.test(file) ||
          /^maze-quiz-upload-temp/.test(file)
        ) {
          fs.unlink(path.join(uploadsDir, file), (err) => {
            if (err) console.error(err);
          });
        }
      }
    }

    // Handle game-specific cleanup
    if (game === "monopoly") {
      initQuizSystem();
    }
    if (game === "maze") {
      mazeQuizQuestions = [];
      currentMazeQuizIndex = 0;
    }

    // Broadcast wipe to all clients
    io.emit("image-updated", { id: "all" });
    res.send({ status: "ok", game: game || "default" });
  });
});

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // PC Control Agent Registration
  socket.on("agent:register", (data) => {
    if (data && data.deviceId) {
      const roomName = `agent_${data.deviceId}`;
      socket.join(roomName);
      console.log(`Agent ${data.deviceId} registered and joined room ${roomName}`);
    }
  });

  // PC Control Command Relay
  socket.on("pc-control", (payload) => {
    if (payload && payload.targetUuid && payload.command) {
      const roomName = `agent_${payload.targetUuid}`;
      io.to(roomName).emit(payload.command, payload.data);
    }
  });

  // When teacher sends a game update
  socket.on("update-game", (gameState) => {
    socket.broadcast.emit("game-updated", gameState);
  });

  // Forward image-saved events (used for sync-start and other UI signals)
  socket.on("image-saved", (data) => {
    socket.broadcast.emit("image-updated", data);
  });

  // Monopoly quiz events
  socket.on("show-quiz", (data) => {
    socket.broadcast.emit("quiz-show", data);
  });

  socket.on("quiz-result", (data) => {
    socket.broadcast.emit("quiz-result", data);
  });

  socket.on("close-quiz", () => {
    socket.broadcast.emit("quiz-close");
  });

  // Event overlay (opportunity/obstacle)
  socket.on("show-event", (data) => {
    socket.broadcast.emit("event-show", data);
  });

  socket.on("close-event", () => {
    socket.broadcast.emit("event-close");
  });

  // ── Maze game events ────────────────────────────────────
  socket.on("maze-update-game", (gameState) => {
    socket.broadcast.emit("maze-game-updated", gameState);
  });

  socket.on("maze-show-quiz", (data) => {
    socket.broadcast.emit("maze-show-quiz", data);
  });

  socket.on("maze-quiz-result", (data) => {
    socket.broadcast.emit("maze-quiz-result", data);
  });

  socket.on("maze-close-quiz", () => {
    socket.broadcast.emit("maze-close-quiz");
  });

  // ── Word Puzzle game events ───────────────────────────
  socket.on("wordpuzzle-update-game", (gameState) => {
    socket.broadcast.emit("wordpuzzle-game-updated", gameState);
  });

  socket.on("wordpuzzle-add-points", (data) => {
    socket.broadcast.emit("wordpuzzle-show-points-modal", data);
  });

  socket.on("wordpuzzle-close-points-modal", () => {
    socket.broadcast.emit("wordpuzzle-close-points-modal");
  });

  // ── Presentation game events ──────────────────────────────
  socket.on("pres-open", (data) => {
    socket.broadcast.emit("pres-open", data);
  });

  socket.on("pres-goto-slide", (data) => {
    socket.broadcast.emit("pres-goto-slide", data);
  });

  socket.on("pres-fullscreen", (data) => {
    socket.broadcast.emit("pres-fullscreen", data);
  });

  socket.on("pres-close", () => {
    socket.broadcast.emit("pres-close");
  });

  socket.on("pres-share-image", (data) => {
    socket.broadcast.emit("pres-share-image", data);
  });

  socket.on("pres-share-tree", (data) => {
    socket.broadcast.emit("pres-share-tree", data);
  });

  socket.on("pres-share-note", (data) => {
    socket.broadcast.emit("pres-share-note", data);
  });

  socket.on("pres-share-video", (data) => {
    io.emit("pres-share-video", data);
  });

  socket.on("pres-share-webpage", (data) => {
    io.emit("pres-share-webpage", data);
  });

  socket.on("pres-share-pdf", (data) => {
    io.emit("pres-share-pdf", data);
  });

  
  socket.on("pres-minimize-specific", (data) => {
    io.emit("pres-minimize-specific", data);
  });
  
  socket.on("pres-restore-specific", (data) => {
    io.emit("pres-restore-specific", data);
  });
  
  socket.on("pres-close-specific", (data) => {
    io.emit("pres-close-specific", data);
  });

  socket.on("pres-close-share", () => {
    socket.broadcast.emit("pres-close-share");
  });

  socket.on("class-session-start", (data) => {
    socket.broadcast.emit("class-session-start", data);
  });

  socket.on("classroom-navigate", (data) => {
    socket.broadcast.emit("classroom-navigate", data);
  });

  socket.on("pres-aspect-ratio", (data) => {
    socket.broadcast.emit("pres-aspect-ratio", data);
  });

  socket.on("pres-slide-count", (data) => {
    socket.broadcast.emit("pres-slide-count", data);
  });

  // ── Whiteboard events ─────────────────────────────────────────
  socket.on("wb-open", (data) => socket.broadcast.emit("wb-open", data));
  socket.on("wb-close", () => socket.broadcast.emit("wb-close"));
  socket.on("wb-state", (data) => socket.broadcast.emit("wb-state", data));
  socket.on("wb-pan", (data) => socket.broadcast.emit("wb-pan", data));
  socket.on("wb-zoom", (data) => socket.broadcast.emit("wb-zoom", data));
  socket.on("wb-bg", (data) => socket.broadcast.emit("wb-bg", data));
  socket.on("wb-add", (data) => socket.broadcast.emit("wb-add", data));
  socket.on("wb-modify", (data) => socket.broadcast.emit("wb-modify", data));
  socket.on("wb-remove", (data) => socket.broadcast.emit("wb-remove", data));
  socket.on("wb-clear", () => socket.broadcast.emit("wb-clear"));
  socket.on("wb-modify-batch", (data) => socket.broadcast.emit("wb-modify-batch", data));
  socket.on("wb-grid", (data) => socket.broadcast.emit("wb-grid", data));
  socket.on("wb-capture-request", () => socket.broadcast.emit("wb-capture-request"));
  socket.on("wb-capture-response", (data) => socket.broadcast.emit("wb-capture-response", data));

  socket.on("leaderboard-show", (data) => socket.broadcast.emit("leaderboard-show", data));

  // ── Screen Share WebRTC Signaling (native WebRTC, no PeerJS) ─
  socket.on("screenshare-start", (data) => {
    socket.broadcast.emit("screenshare-start", data);
  });
  socket.on("screenshare-ready", () => {
    // Game page is ready — tell dashboard to create the offer
    socket.broadcast.emit("screenshare-ready");
  });
  socket.on("screenshare-offer", (data) => {
    socket.broadcast.emit("screenshare-offer", data);
  });
  socket.on("screenshare-answer", (data) => {
    socket.broadcast.emit("screenshare-answer", data);
  });
  socket.on("screenshare-ice", (data) => {
    socket.broadcast.emit("screenshare-ice", data);
  });
  socket.on("screenshare-stop", () => {
    socket.broadcast.emit("screenshare-stop");
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// ========== PRESENTATION REST API ==========

// List all presentations
app.get("/api/presentations", (req, res) => {
  let meta = loadPresMeta();
  const { page, limit = 8, search, paginated } = req.query;

  if (search) {
    const q = search.toLowerCase();
    meta = meta.filter((m) => {
      return (
        (m.originalname && m.originalname.toLowerCase().includes(q)) ||
        (m.subject && m.subject.toLowerCase().includes(q)) ||
        (m.chapter && m.chapter.toLowerCase().includes(q))
      );
    });
  }

  if (paginated === "true") {
    const totalItems = meta.length;
    const limitNum = parseInt(limit, 10) || 8;
    const totalPages = Math.ceil(totalItems / limitNum) || 1;
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const startIndex = (currentPage - 1) * limitNum;
    const paginatedItems = meta.slice(startIndex, startIndex + limitNum);

    res.json({
      items: paginatedItems,
      pagination: { totalItems, totalPages, currentPage, limit: limitNum }
    });
  } else {
    res.json(meta);
  }
});

// Upload a presentation
app.post("/api/presentation/upload", (req, res) => {
  presUpload.single("presentation")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const subject = (req.body.subject || "General").trim();
    const chapter = (req.body.chapter || "Chapter 1").trim();
    const filename = req.file.filename;
    const pptxPath = path.join(uploadsDir, filename);
    const slideDirName = "slides-" + filename.replace(/\.[^.]+$/, "");
    const slideDir = path.join(uploadsDir, slideDirName);

    const meta = loadPresMeta();

    // Check if same original name already exists → update it
    const existingIdx = meta.findIndex(
      (m) => m.originalname === req.file.originalname,
    );
    const entry = {
      filename,
      originalname: req.file.originalname,
      subject,
      chapter,
      size: req.file.size,
      uploadedAt: new Date().toLocaleDateString("en-GB"),
      slideCount: 0,
      slideDirName,
      converted: false,
    };

    if (existingIdx >= 0) {
      // Remove old file and slides
      try {
        const old = meta[existingIdx];
        fs.unlinkSync(path.join(uploadsDir, old.filename));
        const oldSlideDir = path.join(uploadsDir, old.slideDirName);
        if (fs.existsSync(oldSlideDir)) {
          fs.rmSync(oldSlideDir, { recursive: true, force: true });
        }
      } catch (e) {
        /* ignore */
      }
      meta[existingIdx] = entry;
    } else {
      meta.push(entry);
    }

    savePresMeta(meta);
    io.emit("pres-updated");

    // Trigger background conversion
    convertPptxToImages(pptxPath, slideDir)
      .then((count) => {
        const updated = loadPresMeta();
        const idx = updated.findIndex((m) => m.filename === filename);
        if (idx >= 0) {
          updated[idx].slideCount = count;
          updated[idx].converted = true;
          savePresMeta(updated);
          io.emit("pres-updated");
          console.log(`[PRES] Converted ${filename}: ${count} slides`);
        }
      })
      .catch((e) => {
        console.warn(
          "[PRES] Conversion failed (PowerPoint may not be installed):",
          e.message,
        );
      });

    res.json({ status: "ok", filename, originalname: req.file.originalname });
  });
});

// ========== ZIP UPLOAD FOR PRESENTATIONS (ALTERNATIVE METHOD) ==========

// Multer for ZIP uploads
const zipStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `preszip-${Date.now()}-${safe}`);
  },
});
const zipUpload = multer({
  storage: zipStorage,
  fileFilter: (req, file, cb) => {
    const ok = /\.zip$/i.test(file.originalname);
    cb(ok ? null : new Error("Only .zip files are allowed"), ok);
  },
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

// API to upload ZIP containing PPTX and slide images
app.post(
  "/api/presentation/upload-zip",
  zipUpload.single("presentationZip"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const zipPath = path.join(uploadsDir, req.file.filename);
    const subject = (req.body.subject || "General").trim();
    const chapter = (req.body.chapter || "Chapter 1").trim();

    // Extract ZIP
    const extractDir = path.join(uploadsDir, `extract-${Date.now()}`);

    try {
      await new Promise((resolve, reject) => {
        fs.createReadStream(zipPath)
          .pipe(unzipper.Extract({ path: extractDir }))
          .on("close", resolve)
          .on("error", reject);
      });

      // Find PPTX file in extracted content
      let pptxFile = null;
      const files = fs.readdirSync(extractDir);

      for (const file of files) {
        if (/\.(pptx|ppt)$/i.test(file)) {
          pptxFile = file;
          break;
        }
      }

      if (!pptxFile) {
        // Clean up
        fs.rmSync(zipPath, { force: true });
        fs.rmSync(extractDir, { recursive: true, force: true });
        return res.status(400).json({ error: "No PPTX/PPT file found in ZIP" });
      }

      // Move PPTX to uploads directory with standard naming
      const pptxSourcePath = path.join(extractDir, pptxFile);
      const pptxFilename = `pres-${Date.now()}-${pptxFile.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const pptxDestPath = path.join(uploadsDir, pptxFilename);

      fs.renameSync(pptxSourcePath, pptxDestPath);

      // Find and process slide images (Slide1.PNG, Slide2.PNG, etc.)
      const slideDirName = "slides-" + pptxFilename.replace(/\.[^.]+$/, "");
      const slideDir = path.join(uploadsDir, slideDirName);

      if (!fs.existsSync(slideDir)) {
        fs.mkdirSync(slideDir, { recursive: true });
      }

      let slideCount = 0;
      const slidePattern = /^Slide\d+\.(png|jpe?g|gif|bmp|tiff?)$/i;

      for (const file of files) {
        if (slidePattern.test(file)) {
          const sourcePath = path.join(extractDir, file);
          // Standardize filename to slide_1.png, slide_2.png, etc.
          const match = file.match(/^Slide(\d+)\.(.*)$/i);
          if (match) {
            const slideNum = parseInt(match[1]);
            const ext = match[2].toLowerCase();
            const destFilename = `slide_${slideNum}.${ext}`;
            const destPath = path.join(slideDir, destFilename);

            fs.copyFileSync(sourcePath, destPath);
            slideCount++;
          }
        }
      }

      // Create presentation metadata entry
      const meta = loadPresMeta();

      // Check if same original name already exists → update it
      const existingIdx = meta.findIndex(
        (m) => m.originalname === req.file.originalname,
      );
      const entry = {
        filename: pptxFilename,
        originalname: req.file.originalname, // Keep original ZIP name for reference
        subject,
        chapter,
        size: req.file.size,
        uploadedAt: new Date().toLocaleDateString("en-GB"),
        slideCount: slideCount,
        slideDirName,
        converted: slideCount > 0, // Mark as converted if we have slides
      };

      if (existingIdx >= 0) {
        // Remove old file and slides
        try {
          const old = meta[existingIdx];
          fs.unlinkSync(path.join(uploadsDir, old.filename));
          const oldSlideDir = path.join(uploadsDir, old.slideDirName);
          if (fs.existsSync(oldSlideDir)) {
            fs.rmSync(oldSlideDir, { recursive: true, force: true });
          }
        } catch (e) {
          /* ignore */
        }
        meta[existingIdx] = entry;
      } else {
        meta.push(entry);
      }

      savePresMeta(meta);
      io.emit("pres-updated");

      // Clean up extracted files
      fs.rmSync(zipPath, { force: true });
      fs.rmSync(extractDir, { recursive: true, force: true });

      // If we didn't find slide images, try to convert PPTX
      if (slideCount === 0) {
        convertPptxToImages(pptxDestPath, slideDir)
          .then((count) => {
            const updated = loadPresMeta();
            const idx = updated.findIndex((m) => m.filename === pptxFilename);
            if (idx >= 0) {
              updated[idx].slideCount = count;
              updated[idx].converted = true;
              savePresMeta(updated);
              io.emit("pres-updated");
              console.log(
                `[PRES-ZIP] Converted ${pptxFilename}: ${count} slides`,
              );
            }
          })
          .catch((e) => {
            console.warn(
              "[PRES-ZIP] Conversion failed (PowerPoint may not be installed):",
              e.message,
            );
          });
      } else {
        console.log(`[PRES-ZIP] Extracted ${slideCount} slides from ZIP`);
      }

      res.json({
        status: "ok",
        filename: pptxFilename,
        originalname: req.file.originalname,
        slideCount: slideCount,
      });
    } catch (e) {
      console.error("[PRES-ZIP] Error processing ZIP:", e);

      // Clean up on error
      try {
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        if (fs.existsSync(extractDir))
          fs.rmSync(extractDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error("[PRES-ZIP] Error during cleanup:", cleanupError);
      }

      res.status(500).json({ error: `Failed to process ZIP: ${e.message}` });
    }
  },
);

// Convert on demand
app.post("/api/presentation/:filename/convert", async (req, res) => {
  const { filename } = req.params;
  const meta = loadPresMeta();
  const entry = meta.find((m) => m.filename === filename);
  if (!entry) return res.status(404).json({ error: "Not found" });

  const pptxPath = path.join(uploadsDir, filename);
  const slideDir = path.join(uploadsDir, entry.slideDirName);

  try {
    const count = await convertPptxToImages(pptxPath, slideDir);
    entry.slideCount = count;
    entry.converted = true;
    savePresMeta(meta);
    io.emit("pres-updated");
    res.json({ success: true, slideCount: count });
  } catch (e) {
    res.json({ success: false, slideCount: 0, error: e.message });
  }
});

// Delete a presentation
app.delete("/api/presentation/:filename", (req, res) => {
  const { filename } = req.params;
  const meta = loadPresMeta();
  const idx = meta.findIndex((m) => m.filename === filename);
  if (idx < 0) return res.status(404).json({ error: "Not found" });

  const entry = meta[idx];
  // Delete file
  try {
    fs.unlinkSync(path.join(uploadsDir, entry.filename));
  } catch (e) { }
  // Delete slides dir
  try {
    const slideDir = path.join(uploadsDir, entry.slideDirName);
    if (fs.existsSync(slideDir))
      fs.rmSync(slideDir, { recursive: true, force: true });
  } catch (e) { }

  meta.splice(idx, 1);
  savePresMeta(meta);
  io.emit("pres-updated");
  res.json({ status: "ok" });
});

// ========== GALLERY SYSTEM ==========
const GALLERY_FILE = path.join(uploadsDir, "gallery.json");

function loadGallery() {
  try {
    if (fs.existsSync(GALLERY_FILE)) {
      return JSON.parse(fs.readFileSync(GALLERY_FILE, "utf8"));
    }
  } catch (e) {
    console.error("Error loading gallery meta:", e);
  }
  return [];
}

function saveGallery(data) {
  try {
    fs.writeFileSync(GALLERY_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("Error saving gallery meta:", e);
  }
}

const galleryStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, galleryDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `gallery-${Date.now()}${ext}`);
  },
});
const galleryUpload = multer({ storage: galleryStorage });

// Get all gallery items
app.get("/api/gallery", (req, res) => {
  let gallery = loadGallery();
  const { type, page, limit = 8, search, paginated } = req.query;

  if (search) {
    const q = search.toLowerCase();
    gallery = gallery.filter((item) => {
      const nameMatch = item.itemName && item.itemName.toLowerCase().includes(q);
      const chapterMatch = item.chapterName && item.chapterName.toLowerCase().includes(q);
      return nameMatch || chapterMatch;
    });
  }

  if (type === "classboard") {
    gallery = gallery.filter(
      (item) => item.type === "image" && item.itemName && item.itemName.toLowerCase().startsWith("class")
    );
  } else if (type === "image") {
    gallery = gallery.filter(
      (item) => item.type === "image" && !(item.itemName && item.itemName.toLowerCase().startsWith("class"))
    );
  } else if (type) {
    gallery = gallery.filter((item) => item.type === type);
  }

  if (paginated === "true") {
    const totalItems = gallery.length;
    const limitNum = parseInt(limit, 10) || 8;
    const totalPages = Math.ceil(totalItems / limitNum) || 1;
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const startIndex = (currentPage - 1) * limitNum;
    const paginatedItems = gallery.slice(startIndex, startIndex + limitNum);

    res.json({
      items: paginatedItems,
      pagination: { totalItems, totalPages, currentPage, limit: limitNum }
    });
  } else {
    res.json(gallery);
  }
});

// Upload a new gallery image
app.post("/api/gallery/image", galleryUpload.single("image"), (req, res) => {
  const chapterName = (req.body.chapterName || "Uncategorized").trim();
  const itemName = (req.body.itemName || "Unnamed Image").trim();
  
  const linkUrl = req.body.linkUrl;
  let url = "";

  if (linkUrl) {
    url = linkUrl.trim();
  } else if (req.file) {
    url = "/uploads/gallery/" + req.file.filename;
  } else {
    return res.status(400).json({ error: "No file uploaded or link provided" });
  }

  const gallery = loadGallery();
  const itemType = req.body.type || "image";
  const newItem = {
    id: "img_" + Date.now(),
    type: itemType,
    chapterName,
    itemName,
    url,
    createdAt: new Date().toISOString(),
  };
  gallery.push(newItem);
  saveGallery(gallery);

  res.json({ status: "ok", item: newItem });
});

// Add a new gallery video (YouTube URL)
app.post("/api/gallery/video", (req, res) => {
  const { chapterName, itemName, videoUrl, previewUrl } = req.body;
  if (!videoUrl)
    return res.status(400).json({ error: "No video URL provided" });

  const gallery = loadGallery();
  const newItem = {
    id: "vid_" + Date.now(),
    type: "video",
    chapterName: (chapterName || "Uncategorized").trim(),
    itemName: (itemName || "Unnamed Video").trim(),
    url: videoUrl,
    previewUrl: previewUrl || "",
    createdAt: new Date().toISOString(),
  };
  gallery.push(newItem);
  saveGallery(gallery);

  res.json({ status: "ok", item: newItem });
});

// Update a gallery item
app.put("/api/gallery/:id", galleryUpload.single("image"), (req, res) => {
  const { id } = req.params;
  const gallery = loadGallery();
  const index = gallery.findIndex((g) => g.id === id);
  if (index === -1)
    return res.status(404).json({ error: "Gallery item not found" });

  const item = gallery[index];

  if (req.body.chapterName) item.chapterName = req.body.chapterName.trim();
  if (req.body.itemName) item.itemName = req.body.itemName.trim();

  if (item.type === "video") {
    if (req.body.videoUrl) item.url = req.body.videoUrl;
    if (req.body.previewUrl !== undefined)
      item.previewUrl = req.body.previewUrl;
  } else if ((item.type === "image" || item.type === "pdf") && req.file) {
    // Delete old file
    try {
      const oldPath = path.join(__dirname, item.url);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    } catch (e) { }
    item.url = "/uploads/gallery/" + req.file.filename;
    if (req.body.type) item.type = req.body.type;
  }

  saveGallery(gallery);
  res.json({ status: "ok", item });
});

// Delete a gallery item
app.delete("/api/gallery/:id", (req, res) => {
  const { id } = req.params;
  const gallery = loadGallery();
  const index = gallery.findIndex((g) => g.id === id);
  if (index === -1)
    return res.status(404).json({ error: "Gallery item not found" });

  const item = gallery[index];

  // If it's an image or pdf that was uploaded locally, delete the file
  if ((item.type === "image" || item.type === "pdf") && item.url && item.url.startsWith("/uploads/gallery/")) {
    try {
      const filePath = path.join(__dirname, item.url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) { }
  }

  gallery.splice(index, 1);
  saveGallery(gallery);

  res.json({ status: "ok" });
});

// Force inline display for PDFs to prevent automatic downloading
app.get("/api/view-pdf", (req, res) => {
  const fileUrl = req.query.url;
  if (!fileUrl) return res.status(400).send("No URL");

  // Prevent directory traversal
  const normalizedPath = path.normalize(fileUrl).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, normalizedPath);

  if (!fs.existsSync(filePath)) return res.status(404).send("File not found");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline; filename=\"document.pdf\"");
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

// Serve static files
app.use("/uploads", express.static(uploadsDir));

// Question Bank and Student Performance API
require('./server-qbank')(app, io, uploadsDir);

// Initialize quiz systems
initQuizSystem();

// Initialize maze quiz if file exists
const mazeQuizPath = path.join(uploadsDir, "maze-quiz-questions.xlsx");
if (fs.existsSync(mazeQuizPath)) {
  loadMazeQuizFromExcel(mazeQuizPath);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`
    🚀 Server is running!
    --------------------------------------
    Landing Page:          http://localhost:${PORT}/index.html
    Teacher Hub:           http://localhost:${PORT}/dashboard.html
    --------------------------------------
    Memory Game:           http://localhost:${PORT}/game.html
    Memory Dashboard:      http://localhost:${PORT}/dashboard-memory.html
    --------------------------------------
    Monopoly Game:         http://localhost:${PORT}/game-monopoly.html
    Monopoly Dash:         http://localhost:${PORT}/dashboard-monopoly.html
    --------------------------------------
    Maze Game:             http://localhost:${PORT}/game-maze.html
    Maze Dashboard:        http://localhost:${PORT}/dashboard-maze.html
    --------------------------------------
    Word Puzzle Game:      http://localhost:${PORT}/game-wordpuzzle.html
    Word Puzzle Dash:      http://localhost:${PORT}/dashboard-wordpuzzle.html
    --------------------------------------
    📽️  Presentation Game:  http://localhost:${PORT}/game-presentation.html
    📽️  Presentation Dash:  http://localhost:${PORT}/dashboard-presentation.html
    --------------------------------------
    To access from mobile, use your PC's IP address:
    http://[YOUR-IP]:${PORT}/dashboard.html
    `);
});

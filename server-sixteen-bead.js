const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const XLSX = require("xlsx");
const multer = require("multer");

module.exports = function mountSixteenBead(app, io, uploadsDir) {
  const dataDir = path.join(uploadsDir, "sixteen-bead");
  const statePath = path.join(dataDir, "session.json");
  const creativeFile = path.join(uploadsDir, "creative-questions.xlsx");
  fs.mkdirSync(dataDir, { recursive: true });
  const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

  // Authentic Standard 16-Bead (Sholo Guti) Geometry
  // 37 total points:
  // Top triangle (6 points):
  //   Row 0 (y=0): Left (x=1.0), Center (x=2.0), Right (x=3.0)
  //   Row 1 (y=0.5): Left (x=1.5), Center (x=2.0), Right (x=2.5)
  // Main 5x5 Grid (25 points):
  //   Rows 1..5 (y=1..5): 5 points at each whole-cell height; index 8 and 28
  //   are the top and bottom triangle apexes on the center column.
  // Bottom triangle (6 points):
  //   Row 7 (y=5.5): Left (x=1.5), Center (x=2.0), Right (x=2.5)
  //   Row 8 (y=6): Left (x=1.0), Center (x=2.0), Right (x=3.0)

  const points = [
    // Top triangle (0..5)
    { x: 1.0, y: 0 }, { x: 2.0, y: 0 }, { x: 3.0, y: 0 },
    { x: 1.5, y: 0.5 }, { x: 2.0, y: 0.5 }, { x: 2.5, y: 0.5 },

    // 5x5 Grid (6..30)
    // 5x5 grid starts one equal cell below the top row.
    { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 },
    { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 },
    { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 },
    { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 },
    { x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 },

    // Bottom triangle (31..36)
    // Bottom triangle uses half-cell spacing to keep its diagonals at 45°.
    { x: 1.5, y: 5.5 }, { x: 2.0, y: 5.5 }, { x: 2.5, y: 5.5 },
    { x: 1.0, y: 6 }, { x: 2.0, y: 6 }, { x: 3.0, y: 6 }
  ];

  // 24 continuous straight line tracks representing all physical lines on the court
  const tracks = [
    // 9 Horizontal tracks
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8, 9, 10],
    [11, 12, 13, 14, 15],
    [16, 17, 18, 19, 20],
    [21, 22, 23, 24, 25],
    [26, 27, 28, 29, 30],
    [31, 32, 33],
    [34, 35, 36],

    // 5 Vertical tracks
    [6, 11, 16, 21, 26],
    [7, 12, 17, 22, 27],
    [1, 4, 8, 13, 18, 23, 28, 32, 35], // Full center vertical track from top to bottom
    [9, 14, 19, 24, 29],
    [10, 15, 20, 25, 30],

    // 4 Triangle radiating tracks
    [0, 3, 8],
    [2, 5, 8],
    [28, 31, 34],
    [28, 33, 36],

    // 2 Main diagonals across 5x5
    [6, 12, 18, 24, 30],  // Top-left to bottom-right
    [10, 14, 18, 22, 26], // Top-right to bottom-left

    // 4 Diamond diagonals in 5x5
    [8, 12, 16], // (2,2) to (0,4)
    [8, 14, 20], // (2,2) to (4,4)
    [16, 22, 28], // (0,4) to (2,6)
    [20, 24, 28]  // (4,4) to (2,6)
  ];

  const edges = new Set();
  const neighbors = Array.from({ length: points.length }, () => []);

  tracks.forEach(track => {
    // Collect 1-step edges
    for (let i = 0; i < track.length - 1; i++) {
      const a = Math.min(track[i], track[i + 1]);
      const b = Math.max(track[i], track[i + 1]);
      edges.add(`${a}:${b}`);
    }
  });

  for (let i = 0; i < points.length; i++) {
    for (let j = 0; j < points.length; j++) {
      if (i !== j && edges.has(`${Math.min(i, j)}:${Math.max(i, j)}`)) {
        neighbors[i].push(j);
      }
    }
  }

  const clone = value => JSON.parse(JSON.stringify(value));
  const teamImageNames = value => Object.values(value?.teamImageFiles || {}).filter(Boolean);
  const imagePath = filename => path.join(dataDir, path.basename(String(filename || "")));
  const cleanupUnreferencedImages = () => {
    const retained = new Set([...teamImageNames(session), ...Object.values(savedSessions).flatMap(teamImageNames)]);
    for (const file of fs.readdirSync(dataDir)) {
      if (/^team-[a-f0-9-]+\.(?:jpg|png|webp)$/i.test(file) && !retained.has(file)) {
        try { fs.unlinkSync(imagePath(file)); } catch (_) {}
      }
    }
  };
  let session = null, savedSessions = {}, activeSessionName = null;

  try {
    const stored = JSON.parse(fs.readFileSync(statePath, "utf8"));
    savedSessions = stored.savedSessions && typeof stored.savedSessions === "object" ? stored.savedSessions : {};
    activeSessionName = stored.activeSessionName || null;
    session = stored.session || (stored.id ? { ...stored } : null);
    if (session) {
      delete session.savedSessions;
      delete session.activeSessionName;
      delete session.session;
      // If loaded session does not match 37 points, reset
      if (!Array.isArray(session.board) || session.board.length !== points.length) {
        session = null;
      }
    }
  } catch (_) {}

  let persistRetryTimer = null;
  let persistRetryAttempt = 0;
  let lastPersistError = null;
  const persist = () => {
    const tempPath = `${statePath}.${process.pid}.tmp`;
    try {
      const contents = JSON.stringify({ session, savedSessions, activeSessionName }, null, 2);
      fs.writeFileSync(tempPath, contents);
      fs.renameSync(tempPath, statePath);
      persistRetryAttempt = 0;
      lastPersistError = null;
      if (persistRetryTimer) {
        clearTimeout(persistRetryTimer);
        persistRetryTimer = null;
      }
    } catch (error) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
      const errorKey = `${error.code || "error"}:${error.message}`;
      if (errorKey !== lastPersistError) {
        console.error("Sixteen Bead session save failed; keeping the live game running and retrying:", error);
        lastPersistError = errorKey;
      }
      persistRetryAttempt++;
      if (!persistRetryTimer) {
        const delay = Math.min(5000, 250 * (2 ** Math.min(persistRetryAttempt - 1, 4)));
        persistRetryTimer = setTimeout(() => {
          persistRetryTimer = null;
          persist();
        }, delay);
        persistRetryTimer.unref?.();
      }
    }
  };

  const teamPieces = (team, board = session?.board) => {
    if (!board) return [];
    return board.flatMap((value, index) => value === team ? [index] : []);
  };

  const captureMoves = (team, board = session?.board, from = null) => {
    if (!board) return [];
    const starts = from === null ? teamPieces(team, board) : [from];
    const opponent = team === "blue" ? "red" : "blue";
    const moves = [];

    starts.forEach(start => {
      if (board[start] !== team) return;
      neighbors[start].forEach(capture => {
        if (board[capture] !== opponent) return;
        // A capture follows two connected board edges. The path may turn at
        // the captured bead where the drawn court lines meet (e.g. point
        // 4 -> 8 -> 12), as well as continue straight.
        neighbors[capture].forEach(to => {
          if (to !== start && !board[to]) moves.push({ from: start, to, capture });
        });
      });
    });

    return moves;
  };

  const simpleMoves = (team, board = session?.board, from = null) => {
    if (!board) return [];
    const starts = from === null ? teamPieces(team, board) : [from];
    const moves = [];

    starts.forEach(start => {
      if (board[start] === team) {
        neighbors[start].forEach(to => {
          if (!board[to]) {
            moves.push({ from: start, to, capture: null });
          }
        });
      }
    });

    return moves;
  };

  const legalMoves = (team, board = session?.board, from = null) => {
    if (!board) return [];
    // Captures are available choices, not compulsory moves. Keep ordinary
    // adjacent moves in the move list even when a jump capture is possible.
    return [
      ...simpleMoves(team, board, from),
      ...captureMoves(team, board, from)
    ];
  };

  const publicState = () => {
    if (!session) return null;
    const available = session.status === "playing" && session.credits[session.currentTeam] > 0
      ? legalMoves(session.currentTeam, session.board, session.continuationFrom ?? session.selectedFrom)
      : [];
    const q = session.currentQuestion;
    const question = q ? (q.judgement ? { ...q } : {
      passage: q.passage || "",
      passage_image: q.passage_image || "",
      type: q.type,
      prompt: q.prompt,
      number: q.number,
      team: q.team,
      judgement: null
    }) : null;

    return {
      id: session.id,
      status: session.status,
      board: [...session.board],
      credits: { ...session.credits },
      currentTeam: session.currentTeam,
      counts: { blue: teamPieces("blue").length, red: teamPieces("red").length },
      questionNumber: session.questionNumber,
      questionCount: session.questions.length,
      currentQuestion: question,
      questionVisible: !!session.questionVisible,
      winner: session.winner || null,
      result: session.result || null,
      teamImages: { ...(session.teamImages || {}) },
      selectedFrom: session.continuationFrom ?? session.selectedFrom ?? null,
      continuationFrom: session.continuationFrom ?? null,
      legalMoves: available,
      captureAvailable: available.some(move => move.capture !== null),
      lastMove: session.lastMove || null,
      points,
      tracks,
      edges: [...edges].map(key => key.split(":").map(Number))
    };
  };

  cleanupUnreferencedImages();

  const broadcast = () => {
    if (session) session.savedAt = new Date().toISOString();
    if (session && activeSessionName && savedSessions[activeSessionName]) {
      savedSessions[activeSessionName] = clone(session);
    }
    persist();
    io.emit("sixteen-bead:state", publicState());
  };

  const finish = winner => {
    if (!session || session.status === "finished") return;
    session.status = "finished";
    session.questionVisible = false;
    session.winner = winner || null;
    session.result = winner ? `${winner === "blue" ? "Team Blue" : "Team Red"} wins!` : "Match ended by teacher.";
    session.selectedFrom = null;
    session.continuationFrom = null;
    broadcast();
  };

  const nextQuestion = () => {
    if (!session.questions.length) return null;
    if (session.questionCursor >= session.questions.length) session.questionCursor = 0;
    const question = session.questions[session.questionCursor++];
    session.questionNumber++;
    session.currentQuestion = {
      ...question,
      number: session.questionNumber,
      team: session.currentTeam,
      judgement: null
    };
    session.questionVisible = true;
    return session.currentQuestion;
  };

  // REST APIs
  app.get("/api/sixteen-bead/sessions", (_req, res) => res.json({ sessions: savedSessions, activeSessionName }));

  app.post("/api/sixteen-bead/sessions/:name", (req, res) => {
    const name = String(req.params.name || "").trim(), snapshot = session ? clone(session) : null;
    if (!name || !snapshot) return res.status(400).json({ error: "Enter a session name and start a game first." });
    savedSessions[name] = snapshot;
    activeSessionName = name;
    cleanupUnreferencedImages();
    persist();
    res.json({ sessions: savedSessions, activeSessionName });
  });

  app.post("/api/sixteen-bead/sessions/:name/restore", (req, res) => {
    const name = String(req.params.name || "").trim();
    if (!savedSessions[name]) return res.status(404).json({ error: "Saved session not found." });
    session = clone(savedSessions[name]);
    activeSessionName = name;
    broadcast();
    res.json({ state: publicState(), sessions: savedSessions, activeSessionName });
  });

  app.delete("/api/sixteen-bead/sessions/:name", (req, res) => {
    const name = String(req.params.name || "").trim();
    if (!savedSessions[name]) return res.status(404).json({ error: "Saved session not found." });
    delete savedSessions[name];
    if (activeSessionName === name) {
      activeSessionName = null;
      session = null;
      io.emit("sixteen-bead:state", null);
    }
    cleanupUnreferencedImages();
    persist();
    res.json({ sessions: savedSessions, activeSessionName });
  });

  app.post("/api/sixteen-bead/new", imageUpload.fields([{ name: "blueImage", maxCount: 1 }, { name: "redImage", maxCount: 1 }]), (req, res) => {
    try {
      const rawQuestionIds = req.body?.questionIds;
      const selected = Array.isArray(rawQuestionIds) ? rawQuestionIds : JSON.parse(rawQuestionIds || "[]");
      const workbook = XLSX.readFile(creativeFile);
      const all = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      const byId = new Map(all.map(q => [String(q.id), q]));

      const questions = selected.map(item => {
        const row = byId.get(String(item.id)), type = item.type;
        if (!row || !["knowledge", "understanding"].includes(type)) return null;
        const prompt = String(row[type] || "").trim();
        return prompt ? {
          passage: String(row.passage || ""),
          passage_image: String(row.passage_image || ""),
          type,
          prompt,
          answer: String(row[type === "knowledge" ? "answer_k" : "answer_u"] || "")
        } : null;
      }).filter(Boolean);

      if (!questions.length) return res.status(400).json({ error: "Load at least one knowledge or understanding question." });

      const uploaded = { blue: req.files?.blueImage?.[0], red: req.files?.redImage?.[0] };
      for (const file of Object.values(uploaded)) {
        if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
          return res.status(400).json({ error: "Team pictures must be JPG, PNG, or WebP images." });
        }
      }
      const teamImages = {}, teamImageFiles = {};
      for (const team of ["blue", "red"]) {
        const file = uploaded[team];
        if (!file) continue;
        const ext = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
        const filename = `team-${crypto.randomUUID()}.${ext}`;
        fs.writeFileSync(imagePath(filename), file.buffer);
        teamImageFiles[team] = filename;
        teamImages[team] = `/uploads/sixteen-bead/${filename}`;
      }

      // Standard initial setup:
      // Rows 0..3 (indices 0..15) -> 16 blue beads (top)
      // Row 4 (indices 16..20) -> empty (middle row)
      // Rows 5..8 (indices 21..36) -> 16 red beads (bottom)
      const board = Array(points.length).fill(null);
      points.forEach(({ y }, i) => {
        if (y <= 3) board[i] = "blue";
        else if (y >= 5) board[i] = "red";
      });

      session = {
        id: crypto.randomUUID(),
        status: "playing",
        teamImages,
        teamImageFiles,
        board,
        credits: { blue: 0, red: 0 },
        currentTeam: "blue",
        questions,
        questionNumber: 0,
        questionCursor: 0,
        currentQuestion: null,
        questionVisible: false,
        selectedFrom: null,
        continuationFrom: null,
        lastMove: null,
        winner: null,
        result: null
      };

      activeSessionName = null;
      cleanupUnreferencedImages();
      broadcast();
      res.json({ state: publicState() });
    } catch (error) {
      cleanupUnreferencedImages();
      console.error("Sixteen Bead setup error:", error);
      res.status(400).json({ error: "Could not create Sixteen Bead match." });
    }
  });

  app.delete("/api/sixteen-bead/current", (_req, res) => {
    session = null;
    activeSessionName = null;
    cleanupUnreferencedImages();
    persist();
    io.emit("sixteen-bead:state", null);
    res.json({ status: "ok" });
  });

  // Socket Connections
  io.on("connection", socket => {
    socket.on("sixteen-bead:join", ({ role } = {}) => {
      socket.data.sixteenBeadRole = role === "teacher" ? "teacher" : "projector";
      socket.emit("sixteen-bead:state", publicState());
      if (role === "teacher" && session?.currentQuestion && !session.currentQuestion.judgement) {
        socket.emit("sixteen-bead:teacher-answer", {
          number: session.currentQuestion.number,
          answer: session.currentQuestion.answer || "Answer key unavailable"
        });
      }
    });

    socket.on("sixteen-bead:ask", () => {
      if (socket.data.sixteenBeadRole !== "teacher" || !session || session.status !== "playing") return;
      if (session.currentQuestion && !session.currentQuestion.judgement) return;
      const question = nextQuestion();
      if (!question) return;
      socket.emit("sixteen-bead:teacher-answer", {
        number: question.number,
        answer: question.answer || "Answer key unavailable"
      });
      io.emit("sixteen-bead:question-asked", { number: question.number });
      broadcast();
    });

    socket.on("sixteen-bead:judge", ({ correct } = {}) => {
      if (socket.data.sixteenBeadRole !== "teacher" || !session || session.status !== "playing") return;
      if (!session.currentQuestion || session.currentQuestion.judgement) return;

      session.currentQuestion.judgement = correct === true ? "correct" : "wrong";
      if (correct === true) {
        session.credits[session.currentTeam] += 10;
      }
      broadcast();
    });

    socket.on("sixteen-bead:question-visibility", ({ visible } = {}) => {
      if (socket.data.sixteenBeadRole !== "teacher" || !session || !session.currentQuestion) return;
      session.questionVisible = visible === true;
      broadcast();
    });

    socket.on("sixteen-bead:select", ({ point } = {}) => {
      if (!session || session.status !== "playing") return;
      if (point === null) {
        if (session.continuationFrom !== null && session.continuationFrom !== undefined) return;
        session.selectedFrom = null;
        broadcast();
        return;
      }
      if (!Number.isInteger(point) || point < 0 || point >= points.length) return;
      if (session.board[point] !== session.currentTeam || session.credits[session.currentTeam] <= 0) return;
      if (session.continuationFrom !== null && session.continuationFrom !== undefined && point !== session.continuationFrom) return;

      const moves = legalMoves(session.currentTeam, session.board, point);
      if (!moves.length) return;

      session.selectedFrom = point;
      broadcast();
    });

    socket.on("sixteen-bead:move", ({ from, to } = {}) => {
      if (!session || session.status !== "playing") return;
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= points.length || to < 0 || to >= points.length) return;
      if (session.credits[session.currentTeam] <= 0 || session.board[from] !== session.currentTeam) return;

      const forcedFrom = session.continuationFrom ?? session.selectedFrom;
      if (forcedFrom !== from) return;

      const moves = legalMoves(session.currentTeam, session.board, forcedFrom);
      const move = moves.find(candidate => candidate.to === to);
      if (!move) return;

      // Execute move
      session.board[to] = session.board[from];
      session.board[from] = null;
      session.credits[session.currentTeam]--;
      session.lastMove = { from, to, capture: move.capture, team: session.currentTeam };

      if (move.capture !== null) {
        session.board[move.capture] = null;
      }

      const opponent = session.currentTeam === "blue" ? "red" : "blue";

      // Check if opponent is completely wiped out
      if (teamPieces(opponent).length === 0) {
        return finish(session.currentTeam);
      }

      // Check for multi-jump continuation:
      // If move was a capture jump, team still has credits, and another capture exists from 'to'
      if (move.capture !== null && session.credits[session.currentTeam] > 0 && captureMoves(session.currentTeam, session.board, to).length) {
        session.continuationFrom = to;
        session.selectedFrom = to;
        broadcast();
        return;
      }

      // Move turn is complete -> hand over to opponent
      session.continuationFrom = null;
      session.selectedFrom = null;
      session.currentTeam = opponent;
      session.currentQuestion = null;
      session.questionVisible = false;

      // Check if opponent is blocked (stalemate)
      if (!simpleMoves(opponent).length && !captureMoves(opponent).length) {
        return finish(opponent === "blue" ? "red" : "blue");
      }

      broadcast();
    });

    // Switch / Pass turn (always allowed by teacher, or when player chooses to end continuation)
    socket.on("sixteen-bead:switch", () => {
      if (!session || session.status !== "playing") return;
      session.continuationFrom = null;
      session.selectedFrom = null;
      session.currentTeam = session.currentTeam === "blue" ? "red" : "blue";
      session.currentQuestion = null;
      session.questionVisible = false;
      broadcast();
    });

    socket.on("sixteen-bead:finish", () => {
      if (socket.data.sixteenBeadRole === "teacher" && session?.status === "playing") {
        finish(null);
      }
    });
  });
};

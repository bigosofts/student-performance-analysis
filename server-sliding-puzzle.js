const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const XLSX = require("xlsx");

module.exports = function mountSlidingPuzzle(app, io, uploadsDir) {
  const imageDir = path.join(uploadsDir, "sliding-puzzle");
  const statePath = path.join(imageDir, "session.json");
  const creativeFile = path.join(uploadsDir, "creative-questions.xlsx");
  fs.mkdirSync(imageDir, { recursive: true });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
  let session = null, savedSessions = {}, activeSessionName = null;
  try {
    const stored = JSON.parse(fs.readFileSync(statePath, "utf8"));
    savedSessions = stored.savedSessions && typeof stored.savedSessions === "object" ? stored.savedSessions : {};
    activeSessionName = stored.activeSessionName || null;
    session = stored.session || (stored.id ? { ...stored } : null);
    if (session) { delete session.savedSessions; delete session.activeSessionName; delete session.session; }
  } catch (_) {}

  const safeImagePath = filename => path.join(imageDir, path.basename(String(filename || "")));
  const removeImage = filename => {
    if (!filename) return;
    try { fs.unlinkSync(safeImagePath(filename)); } catch (_) {}
  };
  const persist = () => fs.writeFileSync(statePath, JSON.stringify({ session, savedSessions, activeSessionName }, null, 2));
  const clone = value => JSON.parse(JSON.stringify(value));
  const sessionImages = value => (value?.imageFiles || [value?.imageFile, ...Object.values(value?.imageUrls || {}).map(url => path.basename(String(url || "")))]).filter(Boolean);
  const cleanupUnreferencedImages = () => {
    const retained = new Set([...sessionImages(session), ...Object.values(savedSessions).flatMap(sessionImages)]);
    for (const file of fs.readdirSync(imageDir)) if (/^puzzle-[a-f0-9-]+\.jpg$/i.test(file) && !retained.has(file)) removeImage(file);
  };
  const solvedBoard = () => Array.from({ length: 15 }, (_, i) => i + 1).concat(0);
  const shuffleBoard = () => {
    const goal = solvedBoard();
    let board;
    do {
      board = [...goal];
      for (let i = board.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [board[i], board[j]] = [board[j], board[i]];
      }
      const inversions = board.filter(Boolean).reduce((n, v, i, a) => n + a.slice(i + 1).filter(x => x && x < v).length, 0);
      const blankRowFromBottom = 4 - Math.floor(board.indexOf(0) / 4);
      if ((inversions + blankRowFromBottom) % 2 === 1 && board.some((v, i) => v !== goal[i])) return board;
    } while (true);
  };
  if (session && !session.boards) {
    const previousBoard = Array.isArray(session.board) ? session.board : shuffleBoard();
    session.boards = { blue:[...previousBoard], red:[...previousBoard] };
  }
  const boardProgress = board => board.reduce((n, tile, index) => n + (tile !== 0 && tile === index + 1 ? 1 : 0), 0);
  const publicState = () => {
    if (!session) return null;
    const q = session.currentQuestion;
    const revealedQuestion = q && q.judgement ? { ...q } : q ? { passage:q.passage || "", passage_image:q.passage_image || "", type:q.type, prompt:q.prompt, number:q.number, team:q.team, judgement:null } : null;
    const activeBoard = session.boards?.[session.currentTeam] || session.board;
    return {
      id:session.id, status:session.status, imageUrl:session.imageUrls?.[session.currentTeam] || session.imageUrl, imageUrls:session.imageUrls || { blue:session.imageUrl, red:session.imageUrl }, board:activeBoard,
      boards: session.boards ? { blue: [...session.boards.blue], red: [...session.boards.red] } : { blue: activeBoard, red: activeBoard },
      currentTeam:session.currentTeam, credits:session.credits, questionNumber:session.questionNumber,
      teamProgress:{ blue:boardProgress(session.boards?.blue || activeBoard), red:boardProgress(session.boards?.red || activeBoard) },
      questionCount:session.questions.length, currentQuestion:revealedQuestion, questionVisible:!!session.questionVisible, referenceVisible:!!session.referenceVisible,
      winner:session.winner, result:session.result || null
    };
  };
  const broadcast = () => {
    if (session && activeSessionName && savedSessions[activeSessionName]) savedSessions[activeSessionName] = clone(session);
    persist(); io.emit("sliding-puzzle:state", publicState());
  };
  const getPrivateQuestion = () => session && session.currentQuestion;
  const canManage = socket => socket.data.slidingPuzzleRole === "teacher";
  const judge = (socket, correct) => {
    const q = getPrivateQuestion();
    if (!canManage(socket) || !session || session.status !== "playing" || !q || q.judgement) return;
    q.judgement = correct ? "correct" : "wrong";
    if (correct) session.credits[session.currentTeam] += 100;
    broadcast();
  };
  const finish = winner => {
    if (!session || session.status === "finished") return;
    session.status = "finished";
    session.questionVisible = false;
    session.winner = winner || null;
    session.result = winner ? `${winner === "blue" ? "Team Blue" : "Team Red"} completed the picture!` : "The puzzle was ended by the teacher.";
    broadcast();
    // Keep a winner's pictures available for the projector congratulations screen.
    // Teacher end/reset and DELETE remove the files explicitly.
    if (!winner) {
      session.imageFiles = [];
      session.imageFile = null;
    }
    cleanupUnreferencedImages();
    persist();
  };

  cleanupUnreferencedImages();
  app.get("/api/sliding-puzzle/saved-sessions", (_req, res) => res.json({ sessions:savedSessions, activeSessionName }));
  app.post("/api/sliding-puzzle/saved-sessions/:name", (req, res) => {
    const name = String(req.params.name || "").trim();
    const incoming = req.body?.session;
    const snapshot = incoming ? clone(incoming) : session ? clone(session) : null;
    if (!name || !snapshot) return res.status(400).json({ error:"A session name and active puzzle are required." });
    if (incoming && (!snapshot.questions?.length) && session?.questions?.length) snapshot.questions = clone(session.questions);
    const files = sessionImages(snapshot);
    if (files.some(file => !/^puzzle-[a-f0-9-]+\.jpg$/i.test(file) || !fs.existsSync(safeImagePath(file)))) {
      return res.status(400).json({ error:"This saved session's picture files are no longer available. Save the active game to create a fresh session." });
    }
    snapshot.imageFiles = [...new Set(files)];
    if (!snapshot.boards && snapshot.board) snapshot.boards = { blue:[...snapshot.board], red:[...snapshot.board] };
    savedSessions[name] = snapshot;
    activeSessionName = name;
    if (!incoming) session = clone(snapshot);
    persist();
    res.json({ sessions:savedSessions, activeSessionName });
  });
  app.post("/api/sliding-puzzle/saved-sessions/:name/restore", (req, res) => {
    const name = String(req.params.name || "").trim(), snapshot = savedSessions[name];
    if (!snapshot) return res.status(404).json({ error:"Saved session not found." });
    const missing = sessionImages(snapshot).filter(file => !fs.existsSync(safeImagePath(file)));
    if (missing.length) return res.status(409).json({ error:"One or more saved session pictures are missing." });
    session = clone(snapshot);
    session.boards ||= { blue:[...(session.board || solvedBoard())], red:[...(session.board || solvedBoard())] };
    session.credits ||= { blue:0, red:0 };
    session.questions ||= [];
    session.questionCursor ||= session.questionNumber || 0;
    session.imageFiles = [...new Set(sessionImages(session))];
    activeSessionName = name;
    broadcast();
    res.json({ state:publicState(), sessions:savedSessions, activeSessionName });
  });
  app.delete("/api/sliding-puzzle/saved-sessions/:name", (req, res) => {
    const name = String(req.params.name || "").trim();
    if (!savedSessions[name]) return res.status(404).json({ error:"Saved session not found." });
    delete savedSessions[name];
    if (activeSessionName === name) { activeSessionName = null; session = null; io.emit("sliding-puzzle:state", null); }
    cleanupUnreferencedImages();
    persist();
    res.json({ sessions:savedSessions, activeSessionName });
  });
  app.post("/api/sliding-puzzle/sessions", upload.fields([{name:"blueImage",maxCount:1},{name:"redImage",maxCount:1},{name:"image",maxCount:1}]), (req, res) => {
    try {
      const blueFile = req.files?.blueImage?.[0] || req.files?.image?.[0], redFile = req.files?.redImage?.[0] || blueFile;
      if (!blueFile || !blueFile.mimetype.startsWith("image/") || !redFile || !redFile.mimetype.startsWith("image/")) return res.status(400).json({ error:"Choose a picture for both teams." });
      const selections = JSON.parse(req.body.questionIds || "[]");
      if (!Array.isArray(selections) || !selections.length) return res.status(400).json({ error:"Load at least one CQ question." });
      const workbook = XLSX.readFile(creativeFile);
      const allQuestions = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      const byId = new Map(allQuestions.map(q => [String(q.id), q]));
      const questions = selections.map(item => {
        const record = byId.get(String(typeof item === "object" ? item.id : item));
        const type = typeof item === "object" ? item.type : "knowledge";
        if (!record || !["knowledge", "understanding"].includes(type)) return null;
        const prompt = String(record[type] || "").trim();
        return prompt ? { passage:String(record.passage || ""), passage_image:String(record.passage_image || ""), type, prompt, answer:String(record[type === "knowledge" ? "answer_k" : "answer_u"] || "") } : null;
      }).filter(Boolean);
      if (!questions.length) return res.status(400).json({ error:"No knowledge or understanding questions matched the selected filters." });
      const files = { blue:`puzzle-${crypto.randomUUID()}.jpg`, red:`puzzle-${crypto.randomUUID()}.jpg` };
      fs.writeFileSync(path.join(imageDir, files.blue), blueFile.buffer);
      fs.writeFileSync(path.join(imageDir, files.red), redFile.buffer);
      const imageUrls = { blue:`/uploads/sliding-puzzle/${files.blue}`, red:`/uploads/sliding-puzzle/${files.red}` };
      session = {
        id:crypto.randomUUID(), status:"playing", imageFiles:[files.blue,files.red], imageUrls, imageFile:files.blue, imageUrl:imageUrls.blue,
        boards:(() => { const firstBoard = shuffleBoard(); return { blue:[...firstBoard], red:[...firstBoard] }; })(), currentTeam:"blue", credits:{blue:0,red:0},
        questions,
        questionNumber:0, questionCursor:0, currentQuestion:null, questionVisible:false, winner:null, result:null
      };
      activeSessionName = null;
      cleanupUnreferencedImages();
      broadcast();
      res.json({ id:session.id, state:publicState() });
    } catch (err) {
      console.error("Sliding Puzzle session error:", err);
      res.status(400).json({ error:"Could not create the Sliding Puzzle session." });
    }
  });
  app.get("/api/sliding-puzzle/current", (_req, res) => session ? res.json(publicState()) : res.status(404).json({ error:"No Sliding Puzzle session is active." }));
  app.delete("/api/sliding-puzzle/current", (_req, res) => {
    session = null; activeSessionName = null; cleanupUnreferencedImages(); persist(); io.emit("sliding-puzzle:state", null); res.json({ status:"ok" });
  });

  io.on("connection", socket => {
    socket.on("sliding-puzzle:join", ({ role } = {}) => {
      socket.data.slidingPuzzleRole = role === "teacher" ? "teacher" : "projector";
      socket.emit("sliding-puzzle:state", publicState());
      if (socket.data.slidingPuzzleRole === "teacher" && session?.currentQuestion && !session.currentQuestion.judgement) {
        socket.emit("sliding-puzzle:teacher-answer", { number:session.currentQuestion.number, answer:session.currentQuestion.answer || "Answer key unavailable" });
      }
    });
    socket.on("sliding-puzzle:ask", () => {
      if (!canManage(socket) || !session || session.status !== "playing" || session.currentQuestion && !session.currentQuestion.judgement) return;
      if (session.questionCursor >= session.questions.length) session.questionCursor = 0;
      const question = session.questions[session.questionCursor++];
      session.questionNumber++;
      session.currentQuestion = { ...question, number:session.questionNumber, team:session.currentTeam, judgement:null };
      session.questionVisible = true;
      socket.emit("sliding-puzzle:teacher-answer", { number:session.questionNumber, answer:session.currentQuestion.answer || "Answer key unavailable" });
      broadcast();
    });
    socket.on("sliding-puzzle:judge", ({ correct } = {}) => judge(socket, correct === true));
    socket.on("sliding-puzzle:question-visibility", ({ visible } = {}) => {
      if (!canManage(socket) || !session || session.status !== "playing" || !session.currentQuestion) return;
      session.questionVisible = visible === true;
      broadcast();
    });
    socket.on("sliding-puzzle:reference-visibility", ({ visible } = {}) => {
      if (!session || session.status !== "playing") return;
      if (!canManage(socket) && socket.data.slidingPuzzleRole !== "projector") return;
      session.referenceVisible = visible === true;
      broadcast();
    });
    socket.on("sliding-puzzle:switch", () => {
      if (!canManage(socket) || !session || session.status !== "playing") return;
      session.currentTeam = session.currentTeam === "blue" ? "red" : "blue";
      session.currentQuestion = null;
      session.questionVisible = false;
      broadcast();
    });
    socket.on("sliding-puzzle:move", ({ index } = {}) => {
      if (!canManage(socket) || !session || session.status !== "playing" || !Number.isInteger(index)) return;
      const team = session.currentTeam, board = session.boards[team], blank = board.indexOf(0);
      const adjacent = Math.abs(Math.floor(index / 4) - Math.floor(blank / 4)) + Math.abs(index % 4 - blank % 4) === 1;
      if (!adjacent || session.credits[team] <= 0) return;
      [board[index], board[blank]] = [board[blank], board[index]];
      session.credits[team]--;
      if (board.every((tile, i) => tile === solvedBoard()[i])) {
        finish(team);
        return;
      }
      broadcast();
    });
    socket.on("sliding-puzzle:finish", () => {
      if (canManage(socket)) finish(null);
    });
    socket.on("sliding-puzzle:restore-session", (data, callback) => {
      if (!canManage(socket)) return callback && callback({ success: false, error: "Not authorized" });
      if (!data || !data.session) return callback && callback({ success: false, error: "No session data" });
      const snap = data.session;
      const blueB = snap.boards?.blue || snap.board || solvedBoard();
      const redB = snap.boards?.red || snap.board || solvedBoard();
      if (!session) {
        session = {
          id: snap.id || crypto.randomUUID(),
          status: snap.status || "playing",
          imageFiles: snap.imageFiles || [],
          imageUrls: snap.imageUrls || { blue: snap.imageUrl || "", red: snap.imageUrl || "" },
          imageFile: snap.imageFile || null,
          imageUrl: snap.imageUrl || snap.imageUrls?.blue || "",
          boards: { blue: [...blueB], red: [...redB] },
          currentTeam: snap.currentTeam || "blue",
          credits: snap.credits ? { ...snap.credits } : { blue: 0, red: 0 },
          questions: snap.questions || [],
          questionNumber: snap.questionNumber || 0,
          questionCursor: snap.questionCursor || snap.questionNumber || 0,
          currentQuestion: snap.currentQuestion || null,
          questionVisible: !!snap.questionVisible,
          referenceVisible: !!snap.referenceVisible,
          winner: snap.winner || null,
          result: snap.result || null,
        };
      } else {
        session.status = snap.status || "playing";
        if (snap.imageUrls) session.imageUrls = { ...snap.imageUrls };
        if (snap.imageUrl !== undefined) session.imageUrl = snap.imageUrl;
        session.boards = { blue: [...blueB], red: [...redB] };
        if (snap.credits) session.credits = { ...snap.credits };
        if (snap.currentTeam) session.currentTeam = snap.currentTeam;
        if (snap.questionNumber !== undefined) session.questionNumber = snap.questionNumber;
        if (snap.currentQuestion !== undefined) session.currentQuestion = snap.currentQuestion;
        if (snap.questions && snap.questions.length) session.questions = snap.questions;
        if (snap.questionVisible !== undefined) session.questionVisible = !!snap.questionVisible;
        if (snap.referenceVisible !== undefined) session.referenceVisible = !!snap.referenceVisible;
        session.winner = snap.winner || null;
        session.result = snap.result || null;
      }
      broadcast();
      callback && callback({ success: true, state: publicState() });
    });
  });
};

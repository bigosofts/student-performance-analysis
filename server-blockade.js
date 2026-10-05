/**
 * Blockade 3D — Server-side Session & Socket Handlers
 * ────────────────────────────────────────────────────
 * Isolated module: manages Blockade sessions, rooms,
 * join codes, player assignment, and authoritative validation.
 */

const fs = require("fs");
const path = require("path");
const engine = require("./js/blockade-engine");

module.exports = function (io, uploadsDir) {
  // ─── Session Storage ────────────────────────────────────────
  const sessions = new Map(); // sessionId → state
  const codeToSession = new Map(); // code → sessionId
  const socketToSession = new Map(); // socketId → { sessionId, role }

  const BLOCKADE_HISTORY_FILE = path.join(uploadsDir, "blockade-history.json");

  function loadHistory() {
    try {
      if (fs.existsSync(BLOCKADE_HISTORY_FILE)) {
        return JSON.parse(fs.readFileSync(BLOCKADE_HISTORY_FILE, "utf8"));
      }
    } catch (e) {
      console.error("[Blockade] Error loading history:", e);
    }
    return [];
  }

  function saveHistory(data) {
    try {
      fs.writeFileSync(
        BLOCKADE_HISTORY_FILE,
        JSON.stringify(data, null, 2),
        "utf8"
      );
    } catch (e) {
      console.error("[Blockade] Error saving history:", e);
    }
  }

  function saveSessionToHistory(state) {
    const history = loadHistory();
    const record = {
      sessionId: state.sessionId,
      code: state.code,
      title: state.title,
      mode: state.mode,
      phase: state.phase,
      players: Object.values(state.players).map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        rank: p.rank,
        credits: p.credits,
        wallsRemaining: p.wallsRemaining,
        studentName: p.studentName,
      })),
      rankings: state.rankings,
      questionHistory: state.questionHistory,
      wallCount: state.walls.length,
      createdAt: state.createdAt,
      completedAt: new Date().toISOString(),
    };
    // Replace existing or append
    const idx = history.findIndex((h) => h.sessionId === state.sessionId);
    if (idx >= 0) history[idx] = record;
    else history.push(record);
    saveHistory(history);
  }

  // ─── Join Code Generator ────────────────────────────────────
  function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code;
    let attempts = 0;
    do {
      code = "";
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      attempts++;
    } while (codeToSession.has(code) && attempts < 100);
    return code;
  }

  function generateSessionId() {
    return "blk_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
  }

  // ─── Room Helpers ───────────────────────────────────────────
  function roomName(sessionId) {
    return `blockade_${sessionId}`;
  }

  function broadcastState(sessionId) {
    const state = sessions.get(sessionId);
    if (!state) return;
    // Send state without correct answer info
    const safeState = JSON.parse(JSON.stringify(state));
    if (safeState.currentQuestion) {
      delete safeState.currentQuestion.correctAnswer;
    }
    io.to(roomName(sessionId)).emit("blockade:state", safeState);
  }

  function broadcastStateToTeacher(sessionId) {
    const state = sessions.get(sessionId);
    if (!state) return;
    // Teacher gets full state including correct answer
    io.to(roomName(sessionId) + "_teacher").emit(
      "blockade:teacher-state",
      state
    );
  }

  // ─── Quiz System ──────────────────────────────────────────
  let quizQuestions = [];
  const XLSX = require("xlsx");

  function loadQuiz() {
    quizQuestions = [];
    const filePath = path.join(uploadsDir, "blockade-quiz-questions.xlsx");
    if (!fs.existsSync(filePath)) return;
    try {
      const wb = XLSX.readFile(filePath);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      if (data && data.length > 0) {
        // Map to format
        quizQuestions = data.map(r => ({
          question: r.Question || "",
          options: [r["Option A"] || "", r["Option B"] || "", r["Option C"] || "", r["Option D"] || ""],
          answer: (r.Answer || "A").toString().toUpperCase().trim()
        }));
        // Shuffle
        quizQuestions.sort(() => 0.5 - Math.random());
        console.log(`[Blockade] Loaded ${quizQuestions.length} quiz questions`);
      }
    } catch (e) {
      console.error("[Blockade] Error loading quiz excel:", e);
    }
  }

  global.reloadBlockadeQuiz = loadQuiz;
  loadQuiz(); // Load on startup

  // ─── Socket Event Handlers ─────────────────────────────────
  io.on("connection", (socket) => {
    // ── Create Session ──────────────────────────────────────
    socket.on("blockade:create-session", (data, callback) => {
      const sessionId = generateSessionId();
      const code = generateCode();
      const state = engine.createInitialState(sessionId, code, "two-player");

      sessions.set(sessionId, state);
      codeToSession.set(code, sessionId);

      socket.join(roomName(sessionId));
      socketToSession.set(socket.id, {
        sessionId,
        role: "game-screen",
      });

      console.log(
        `[Blockade] Session created: ${sessionId} with code ${code}`
      );

      if (typeof callback === "function") {
        callback({ success: true, sessionId, code, state });
      }
    });

    // ── Join Session (Controller / Student) ─────────────────
    socket.on("blockade:join-session", (data, callback) => {
      if (!data || !data.code) {
        return callback && callback({ success: false, error: "No code provided" });
      }

      const code = data.code.toUpperCase().trim();
      const sessionId = codeToSession.get(code);

      if (!sessionId || !sessions.has(sessionId)) {
        return (
          callback && callback({ success: false, error: "Invalid session code" })
        );
      }

      const state = sessions.get(sessionId);
      const role = data.role || "teacher"; // 'teacher' or 'student'
      const playerSlot = data.playerSlot || null;

      socket.join(roomName(sessionId));

      if (role === "teacher") {
        socket.join(roomName(sessionId) + "_teacher");
      }

      socketToSession.set(socket.id, {
        sessionId,
        role,
        playerSlot,
      });

      // If student joining with a player slot, assign them
      if (role === "student" && playerSlot && state.players[playerSlot]) {
        state.players[playerSlot].controller = socket.id;
        state.players[playerSlot].studentName =
          data.studentName || "Student " + playerSlot;
        state.updatedAt = new Date().toISOString();
        broadcastState(sessionId);
        broadcastStateToTeacher(sessionId);
      }

      console.log(
        `[Blockade] ${role} joined session ${sessionId} (code: ${code})`
      );

      if (typeof callback === "function") {
        const safeState = JSON.parse(JSON.stringify(state));
        if (role !== "teacher" && safeState.currentQuestion) {
          delete safeState.currentQuestion.correctAnswer;
        }
        callback({ success: true, sessionId, state: safeState });
      }
    });

    // ── Set Session Title ───────────────────────────────────
    socket.on("blockade:set-title", (data) => {
      const info = socketToSession.get(socket.id);
      if (!info) return;
      const state = sessions.get(info.sessionId);
      if (!state) return;
      if (data && data.title) {
        state.title = String(data.title).substring(0, 200);
        state.updatedAt = new Date().toISOString();
        broadcastState(info.sessionId);
        broadcastStateToTeacher(info.sessionId);
      }
    });

    // ── Configure Mode ──────────────────────────────────────
    socket.on("blockade:set-mode", (data, callback) => {
      const info = socketToSession.get(socket.id);
      if (!info) return callback && callback({ success: false, error: "Not in a session" });
      const state = sessions.get(info.sessionId);
      if (!state) return callback && callback({ success: false, error: "Session not found" });
      if (state.phase !== "waiting") {
        return callback && callback({ success: false, error: "Game already started" });
      }

      const mode = data && data.mode === "four-player" ? "four-player" : "two-player";
      const newState = engine.createInitialState(state.sessionId, state.code, mode);
      newState.title = state.title;
      sessions.set(info.sessionId, newState);
      broadcastState(info.sessionId);
      broadcastStateToTeacher(info.sessionId);
      callback && callback({ success: true });
    });

    // ── Start Game ──────────────────────────────────────────
    socket.on("blockade:start-game", (data, callback) => {
      const info = socketToSession.get(socket.id);
      if (!info)
        return callback && callback({ success: false, error: "Not in session" });
      const state = sessions.get(info.sessionId);
      if (!state)
        return callback && callback({ success: false, error: "Session not found" });
      if (state.phase !== "waiting") {
        return (
          callback && callback({ success: false, error: "Game already started" })
        );
      }

      state.phase = "active";
      state.currentPlayerId = 1;
      state.updatedAt = new Date().toISOString();

      broadcastState(info.sessionId);
      broadcastStateToTeacher(info.sessionId);
      console.log(`[Blockade] Game started: ${info.sessionId}`);
      callback && callback({ success: true });
    });

    // ── Move ────────────────────────────────────────────────
    socket.on("blockade:move", (data, callback) => {
      const info = socketToSession.get(socket.id);
      if (!info)
        return callback && callback({ success: false, error: "Not in session" });
      const state = sessions.get(info.sessionId);
      if (!state)
        return callback && callback({ success: false, error: "Session not found" });

      const playerId = data && data.playerId;
      if (!playerId)
        return callback && callback({ success: false, error: "No player specified" });

      // Verify controller authority
      const player = state.players[playerId];
      if (!player)
        return callback && callback({ success: false, error: "Invalid player" });

      // Teacher or assigned controller
      if (
        info.role !== "teacher" &&
        info.role !== "game-screen" &&
        player.controller !== socket.id
      ) {
        return (
          callback &&
          callback({ success: false, error: "Not authorized to control this player" })
        );
      }

      const result = engine.applyMove(state, playerId, {
        row: data.row,
        col: data.col,
      });

      if (!result.valid) {
        return callback && callback({ success: false, error: result.error });
      }

      sessions.set(info.sessionId, result.state);
      broadcastState(info.sessionId);
      broadcastStateToTeacher(info.sessionId);

      if (result.state.phase === "completed") {
        saveSessionToHistory(result.state);
      }

      callback && callback({ success: true });
    });

    // ── Place Wall ──────────────────────────────────────────
    socket.on("blockade:place-wall", (data, callback) => {
      const info = socketToSession.get(socket.id);
      if (!info)
        return callback && callback({ success: false, error: "Not in session" });
      const state = sessions.get(info.sessionId);
      if (!state)
        return callback && callback({ success: false, error: "Session not found" });

      const playerId = data && data.playerId;
      if (!playerId)
        return callback && callback({ success: false, error: "No player specified" });

      const player = state.players[playerId];
      if (!player)
        return callback && callback({ success: false, error: "Invalid player" });

      if (
        info.role !== "teacher" &&
        info.role !== "game-screen" &&
        player.controller !== socket.id
      ) {
        return (
          callback &&
          callback({ success: false, error: "Not authorized" })
        );
      }

      const result = engine.applyWall(state, playerId, {
        row: data.row,
        col: data.col,
        orientation: data.orientation,
      });

      if (!result.valid) {
        return callback && callback({ success: false, error: result.error });
      }

      sessions.set(info.sessionId, result.state);
      broadcastState(info.sessionId);
      broadcastStateToTeacher(info.sessionId);
      callback && callback({ success: true });
    });

    // ── Request Question ────────────────────────────────────
    socket.on("blockade:request-question", (data, callback) => {
      const info = socketToSession.get(socket.id);
      if (!info)
        return callback && callback({ success: false, error: "Not in session" });
      const state = sessions.get(info.sessionId);
      if (!state)
        return callback && callback({ success: false, error: "Session not found" });

      const targetPlayerId = data && data.targetPlayerId;
      if (!targetPlayerId || !state.players[targetPlayerId]) {
        return (
          callback &&
          callback({ success: false, error: "Invalid target player" })
        );
      }

      // Prevent requesting a new question while one is active
      if (state.currentQuestion && !state.currentQuestion.answered) {
        return (
          callback &&
          callback({
            success: false,
            error: "A question is already active",
          })
        );
      }

      if (quizQuestions.length === 0) {
        return callback && callback({ success: false, error: "No questions available in Q-Bank (import first)" });
      }

      const q = quizQuestions.pop();
      const questionId = "bq_" + Date.now();

      state.currentQuestion = {
        questionId: questionId,
        targetPlayerId: targetPlayerId,
        question: q.question,
        options: q.options,
        image: null,
        correctAnswer: q.answer,
        answered: false,
        submittedAnswer: null,
        result: null,
      };
      state.updatedAt = new Date().toISOString();

      broadcastState(info.sessionId);
      broadcastStateToTeacher(info.sessionId);
      callback && callback({ success: true });
    });

    // ── Submit Answer ───────────────────────────────────────
    socket.on("blockade:submit-answer", (data, callback) => {
      const info = socketToSession.get(socket.id);
      if (!info)
        return callback && callback({ success: false, error: "Not in session" });
      const state = sessions.get(info.sessionId);
      if (!state)
        return callback && callback({ success: false, error: "Session not found" });

      if (!state.currentQuestion || state.currentQuestion.answered) {
        return (
          callback &&
          callback({ success: false, error: "No active question or already answered" })
        );
      }

      const targetPlayerId = state.currentQuestion.targetPlayerId;
      const player = state.players[targetPlayerId];

      // Verify submitter is authorized (teacher or assigned student)
      if (
        info.role !== "teacher" &&
        info.role !== "game-screen" &&
        player.controller !== socket.id
      ) {
        return (
          callback &&
          callback({
            success: false,
            error: "Not authorized to submit answer",
          })
        );
      }

      const submittedAnswer = (data.answer || "").toString().toUpperCase();
      const correctAnswer = state.currentQuestion.correctAnswer;
      const isCorrect = submittedAnswer === correctAnswer;

      state.currentQuestion.answered = true;
      state.currentQuestion.submittedAnswer = submittedAnswer;
      state.currentQuestion.result = isCorrect ? "correct" : "incorrect";

      if (isCorrect) {
        const creditResult = engine.awardCredits(
          state,
          targetPlayerId,
          engine.CREDITS_PER_CORRECT
        );
        if (creditResult.valid) {
          // Merge credit change into state
          state.players[targetPlayerId].credits =
            creditResult.state.players[targetPlayerId].credits;
        }
      }

      // Record in question history
      state.questionHistory.push({
        questionId: state.currentQuestion.questionId,
        targetPlayerId: targetPlayerId,
        question: state.currentQuestion.question,
        submittedAnswer: submittedAnswer,
        correctAnswer: correctAnswer,
        result: state.currentQuestion.result,
        creditsAwarded: isCorrect ? engine.CREDITS_PER_CORRECT : 0,
        timestamp: new Date().toISOString(),
      });

      state.updatedAt = new Date().toISOString();

      // Broadcast result with correct answer revealed
      io.to(roomName(info.sessionId)).emit("blockade:answer-result", {
        result: state.currentQuestion.result,
        correctAnswer: correctAnswer,
        submittedAnswer: submittedAnswer,
        creditsAwarded: isCorrect ? engine.CREDITS_PER_CORRECT : 0,
        targetPlayerId: targetPlayerId,
      });

      broadcastState(info.sessionId);
      broadcastStateToTeacher(info.sessionId);
      callback && callback({ success: true, correct: isCorrect });
    });

    // ── Close Question ──────────────────────────────────────
    socket.on("blockade:close-question", (data) => {
      const info = socketToSession.get(socket.id);
      if (!info) return;
      const state = sessions.get(info.sessionId);
      if (!state) return;

      state.currentQuestion = null;
      state.updatedAt = new Date().toISOString();
      broadcastState(info.sessionId);
      broadcastStateToTeacher(info.sessionId);
    });

    // ── Cancel Session ──────────────────────────────────────
    socket.on("blockade:cancel-session", (data, callback) => {
      const info = socketToSession.get(socket.id);
      if (!info)
        return callback && callback({ success: false, error: "Not in session" });
      const state = sessions.get(info.sessionId);
      if (!state)
        return callback && callback({ success: false, error: "Session not found" });

      state.phase = "cancelled";
      state.updatedAt = new Date().toISOString();
      saveSessionToHistory(state);
      broadcastState(info.sessionId);
      broadcastStateToTeacher(info.sessionId);

      callback && callback({ success: true });
    });

    // ── Assign Player ───────────────────────────────────────
    socket.on("blockade:assign-player", (data) => {
      const info = socketToSession.get(socket.id);
      if (!info) return;
      const state = sessions.get(info.sessionId);
      if (!state) return;

      const { playerId, name } = data || {};
      if (playerId && state.players[playerId]) {
        state.players[playerId].studentName = name || state.players[playerId].name;
        state.updatedAt = new Date().toISOString();
        broadcastState(info.sessionId);
        broadcastStateToTeacher(info.sessionId);
      }
    });

    // ── Get State (reconnect) ───────────────────────────────
    socket.on("blockade:get-state", (data, callback) => {
      const code = data && data.code ? data.code.toUpperCase().trim() : null;
      let sessionId = null;

      if (code) {
        sessionId = codeToSession.get(code);
      } else {
        const info = socketToSession.get(socket.id);
        if (info) sessionId = info.sessionId;
      }

      if (!sessionId || !sessions.has(sessionId)) {
        return callback && callback({ success: false, error: "Session not found" });
      }

      const state = sessions.get(sessionId);
      const safeState = JSON.parse(JSON.stringify(state));
      if (safeState.currentQuestion) {
        delete safeState.currentQuestion.correctAnswer;
      }
      callback && callback({ success: true, state: safeState });
    });

    // ── Disconnect ──────────────────────────────────────────
    socket.on("disconnect", () => {
      const info = socketToSession.get(socket.id);
      if (info) {
        const state = sessions.get(info.sessionId);
        if (state) {
          // Mark player as disconnected but don't remove
          for (const [pid, p] of Object.entries(state.players)) {
            if (p.controller === socket.id) {
              p.controller = null;
              console.log(
                `[Blockade] Player ${pid} controller disconnected in session ${info.sessionId}`
              );
            }
          }
          broadcastState(info.sessionId);
          broadcastStateToTeacher(info.sessionId);
        }
        socketToSession.delete(socket.id);
      }
    });
  });
};

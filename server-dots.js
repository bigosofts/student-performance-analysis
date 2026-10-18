const fs = require("fs");
const path = require("path");
const engine = require("./js/dots-engine");
const QUESTION_CREDIT_REWARD = 5;
module.exports = function (io, uploadsDir) {
  const sessions = new Map(), sockets = new Map(), historyFile = path.join(uploadsDir, "dots-history.json");
  let activeSessionId = null;
  const XLSX = require("xlsx");
  let questions = [];
  function loadQuestions() {
    try { const wb = XLSX.readFile(path.join(uploadsDir, "dots-quiz-questions.xlsx")); questions = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]); }
    catch (_) { questions = []; }
  }
  loadQuestions(); global.reloadDotsQuiz = loadQuestions;
  function saveHistory(s) { let all = []; try { all = JSON.parse(fs.readFileSync(historyFile, "utf8")); } catch (_) {} const i = all.findIndex(x => x.sessionName === s.sessionName); const snap = JSON.parse(JSON.stringify(s)); if (i < 0) all.push(snap); else all[i] = snap; try { fs.writeFileSync(historyFile, JSON.stringify(all, null, 2)); } catch (e) { console.error("[Dots] history save failed", e); } }
  function room(id) { return `dots_${id}`; }
  function safeState(s) { engine.normalizeState(s); const safe = JSON.parse(JSON.stringify(s)); if (safe.question) for (const k of ["answer", "Answer", "correctAnswer", "q2_answer"]) delete safe.question[k]; return safe; }
  function broadcast(id) { const s = sessions.get(id); if (s) io.to(room(id)).emit("dots:state", safeState(s)); }
  function info(socket) { const id = sockets.get(socket.id); return id && sessions.get(id); }
  function normalizeAnswer(value) { const answer = String(value || "").trim().toUpperCase(); return ({ "1": "A", "2": "B", "3": "C", "4": "D" })[answer] || answer; }
  function save(s) { s.updatedAt = Date.now(); broadcast(s.sessionId); }
  io.on("connection", socket => {
    socket.on("dots:create-session", (_, cb) => {
      let state = activeSessionId && sessions.get(activeSessionId);
      if (!state) {
        const sessionId = `dots_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        state = engine.createState();
        state.sessionId = sessionId;
        state.code = Math.random().toString(36).slice(2, 8).toUpperCase();
        sessions.set(sessionId, state);
        activeSessionId = sessionId;
      }
      sockets.set(socket.id, state.sessionId);
      socket.join(room(state.sessionId));
      cb && cb({ success: true, sessionId: state.sessionId, code: state.code, state: safeState(state) });
    });
    socket.on("dots:join-session", (data, cb) => { const code = String(data?.code || "").toUpperCase(); const s = [...sessions.values()].find(x => x.code === code) || sessions.get(data?.sessionId); if (!s) return cb?.({ success: false, error: "Session not found. Create it from the dashboard first." }); engine.normalizeState(s); sockets.set(socket.id, s.sessionId); socket.join(room(s.sessionId)); cb?.({ success: true, state: safeState(s) }); });
    socket.on("dots:get-teacher-question", () => { const s = info(socket); socket.emit("dots:teacher-question", s?.question || null); });
    socket.on("dots:place-edge", (data, cb) => { const s = info(socket); if (!s) return cb?.({ success: false, error: "Join a session first" }); engine.normalizeState(s); if (s.credits[s.activeTeam] < 1) return cb?.({ success: false, error: "Credits depleted! Answer a question to continue drawing." }); const result = engine.placeEdge(s, data?.edge, s.activeTeam); if (!result.ok) return cb?.(result); s.credits[s.activeTeam] = Math.max(0, s.credits[s.activeTeam] - 1); save(s); cb?.({ success: true, score: result.score, captured: result.captured }); });
    socket.on("dots:request-question", (data, cb) => { const s = info(socket); if (!s) return cb?.({ success: false, error: "Join a session first" }); if (!questions.length) loadQuestions(); if (!questions.length) return cb?.({ success: false, error: "Import questions first" }); const row = questions[Math.floor(Math.random() * questions.length)]; const targetTeam = engine.TEAMS.includes(data?.team) ? data.team : "blue"; const q = { ...row, targetTeam, id: `${Date.now()}` }; s.question = q; const publicQuestion = { ...q }; for (const k of ["answer", "Answer", "correctAnswer", "q2_answer"]) delete publicQuestion[k]; io.to(room(s.sessionId)).emit("dots:question", publicQuestion); save(s); cb?.({ success: true }); });
    socket.on("dots:submit-answer", (data, cb) => { const s = info(socket); if (!s?.question) return cb?.({ success: false }); const q = s.question; const submitted = normalizeAnswer(data?.answer); const submitted2 = normalizeAnswer(data?.answer2); const answer = normalizeAnswer(q.Answer || q.answer || "A"); const answer2 = normalizeAnswer(q.q2_answer); const correct = submitted === answer && (!q.question2 || submitted2 === answer2); const awarded = correct ? QUESTION_CREDIT_REWARD : 0; if (correct) s.credits[q.targetTeam] = (s.credits[q.targetTeam] || 0) + awarded; s.question = null; const result = { success: true, result: correct ? "correct" : "incorrect", correctAnswer: answer, submittedAnswer: submitted, creditsAwarded: awarded, team: q.targetTeam }; io.to(room(s.sessionId)).emit("dots:answer-result", result); save(s); cb?.(result); });
    socket.on("dots:teacher-mark", data => { const s = info(socket); if (!s?.question) return; const team = s.question.targetTeam; const correct = data?.correct === true; if (correct) s.credits[team] = (s.credits[team] || 0) + QUESTION_CREDIT_REWARD; s.question = null; io.to(room(s.sessionId)).emit("dots:answer-result", { result: correct ? "correct" : "incorrect", correctAnswer: "", submittedAnswer: "", creditsAwarded: correct ? QUESTION_CREDIT_REWARD : 0, team }); save(s); });
    socket.on("dots:update-credit", data => { const s = info(socket); if (!s || !engine.TEAMS.includes(data?.team)) return; const team = data.team, delta = Number(data?.delta ?? 0); if (!Number.isFinite(delta)) return; engine.normalizeState(s); s.credits[team] = Math.max(0, Math.min(9999, s.credits[team] + delta)); save(s); });
    socket.on("dots:switch-turn", () => { const s = info(socket); if (s) { s.activeTeam = engine.TEAMS[(engine.TEAMS.indexOf(s.activeTeam) + 1) % engine.TEAMS.length]; save(s); } });
    socket.on("dots:update-settings", data => { const s = info(socket); if (!s) return; const fields = ["title", "sessionName", "className", "section", ...engine.TEAMS.flatMap(t => [`${t}Name`, `${t}Image`])]; for (const k of fields) if (data && data[k] !== undefined) s[k] = String(data[k]).slice(0, 200); save(s); });
    socket.on("dots:generate-board", data => { const s = info(socket); if (!s) return; if (data?.fresh) { s.scores = Object.fromEntries(engine.TEAMS.map(t => [t, 0])); s.boxes = {}; } s.edges = engine.generateBoard(); delete s.lastEdge; s.activeTeam = "blue"; save(s); });
    socket.on("dots:save-session", data => { const s = info(socket); if (!s) return; if (data?.name) s.sessionName = String(data.name).slice(0, 100); saveHistory(s); save(s); });
    socket.on("dots:list-sessions", cb => { try { const all = JSON.parse(fs.readFileSync(historyFile, "utf8")); cb?.(all.map(x => x.sessionName).filter(Boolean)); } catch (_) { cb?.([]); } });
    socket.on("dots:restore-session", data => { const s = info(socket); if (!s) return; try { const all = JSON.parse(fs.readFileSync(historyFile, "utf8")); const found = all.find(x => x.sessionName === data?.name); if (found && engine.isValidState(found)) { const id = s.sessionId, code = s.code; Object.assign(s, found, { sessionId: id, code }); engine.normalizeState(s); save(s); } } catch (_) {} });
    socket.on("dots:delete-session", data => { try { const all = JSON.parse(fs.readFileSync(historyFile, "utf8")).filter(x => x.sessionName !== data?.name); fs.writeFileSync(historyFile, JSON.stringify(all, null, 2)); io.to(room(sockets.get(socket.id))).emit("dots:sessions", all.map(x => x.sessionName)); } catch (_) {} });
    socket.on("dots:announce-winner", data => { const s = info(socket); if (!s) return; s.winner = engine.TEAMS.includes(data?.winner) ? data.winner : "draw"; s.className = String(data?.className || ""); s.section = String(data?.section || ""); const result = { winner: s.winner, className: s.className, section: s.section }; for (const t of engine.TEAMS) { result[`${t}Image`] = s[`${t}Image`]; result[`${t}Name`] = s[`${t}Name`]; } io.to(room(s.sessionId)).emit("dots:winner", result); save(s); });
    socket.on("dots:close-winner", () => { const s = info(socket); if (s) { s.winner = null; save(s); } });
    socket.on("disconnect", () => sockets.delete(socket.id));
  });
};

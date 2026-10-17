(() => {
  const socket = io();
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const labels = { blue:"Team Blue", red:"Team Red" };
  let questions = [], selectedImages = { blue:null, red:null }, selectedPortraits = { blue:null, red:null }, state = null, teacherAnswer = null, teacherAnswerNumber = 0, projectorSessionId = null;

  function tileStyle(tile, imageUrl) {
    if (!tile) return "";
    const source = tile - 1, x = source % 4, y = Math.floor(source / 4);
    return `--puzzle-image:url('${esc(imageUrl)}');--tile-x:${x * 100 / 3}%;--tile-y:${y * 100 / 3}%`;
  }
  function renderBoard(target, s, interactive) {
    if (!target || !s) return;
    target.classList.toggle("solved-board", s.status === "finished" && !!s.winner);
    target.style.setProperty("--puzzle-image", `url('${s.imageUrls?.[s.currentTeam] || s.imageUrl}')`);
    if (s.status === "finished" && s.winner) {
      target.innerHTML = '<div class="puzzle-complete-art" aria-label="Completed picture"></div>';
      return;
    }
    const blank = s.board.indexOf(0), team = s.currentTeam;
    const canMove = interactive && s.status === "playing" && s.credits[team] > 0;
    target.innerHTML = s.board.map((tile, index) => {
      if (!tile) return '<div class="slide-tile empty" aria-label="Empty space"></div>';
      const adjacent = Math.abs(Math.floor(index / 4) - Math.floor(blank / 4)) + Math.abs(index % 4 - blank % 4) === 1;
      const style = tileStyle(tile, s.imageUrl);
      return `<button class="slide-tile" style="${style}" ${interactive ? `type="button" data-tile-index="${index}" ${canMove && adjacent ? "" : "disabled"} aria-label="Slide tile ${tile}"` : "type=button disabled aria-hidden=true"}></button>`;
    }).join("");
    if (interactive) target.querySelectorAll("[data-tile-index]").forEach(button => button.addEventListener("click", () => socket.emit("sliding-puzzle:move", { index:Number(button.dataset.tileIndex) })));
  }
  function renderQuestion(target, q, teacher = false) {
    if (!target) return;
    if (!q) { target.innerHTML = '<div class="empty-question">Choose a team and ask a CQ question to begin.</div>'; return; }
    const image = q.passage_image ? `<img class="cq-image" src="/uploads/qbank-images/${encodeURIComponent(q.passage_image)}" alt="Question passage illustration">` : "";
    target.innerHTML = `<div class="cq-kicker">${esc(q.type || "knowledge")} QUESTION ${q.number} · ${esc(labels[q.team])}</div>` +
      `${q.passage ? `<div class="cq-passage"><small>READ THE PASSAGE</small><p>${esc(q.passage)}</p>${image}</div>` : image}` +
      `<h2>${esc(q.prompt || q.knowledge || "")}</h2>` +
      (q.judgement ? `<div class="cq-answer ${q.judgement}"><b>${q.judgement === "correct" ? "✓ Correct answer" : "↻ Review the answer"}</b><p>${esc(q.answer || "Answer key unavailable")}</p></div>` : teacher && teacherAnswerNumber === q.number ? `<div class="teacher-answer-key"><small>TEACHER ANSWER KEY</small><p>${esc(teacherAnswer || "Answer key unavailable")}</p></div><p class="awaiting-mark">Mark the team's spoken answer.</p>` : '<p class="awaiting-mark">Teacher: review the answer and mark it correct or incorrect.</p>');
  }
  function render(s, mode) {
    state = s;
    const empty = $("noSession");
    if (!s) {
      if (mode === "projector" && $("winnerOverlay")) $("winnerOverlay").hidden = true;
      if (empty) empty.hidden = false;
      if (mode === "teacher" && $("gamePanel")) $("gamePanel").hidden = true;
      if (mode === "projector") { $("projectorLayout").hidden = true; $("questionOverlay").hidden = true; document.querySelector(".projector-wait").hidden = false; }
      return;
    }
    if (empty) empty.hidden = true;
    if (mode === "teacher" && $("gamePanel")) $("gamePanel").hidden = false;
    if (mode === "projector") { $("projectorLayout").hidden = false; $("questionOverlay").hidden = !(s.questionVisible && s.currentQuestion); document.querySelector(".projector-wait").hidden = true; }
    if (mode === "projector") {
      const won = s.status === "finished" && !!s.winner;
      $("winnerOverlay").hidden = !won;
      if (won) { $("winnerTitle").textContent = `Congratulations, ${labels[s.winner]}!`; $("winnerMessage").textContent = "Your team rebuilt the picture together!"; $("winnerImage").src = s.imageUrls?.[s.winner] || s.imageUrl; }
    }
    const referenceVisible = !!s.referenceVisible;
    $("teacherBoardFlip")?.classList.toggle("is-flipped", referenceVisible);
    $("projectorBoardFlip")?.classList.toggle("is-flipped", referenceVisible);
    if ($("toggleReference")) $("toggleReference").textContent = referenceVisible ? "↩ Back to puzzle" : "🖼️ Flip to full picture";
    if ($("toggleProjectorReference")) $("toggleProjectorReference").textContent = referenceVisible ? "Back to puzzle" : "See full picture";
    document.querySelectorAll("[data-blue-credit]").forEach(el => el.textContent = s.credits.blue);
    document.querySelectorAll("[data-red-credit]").forEach(el => el.textContent = s.credits.red);
    document.querySelectorAll("[data-blue-progress]").forEach(el => el.textContent = `${s.teamProgress?.blue ?? 0} / 15`);
    document.querySelectorAll("[data-red-progress]").forEach(el => el.textContent = `${s.teamProgress?.red ?? 0} / 15`);
    document.querySelectorAll("[data-blue-progress-bar]").forEach(el => el.style.width = `${Math.min(100, (s.teamProgress?.blue ?? 0) / 15 * 100)}%`);
    document.querySelectorAll("[data-red-progress-bar]").forEach(el => el.style.width = `${Math.min(100, (s.teamProgress?.red ?? 0) / 15 * 100)}%`);
    document.querySelectorAll("[data-team]").forEach(el => el.classList.toggle("is-active", el.dataset.team === s.currentTeam));
    document.querySelectorAll("[data-turn-name]").forEach(el => el.textContent = labels[s.currentTeam]);
    document.querySelectorAll("[data-team-photo]").forEach(img => {
      const src = s.teamPortraitUrls?.[img.dataset.teamPhoto];
      img.hidden = !src;
      if (src && img.dataset.src !== src) { img.src = src; img.dataset.src = src; }
    });
    document.querySelectorAll("[data-question-count]").forEach(el => el.textContent = `${s.questionNumber} / ${s.questionCount}`);
    if (mode === "teacher") {
      $("referenceImage").src = s.imageUrls?.[s.currentTeam] || s.imageUrl;
      $("toggleReference").disabled = s.status !== "playing";
    } else {
      if (projectorSessionId !== s.id) projectorSessionId = s.id;
      $("projectorReferenceImage").src = s.imageUrls?.[s.currentTeam] || s.imageUrl;
      $("projectorBoardFlip").setAttribute("aria-label", `${labels[s.currentTeam]} puzzle board; activate the picture preview button to flip`);
      document.querySelectorAll("[data-board-team]").forEach(el => el.textContent = labels[s.currentTeam].toUpperCase());
    }
    renderBoard($(mode === "teacher" ? "teacherBoard" : "gameBoard"), s, mode === "teacher");
    if (mode === "teacher") {
      if (s.currentQuestion && s.currentQuestion.number !== teacherAnswerNumber) teacherAnswer = null;
      renderQuestion($("teacherQuestion"), s.currentQuestion, true);
      const ready = s.currentQuestion && !s.currentQuestion.judgement;
      $("markCorrect").disabled = !ready; $("markWrong").disabled = !ready;
      $("askQuestion").disabled = s.status !== "playing" || (s.currentQuestion && !s.currentQuestion.judgement);
      $("switchTeam").textContent = `Switch to ${labels[s.currentTeam === "blue" ? "red" : "blue"]}`;
      $("toggleQuestion").textContent = s.questionVisible ? "Hide projector question" : "Show projector question";
      $("toggleQuestion").disabled = !s.currentQuestion || s.status !== "playing";
      $("moveHelp").textContent = s.credits[s.currentTeam] > 0 ? `${s.credits[s.currentTeam]} slide credits · tap a highlighted tile beside the empty space` : "No slide credits. Ask a CQ question or switch teams.";
      $("gameStatus").textContent = s.status === "finished" ? s.result : "Live session";
      $("gameCode").textContent = s.id.slice(0, 6).toUpperCase();
    } else {
      renderQuestion($("gameQuestion"), s.currentQuestion);
      $("gameStatus").textContent = s.status === "finished" ? s.result : "Puzzle in progress";
    }
    autoSaveSPGame(s);
    if (mode === "teacher") updateSPSessionBadge();
  }
  socket.on("sliding-puzzle:state", s => render(s, document.body.dataset.page));
  socket.on("sliding-puzzle:teacher-answer", data => { teacherAnswer = data.answer; teacherAnswerNumber = data.number; if (state) render(state, "teacher"); });
  socket.on("classroom-navigate", data => { if (data?.url) window.location.href = data.url; });

  // ─── Persistence & Session Management (Browser LocalStorage) ─
  const SP_STORAGE_KEY = "slidingpuzzle-game-v1";
  const SP_SESSIONS_KEY = "slidingpuzzle-sessions-v1";
  const SP_CURRENT_SESSION_KEY = "slidingpuzzle-current-session";
  let spCurrentSessionName = null;

  function buildSPSessionSnapshot(s) {
    if (!s) return null;
    return {
      id: s.id,
      status: s.status,
      board: s.board ? [...s.board] : null,
      boards: s.boards ? JSON.parse(JSON.stringify(s.boards)) : (s.board ? { blue: [...s.board], red: [...s.board] } : null),
      credits: s.credits ? { ...s.credits } : { blue: 0, red: 0 },
      currentTeam: s.currentTeam || "blue",
      imageUrl: s.imageUrl || "",
      imageUrls: s.imageUrls ? { ...s.imageUrls } : { blue: s.imageUrl || "", red: s.imageUrl || "" },
      teamPortraitUrls: s.teamPortraitUrls ? { ...s.teamPortraitUrls } : {},
      teamPortraitFiles: s.teamPortraitFiles ? { ...s.teamPortraitFiles } : {},
      teamProgress: s.teamProgress ? { ...s.teamProgress } : { blue: 0, red: 0 },
      questionNumber: s.questionNumber || 0,
      questionCount: s.questionCount || 0,
      currentQuestion: s.currentQuestion ? JSON.parse(JSON.stringify(s.currentQuestion)) : null,
      questionVisible: !!s.questionVisible,
      referenceVisible: !!s.referenceVisible,
      winner: s.winner || null,
      result: s.result || null,
      savedAt: new Date().toISOString(),
    };
  }

  function getSPSessions() {
    try {
      const data = localStorage.getItem(SP_SESSIONS_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  function saveSPSession(sessionName, s) {
    if (!sessionName || !sessionName.trim()) return false;
    sessionName = sessionName.trim();
    const snap = buildSPSessionSnapshot(s || state);
    if (!snap) return false;
    try {
      localStorage.setItem(SP_CURRENT_SESSION_KEY, sessionName);
      localStorage.setItem(SP_STORAGE_KEY, JSON.stringify(snap));
    } catch (e) {}
    spCurrentSessionName = sessionName;
    return true;
  }

  function cacheSPSessions(sessions, activeName) {
    try {
      localStorage.setItem(SP_SESSIONS_KEY, JSON.stringify(sessions || {}));
      if (activeName) {
        localStorage.setItem(SP_CURRENT_SESSION_KEY, activeName);
        if (sessions?.[activeName]) localStorage.setItem(SP_STORAGE_KEY, JSON.stringify(sessions[activeName]));
      }
      else localStorage.removeItem(SP_CURRENT_SESSION_KEY);
    } catch (e) {}
    spCurrentSessionName = activeName || null;
  }

  async function syncSPSessions() {
    try {
      const legacy = getSPSessions();
      const response = await fetch("/api/sliding-puzzle/saved-sessions");
      if (!response.ok) throw Error("Could not sync saved sessions.");
      let data = await response.json();
      // Import browser-only saves created by the older session manager once.
      if (!Object.keys(data.sessions || {}).length && Object.keys(legacy).length) {
        let skipped = 0;
        for (const [name, saved] of Object.entries(legacy)) {
          try {
            const imported = await fetch(`/api/sliding-puzzle/saved-sessions/${encodeURIComponent(name)}`, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ session:saved }) });
            if (!imported.ok) skipped++;
          } catch (_) { skipped++; }
        }
        const refreshed = await fetch("/api/sliding-puzzle/saved-sessions");
        if (refreshed.ok) data = await refreshed.json();
        if (skipped) showSPToast(`${skipped} older session(s) could not sync because their image files are missing.`);
      }
      cacheSPSessions(data.sessions, data.activeSessionName);
      refreshSPSessionDropdown();
      return data;
    } catch (_) {
      refreshSPSessionDropdown();
      return null;
    }
  }

  async function loadSPSession(sessionName) {
    try {
      const response = await fetch(`/api/sliding-puzzle/saved-sessions/${encodeURIComponent(sessionName)}/restore`, { method:"POST" });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Could not restore session.");
      cacheSPSessions(data.sessions, data.activeSessionName);
      try { localStorage.setItem(SP_STORAGE_KEY, JSON.stringify(data.state)); } catch (_) {}
      refreshSPSessionDropdown();
      showSPToast(`🔄 Session "${sessionName}" loaded!`);
      return true;
    } catch (error) {
      alert(error.message || "Could not restore session on server.");
      return false;
    }
  }

  async function deleteSPSession(sessionName) {
    const response = await fetch(`/api/sliding-puzzle/saved-sessions/${encodeURIComponent(sessionName)}`, { method:"DELETE" });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "Could not delete saved session.");
    cacheSPSessions(data.sessions, data.activeSessionName);
    refreshSPSessionDropdown();
  }

  function getSPCurrentSessionName() {
    if (!spCurrentSessionName) {
      try {
        spCurrentSessionName = localStorage.getItem(SP_CURRENT_SESSION_KEY) || null;
      } catch (e) {}
    }
    return spCurrentSessionName;
  }

  function autoSaveSPGame(s) {
    if (!s) return;
    try {
      const snap = buildSPSessionSnapshot(s);
      localStorage.setItem(SP_STORAGE_KEY, JSON.stringify(snap));
      const activeName = getSPCurrentSessionName();
      if (activeName) {
        const sessions = getSPSessions();
        sessions[activeName] = { ...(sessions[activeName] || {}), ...snap };
        localStorage.setItem(SP_SESSIONS_KEY, JSON.stringify(sessions));
      }
    } catch (e) {}
  }

  function showSPToast(msg) {
    let t = $("spToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "spToast";
      t.style.cssText = "position:fixed;bottom:24px;right:24px;background:#1e1b4b;color:#a5b4fc;border:1px solid #6366f1;padding:12px 20px;border-radius:12px;font-size:0.85rem;font-weight:700;box-shadow:0 10px 25px rgba(0,0,0,0.5);z-index:99999;transition:opacity 0.3s;pointer-events:none;";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    setTimeout(() => { t.style.opacity = "0"; }, 2800);
  }

  function refreshSPSessionDropdown() {
    const dropdown = $("spSessionDropdown");
    if (!dropdown) return;
    const sessions = getSPSessions();
    const currentName = getSPCurrentSessionName();
    dropdown.innerHTML = '<option value="">-- Select a Session --</option>';
    const sorted = Object.keys(sessions).sort((a, b) => {
      const ta = sessions[a].savedAt || "";
      const tb = sessions[b].savedAt || "";
      return tb.localeCompare(ta);
    });
    sorted.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      const date = sessions[name].savedAt
        ? new Date(sessions[name].savedAt).toLocaleString()
        : "";
      opt.textContent = `${name} (${date})`;
      if (name === currentName) opt.selected = true;
      dropdown.appendChild(opt);
    });
    updateSPSessionBadge();
  }

  function updateSPSessionBadge() {
    const badge = $("spSessionBadge");
    if (!badge) return;
    const name = getSPCurrentSessionName();
    badge.style.display = "block";
    if (name) {
      badge.style.background = "rgba(124,58,237,0.18)";
      badge.style.border = "1px solid rgba(124,58,237,0.5)";
      badge.style.color = "#c4b5fd";
      badge.innerHTML = `🎮 Active: <strong>${esc(name)}</strong> <span style="font-size:0.62rem;opacity:0.7;">(auto-saving)</span>`;
    } else {
      badge.style.background = "rgba(245,158,11,0.12)";
      badge.style.border = "1px solid rgba(245,158,11,0.35)";
      badge.style.color = "#fbbf24";
      badge.innerHTML = "⚠️ No session active — create or select one";
    }
  }

  function handleSPCreateSession() {
    const input = $("spNewSessionName");
    const name = input ? input.value.trim() : "";
    if (!name) {
      alert("Enter a session name!");
      return;
    }
    if (!state) {
      alert("Please create or join a puzzle game first!");
      return;
    }
    const sessions = getSPSessions();
    if (sessions[name] && !confirm(`Session "${name}" exists. Overwrite?`)) return;
    fetch(`/api/sliding-puzzle/saved-sessions/${encodeURIComponent(name)}`, { method:"POST" })
      .then(async response => { const data = await response.json(); if (!response.ok) throw Error(data.error || "Could not save session."); cacheSPSessions(data.sessions, data.activeSessionName); if (input) input.value = ""; refreshSPSessionDropdown(); showSPToast(`✅ Session "${name}" created & saved!`); })
      .catch(error => alert(error.message || "Could not save session."));
  }

  async function handleSPSessionSelect(name) {
    if (!name) return;
    if (confirm(`Load session "${name}"? This will restore the puzzle board and credits.`)) {
      await loadSPSession(name);
    } else {
      refreshSPSessionDropdown();
    }
  }

  async function handleSPSaveSession() {
    const name = getSPCurrentSessionName();
    if (!name) {
      alert("No active session! Create one first using '+ CREATE'.");
      return;
    }
    if (!state) {
      alert("No active puzzle to save!");
      return;
    }
    try {
      const response = await fetch(`/api/sliding-puzzle/saved-sessions/${encodeURIComponent(name)}`, { method:"POST" });
      const data = await response.json(); if (!response.ok) throw Error(data.error || "Could not save session.");
      cacheSPSessions(data.sessions, data.activeSessionName); refreshSPSessionDropdown(); showSPToast(`💾 Session "${name}" saved!`);
    } catch (error) { alert(error.message || "Could not save session."); }
  }

  async function handleSPDeleteSession() {
    const dropdown = $("spSessionDropdown");
    const name = dropdown ? dropdown.value : "";
    if (!name) {
      alert("Select a session to delete!");
      return;
    }
    if (!confirm(`Delete session "${name}"?`)) return;
    try { await deleteSPSession(name); showSPToast(`🗑️ Session "${name}" and unused pictures deleted.`); }
    catch (error) { alert(error.message || "Could not delete session."); }
  }

  window.SlidingPuzzle = {
    get state() { return state; },
    getSPSessions,
    saveSPSession,
    loadSPSession,
    deleteSPSession,
    getSPCurrentSessionName,
    autoSaveSPGame,
    buildSPSessionSnapshot,
  };

  if (document.body.dataset.page === "teacher") {
    socket.emit("sliding-puzzle:join", { role:"teacher" });
    async function loadChapters() {
      const paper = $("paper").value;
      const params = new URLSearchParams({ paper });
      const chapters = await fetch("/api/creative/chapters?" + params).then(r => r.json()).catch(() => []);
      const select = $("chapter"), old = select.value;
      select.innerHTML = '<option value="All">All Chapters</option>' + chapters.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
      if (chapters.includes(old)) select.value = old;
    }
    $("paper").addEventListener("change", loadChapters); loadChapters();
    ["blue", "red"].forEach(team => $(team + "Image").addEventListener("change", () => {
      const file = $(team + "Image").files[0]; if (!file) return;
      selectedImages[team] = file;
      const preview = $(team + "Preview"); if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
      preview.dataset.objectUrl = URL.createObjectURL(file); preview.src = preview.dataset.objectUrl; preview.hidden = false;
      $(team + "Name").textContent = file.name;
    }));
    ["blue", "red"].forEach(team => $(team + "Portrait").addEventListener("change", () => {
      const file = $(team + "Portrait").files[0]; if (!file) return;
      if (!file.type.startsWith("image/")) { $("setupMessage").textContent = "Choose an image file for the team portrait."; return; }
      if (file.size > 12 * 1024 * 1024) { $("setupMessage").textContent = "Team portraits must be 12 MB or smaller."; return; }
      selectedPortraits[team] = file;
      const preview = $(team + "PortraitPreview"); if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
      preview.dataset.objectUrl = URL.createObjectURL(file); preview.src = preview.dataset.objectUrl; preview.hidden = false;
      $(team + "PortraitName").textContent = file.name;
    }));
    $("loadQuestions").addEventListener("click", async () => {
      const params = new URLSearchParams({ paper:$("paper").value, chapter:$("chapter").value, amount:"All" });
      const status = $("questionStatus"); status.textContent = "Loading knowledge and understanding questions…";
      try {
        const all = await fetch("/api/creative?" + params).then(r => { if (!r.ok) throw Error(); return r.json(); });
        questions = all.flatMap(q => [
          String(q.knowledge || "").trim() ? { ...q, promptType:"knowledge", prompt:String(q.knowledge).trim() } : null,
          String(q.understanding || "").trim() ? { ...q, promptType:"understanding", prompt:String(q.understanding).trim() } : null
        ].filter(Boolean));
        status.textContent = `${questions.length} knowledge and understanding prompt${questions.length === 1 ? "" : "s"} loaded from matching CQ entries.`;
        $("questionList").innerHTML = questions.map((q,i) => `<article><b>${i+1}</b><div><small class="question-type">${esc(q.promptType)}</small>${esc(q.prompt)}</div></article>`).join("") || "<p>No knowledge or understanding questions found for these filters.</p>";
      } catch (_) { status.textContent = "Could not load the Creative Question Bank."; }
    });
    $("createSession").addEventListener("click", async () => {
      if (!selectedImages.blue || !selectedImages.red) { $("setupMessage").textContent = "Choose a picture for both Team Blue and Team Red."; return; }
      if (!questions.length) { $("setupMessage").textContent = "Load the CQ questions first."; return; }
      $("setupMessage").textContent = "Preparing the image and puzzle…";
      try {
        const form = new FormData(); form.append("blueImage", await squareImage(selectedImages.blue), "team-blue.jpg"); form.append("redImage", await squareImage(selectedImages.red), "team-red.jpg"); form.append("questionIds", JSON.stringify(questions.map(q => ({ id:String(q.id), type:q.promptType }))));
        if (selectedPortraits.blue) form.append("bluePortrait", selectedPortraits.blue);
        if (selectedPortraits.red) form.append("redPortrait", selectedPortraits.red);
        const response = await fetch("/api/sliding-puzzle/sessions", { method:"POST", body:form });
        const result = await response.json(); if (!response.ok) throw Error(result.error || "Could not create game.");
        $("gamePanel").hidden = false; $("setupMessage").textContent = "Puzzle is live on the projector. Team Blue starts."; syncSPSessions();
      } catch (err) { $("setupMessage").textContent = err.message || "Could not create game."; }
    });
    $("askQuestion").addEventListener("click", () => socket.emit("sliding-puzzle:ask"));
    $("markCorrect").addEventListener("click", () => socket.emit("sliding-puzzle:judge", { correct:true }));
    $("markWrong").addEventListener("click", () => socket.emit("sliding-puzzle:judge", { correct:false }));
    $("switchTeam").addEventListener("click", () => socket.emit("sliding-puzzle:switch"));
    $("toggleQuestion").addEventListener("click", () => socket.emit("sliding-puzzle:question-visibility", { visible:!state?.questionVisible }));
    $("toggleReference").addEventListener("click", () => {
      socket.emit("sliding-puzzle:reference-visibility", { visible:!state?.referenceVisible });
    });
    $("finishGame").addEventListener("click", () => { if (confirm("Finish this puzzle and remove its uploaded picture from the server?")) socket.emit("sliding-puzzle:finish"); });
    $("resetGame").addEventListener("click", async () => {
      if (!confirm("Reset the Sliding Puzzle and permanently delete both team pictures?")) return;
      const response = await fetch("/api/sliding-puzzle/current", { method:"DELETE" });
      if (response.ok) { selectedImages = { blue:null, red:null }; selectedPortraits = { blue:null, red:null }; questions = []; $("gamePanel").hidden = true; $("noSession").hidden = false; $("setupMessage").textContent = "Active game reset. Saved sessions and their pictures were kept."; syncSPSessions(); }
      else $("setupMessage").textContent = "Could not reset the game. Please try again.";
    });
    $("openProjector").href = "game-sliding-puzzle.html";
    $("spCreateSessionBtn")?.addEventListener("click", handleSPCreateSession);
    $("spSaveSessionBtn")?.addEventListener("click", handleSPSaveSession);
    $("spDeleteSessionBtn")?.addEventListener("click", handleSPDeleteSession);
    $("spSessionDropdown")?.addEventListener("change", (e) => handleSPSessionSelect(e.target.value));
    syncSPSessions();
  } else {
    $("toggleProjectorReference").addEventListener("click", () => {
      socket.emit("sliding-puzzle:reference-visibility", { visible:!state?.referenceVisible });
    });
    $("winnerBack").addEventListener("click", () => { $("winnerOverlay").hidden = true; });
    socket.emit("sliding-puzzle:join", { role:"projector" });
  }

  function squareImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const side = Math.min(img.naturalWidth, img.naturalHeight), sx = (img.naturalWidth-side)/2, sy = (img.naturalHeight-side)/2;
        const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1200;
        canvas.getContext("2d").drawImage(img,sx,sy,side,side,0,0,1200,1200);
        URL.revokeObjectURL(url); canvas.toBlob(blob => blob ? resolve(blob) : reject(Error("Could not process this image.")),"image/jpeg",.9);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(Error("Could not read this image.")); };
      img.src = url;
    });
  }
})();

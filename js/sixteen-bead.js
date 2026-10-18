(() => {
  const socket = io();
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  const label = { blue: "Team Blue", red: "Team Red" };
  const isTeacher = document.body.dataset.page === "teacher";
  let state = null;
  let questions = [];
  let teacherAnswer = null;
  let teacherAnswerNumber = 0;
  let sessions = {};
  let activeName = null;
  let projectorQuestionNumberAllowed = null;
  let projectorSessionId = null;
  let projectorObservedQuestionNumber = null;
  const selectedTeamImages = { blue: null, red: null };

  const sessionsKey = "sixteen-bead-sessions-v1";
  const activeKey = "sixteen-bead-current-session";

  async function readJson(response) {
    const body = await response.text();
    try {
      return JSON.parse(body);
    } catch (_) {
      const normalized = body.trimStart().toLowerCase();
      if (normalized.startsWith("<!doctype") || normalized.startsWith("<html")) {
        throw new Error("Server is restarting or route not ready. Please try again.");
      }
      throw new Error("Invalid response from server.");
    }
  }

  function cacheSessions(next, name) {
    sessions = next || {};
    activeName = name || null;
    try {
      localStorage.setItem(sessionsKey, JSON.stringify(sessions));
      if (activeName) localStorage.setItem(activeKey, activeName);
      else localStorage.removeItem(activeKey);
    } catch (_) {}
    updateSessionUI();
  }

  async function syncSessions() {
    try {
      const response = await fetch("/api/sixteen-bead/sessions");
      const data = await response.json();
      if (response.ok) cacheSessions(data.sessions, data.activeSessionName);
    } catch (_) {
      try {
        sessions = JSON.parse(localStorage.getItem(sessionsKey) || "{}");
        activeName = localStorage.getItem(activeKey) || null;
      } catch (_) {}
      updateSessionUI();
    }
  }

  function updateSessionUI() {
    if (!isTeacher) return;
    const select = $("sessionDropdown"), badge = $("sessionBadge");
    if (select) {
      select.innerHTML = '<option value="">-- Select a Saved Session --</option>';
      Object.keys(sessions)
        .sort((a, b) => (sessions[b].savedAt || "").localeCompare(sessions[a].savedAt || ""))
        .forEach(name => {
          const option = document.createElement("option");
          option.value = name;
          option.textContent = `${name} (${sessions[name].savedAt ? new Date(sessions[name].savedAt).toLocaleDateString() : "saved"})`;
          if (name === activeName) option.selected = true;
          select.appendChild(option);
        });
    }
    if (badge) {
      badge.textContent = activeName ? `🎮 Active Match: ${activeName}` : "No saved session active";
    }
  }

  // Draw the Authentic Standard 16-Bead (Sholo Guti) Board
  function drawBoard(target, s, interactive = true) {
    if (!target) return;
    if (!s || !s.points || !s.points.length) {
      target.innerHTML = '<div class="sb-board-placeholder"><span>16</span><b>Board ready</b><small>Waiting for match to begin</small></div>';
      return;
    }

    const points = s.points;
    const tracks = s.tracks || [
      [0, 1, 2], [3, 4, 5],
      [6, 7, 8, 9, 10], [11, 12, 13, 14, 15], [16, 17, 18, 19, 20], [21, 22, 23, 24, 25], [26, 27, 28, 29, 30],
      [31, 32, 33], [34, 35, 36],
      [6, 11, 16, 21, 26], [7, 12, 17, 22, 27],
      [1, 4, 8, 13, 18, 23, 28, 32, 35],
      [9, 14, 19, 24, 29], [10, 15, 20, 25, 30],
      [0, 3, 8], [2, 5, 8], [28, 31, 34], [28, 33, 36],
      [6, 12, 18, 24, 30], [10, 14, 18, 22, 26],
      [8, 12, 16], [8, 14, 20], [16, 22, 28], [20, 24, 28]
    ];

    // Coordinate mapping: viewBox 0 0 520 720; one board cell is 100px square.
    // Older server processes still send the original 0..8 row geometry. Map
    // those coordinates into the same half-cell triangle layout as the current
    // server so beads and court lines remain inside the resized frame.
    const usesLegacyRows = Number(points[3]?.y) >= 1;
    const layoutPoint = p => {
      let y = Number(p.y);
      if (usesLegacyRows) {
        y = y <= 1 ? y * 0.5 : y <= 6 ? y - 1 : y * 0.5 + 2;
      }
      return { x: Number(p.x), y };
    };
    const px = p => {
      const point = layoutPoint(p);
      return {
        x: 260 + (point.x - 2) * 100,
        y: 60 + point.y * 100
      };
    };

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 520 720");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Sixteen Bead game board");
    svg.setAttribute("class", "sb-court-svg");

    // SVG Gradients, Filters & Patterns for high-end wood & 3D marble look
    const defs = document.createElementNS(svg.namespaceURI, "defs");
    defs.innerHTML = `
      <!-- Wood Grain Texture Gradients -->
      <linearGradient id="sbWoodGrain" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ddaa58"/>
        <stop offset="18%" stop-color="#e9bb6d"/>
        <stop offset="35%" stop-color="#d69f4c"/>
        <stop offset="55%" stop-color="#dfaa59"/>
        <stop offset="78%" stop-color="#ce9440"/>
        <stop offset="100%" stop-color="#bf8532"/>
      </linearGradient>

      <linearGradient id="sbWoodBorder" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#804715"/>
        <stop offset="50%" stop-color="#9a581e"/>
        <stop offset="100%" stop-color="#67350c"/>
      </linearGradient>

      <!-- 3D Blue Sphere Bead -->
      <radialGradient id="sbBlueMarble" cx="35%" cy="30%" r="68%">
        <stop offset="0%" stop-color="#cbe5fe"/>
        <stop offset="16%" stop-color="#60a5fa"/>
        <stop offset="45%" stop-color="#2563eb"/>
        <stop offset="75%" stop-color="#1e3a8a"/>
        <stop offset="100%" stop-color="#0a1945"/>
      </radialGradient>

      <!-- 3D Red Sphere Bead -->
      <radialGradient id="sbRedMarble" cx="35%" cy="30%" r="68%">
        <stop offset="0%" stop-color="#fed7d7"/>
        <stop offset="16%" stop-color="#f87171"/>
        <stop offset="45%" stop-color="#dc2626"/>
        <stop offset="75%" stop-color="#991b1b"/>
        <stop offset="100%" stop-color="#4c0519"/>
      </radialGradient>

      <!-- Bead Drop Shadow -->
      <filter id="sbBeadShadow" x="-30%" y="-30%" width="160%" height="170%">
        <feDropShadow dx="0" dy="5" stdDeviation="4.5" flood-color="#3b1704" flood-opacity="0.6"/>
      </filter>

      <!-- Line Etched Shadow -->
      <filter id="sbLineEtch" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="0.8" flood-color="#ffe6b0" flood-opacity="0.4"/>
      </filter>

      <!-- Selection Aura Glow -->
      <filter id="sbSelectGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#fbbf24" flood-opacity="0.9"/>
      </filter>

      <!-- Capture Pulse Glow -->
      <filter id="sbCaptureGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#f97316" flood-opacity="0.95"/>
      </filter>

      <!-- Move Destination Glow -->
      <filter id="sbDestGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#10b981" flood-opacity="0.9"/>
      </filter>
    `;
    svg.appendChild(defs);

    // 1. Wood Plank Table / Board Background
    const boardGroup = document.createElementNS(svg.namespaceURI, "g");
    boardGroup.setAttribute("class", "sb-court-board-group");

    // Board Base Frame
    const frameRect = document.createElementNS(svg.namespaceURI, "rect");
    frameRect.setAttribute("x", "14");
    frameRect.setAttribute("y", "14");
    frameRect.setAttribute("width", "492");
    frameRect.setAttribute("height", "692");
    frameRect.setAttribute("rx", "30");
    frameRect.setAttribute("fill", "url(#sbWoodGrain)");
    frameRect.setAttribute("stroke", "url(#sbWoodBorder)");
    frameRect.setAttribute("stroke-width", "8");
    frameRect.setAttribute("class", "sb-board-wood-base");
    boardGroup.appendChild(frameRect);

    // Inner Bevel Inset
    const innerFrame = document.createElementNS(svg.namespaceURI, "rect");
    innerFrame.setAttribute("x", "24");
    innerFrame.setAttribute("y", "24");
    innerFrame.setAttribute("width", "472");
    innerFrame.setAttribute("height", "672");
    innerFrame.setAttribute("rx", "22");
    innerFrame.setAttribute("fill", "none");
    innerFrame.setAttribute("stroke", "#fde09b");
    innerFrame.setAttribute("stroke-opacity", "0.45");
    innerFrame.setAttribute("stroke-width", "2");
    boardGroup.appendChild(innerFrame);

    // Subtle Horizontal Plank Lines across the wood (stop before the bottom edge)
    for (let py = 160; py <= 560; py += 100) {
      const plankLine = document.createElementNS(svg.namespaceURI, "line");
      plankLine.setAttribute("x1", "26");
      plankLine.setAttribute("y1", py);
      plankLine.setAttribute("x2", "494");
      plankLine.setAttribute("y2", py);
      plankLine.setAttribute("stroke", "#8f5217");
      plankLine.setAttribute("stroke-opacity", "0.18");
      plankLine.setAttribute("stroke-width", "1.5");
      boardGroup.appendChild(plankLine);
    }
    svg.appendChild(boardGroup);

    // 2. Continuous Board Lines (24 Tracks)
    const linesGroup = document.createElementNS(svg.namespaceURI, "g");
    linesGroup.setAttribute("class", "sb-court-lines");

    tracks.forEach(track => {
      const pStart = px(points[track[0]]);
      const pEnd = px(points[track[track.length - 1]]);

      // Bevel highlight line (shifted 1.5px down)
      const bevel = document.createElementNS(svg.namespaceURI, "line");
      bevel.setAttribute("x1", pStart.x);
      bevel.setAttribute("y1", pStart.y + 1.5);
      bevel.setAttribute("x2", pEnd.x);
      bevel.setAttribute("y2", pEnd.y + 1.5);
      bevel.setAttribute("stroke", "#fee9b8");
      bevel.setAttribute("stroke-opacity", "0.35");
      bevel.setAttribute("stroke-width", "6.5");
      bevel.setAttribute("stroke-linecap", "round");
      linesGroup.appendChild(bevel);

      // Main etched line
      const line = document.createElementNS(svg.namespaceURI, "line");
      line.setAttribute("x1", pStart.x);
      line.setAttribute("y1", pStart.y);
      line.setAttribute("x2", pEnd.x);
      line.setAttribute("y2", pEnd.y);
      line.setAttribute("class", "sb-board-track-line");
      line.setAttribute("stroke", "#4a1c0b");
      line.setAttribute("stroke-width", "6.5");
      line.setAttribute("stroke-linecap", "round");
      linesGroup.appendChild(line);
    });
    svg.appendChild(linesGroup);

    // 3. Sockets (Carved Pit Dimples at every intersection)
    const socketsGroup = document.createElementNS(svg.namespaceURI, "g");
    socketsGroup.setAttribute("class", "sb-court-sockets");
    points.forEach(pt => {
      const pos = px(pt);
      const socketRim = document.createElementNS(svg.namespaceURI, "circle");
      socketRim.setAttribute("cx", pos.x);
      socketRim.setAttribute("cy", pos.y);
      socketRim.setAttribute("r", "10");
      socketRim.setAttribute("fill", "#2b0f05");
      socketRim.setAttribute("stroke", "#a16024");
      socketRim.setAttribute("stroke-width", "1.8");
      socketRim.setAttribute("class", "sb-socket-point");
      socketsGroup.appendChild(socketRim);
    });
    svg.appendChild(socketsGroup);

    // 4. Last Move Trace Indicator
    if (s.lastMove && Number.isInteger(s.lastMove.from) && Number.isInteger(s.lastMove.to)) {
      const p1 = px(points[s.lastMove.from]);
      const p2 = px(points[s.lastMove.to]);
      const trace = document.createElementNS(svg.namespaceURI, "line");
      trace.setAttribute("x1", p1.x);
      trace.setAttribute("y1", p1.y);
      trace.setAttribute("x2", p2.x);
      trace.setAttribute("y2", p2.y);
      trace.setAttribute("stroke", s.lastMove.team === "blue" ? "#60a5fa" : "#f87171");
      trace.setAttribute("stroke-width", "4");
      trace.setAttribute("stroke-dasharray", "7 5");
      trace.setAttribute("stroke-linecap", "round");
      trace.setAttribute("class", "sb-last-move-trace");
      svg.appendChild(trace);
    }

    // 5. Interactive Points & Beads
    const pointsGroup = document.createElementNS(svg.namespaceURI, "g");
    pointsGroup.setAttribute("class", "sb-court-beads");

    const moves = s.legalMoves || [];
    const legalDestMap = new Map();
    moves.forEach(m => legalDestMap.set(m.to, m));

    const legalOrigins = new Set(moves.map(m => m.from));
    const captureVictims = new Set();
    if (s.selectedFrom !== null && s.selectedFrom !== undefined) {
      moves.filter(m => m.from === s.selectedFrom && m.capture !== null).forEach(m => captureVictims.add(m.capture));
    }

    points.forEach((point, index) => {
      const pos = px(point);
      const team = s.board[index];
      const move = legalDestMap.get(index);
      const isDest = !!move;
      const isCaptureDest = isDest && move.capture !== null;
      const isOrigin = legalOrigins.has(index);
      const isSelected = s.selectedFrom === index;
      const isVictim = captureVictims.has(index);

      const node = document.createElementNS(svg.namespaceURI, "g");
      node.setAttribute("class", `sb-point ${team || "empty"}${isDest ? " is-dest" : ""}${isSelected ? " is-selected" : ""}${isOrigin ? " is-origin" : ""}`);
      node.setAttribute("transform", `translate(${pos.x} ${pos.y})`);
      node.setAttribute("role", "button");
      node.setAttribute("tabindex", interactive ? "0" : "-1");
      node.setAttribute("aria-label", team ? `${label[team]} bead at point ${index + 1}` : `Point ${index + 1}`);
      node.dataset.point = String(index);

      let inner = `
        <!-- Large touch hit area -->
        <circle class="sb-hit-circle" r="32" fill="transparent" pointer-events="all"></circle>
      `;

      if (team) {
        // Bead exists here
        const isBlue = team === "blue";
        const beadUrl = isBlue ? "url(#sbBlueMarble)" : "url(#sbRedMarble)";

        // Victim highlight pulse
        if (isVictim) {
          inner += `<circle class="sb-victim-pulse" r="28" fill="none" stroke="#ef4444" stroke-width="3.5" filter="url(#sbCaptureGlow)"></circle>`;
        }

        // Selection Aura
        if (isSelected) {
          inner += `
            <circle class="sb-selection-halo" r="30" fill="none" stroke="#fbbf24" stroke-width="4.5" filter="url(#sbSelectGlow)"></circle>
            <circle class="sb-selection-spinner" r="28" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="6 6"></circle>
          `;
        } else if (interactive && isOrigin) {
          // Playable piece ready to move ring
          inner += `<circle class="sb-ready-ring" r="27" fill="none" stroke="#fef08a" stroke-width="2.5" stroke-dasharray="5 4"></circle>`;
        }

        // 3D Spherical Marble Bead
        inner += `
          <g filter="url(#sbBeadShadow)">
            <circle class="sb-bead-body" r="22" fill="${beadUrl}" stroke="rgba(255,255,255,0.45)" stroke-width="1.5"></circle>
            <!-- Specular Highlight Glare -->
            <ellipse class="sb-bead-glare" cx="-6" cy="-8" rx="7" ry="4" transform="rotate(-30 -6 -8)" fill="rgba(255,255,255,0.72)"></ellipse>
            <circle class="sb-bead-rim-glow" r="21.5" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"></circle>
          </g>
        `;
      } else if (isDest) {
        // Empty Point with Legal Move Target
        if (isCaptureDest) {
          inner += `
            <circle class="sb-capture-target-pulse" r="18" fill="#f97316" fill-opacity="0.3" filter="url(#sbCaptureGlow)"></circle>
            <circle class="sb-capture-target-ring" r="15" fill="#f59e0b" stroke="#ffffff" stroke-width="3"></circle>
            <circle class="sb-target-center" r="5" fill="#ffffff"></circle>
          `;
        } else {
          inner += `
            <circle class="sb-move-target-pulse" r="17" fill="#10b981" fill-opacity="0.25" filter="url(#sbDestGlow)"></circle>
            <circle class="sb-move-target-ring" r="14" fill="#10b981" stroke="#ecfdf5" stroke-width="2.5"></circle>
            <circle class="sb-target-center" r="4.5" fill="#ffffff"></circle>
          `;
        }
      }

      node.innerHTML = inner;

      if (interactive) {
        const activate = () => {
          const currentMoves = s.legalMoves || [];

          // 1. If clicking on an active destination -> Make Move!
          if (s.selectedFrom !== null && s.selectedFrom !== undefined && currentMoves.some(m => m.to === index)) {
            socket.emit("sixteen-bead:move", { from: s.selectedFrom, to: index });
            return;
          }

          // 2. If clicking on own team's bead -> Select!
          if (team === s.currentTeam) {
            socket.emit("sixteen-bead:select", { point: index });
            return;
          }

          // 3. If clicking elsewhere and not in continuation -> Deselect
          if (s.selectedFrom !== null && s.selectedFrom !== undefined && s.continuationFrom === null) {
            socket.emit("sixteen-bead:select", { point: null });
          }
        };

        node.addEventListener("click", activate);
        node.addEventListener("keydown", e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            activate();
          }
        });
      }

      pointsGroup.appendChild(node);
    });

    svg.appendChild(pointsGroup);
    target.replaceChildren(svg);
  }

  // Render Quiz Question Card
  function renderQuestion(target, q, isTeacherRole = false) {
    if (!target) return;
    if (!q) {
      target.innerHTML = '<p class="sb-question-empty">Ask a question to earn move credits.</p>';
      return;
    }

    const typeLabel = q.type === "knowledge" ? "KNOWLEDGE (জ্ঞানমূলক)" : "UNDERSTANDING (অনুধাবনমূলক)";
    const teamName = label[q.team] || "Active Team";

    let html = `
      <div class="sb-question-meta">
        <span class="sb-type-pill ${esc(q.type)}">${typeLabel}</span>
        <span class="sb-target-team">${esc(teamName)}</span>
      </div>
    `;

    if (q.passage) {
      html += `<div class="sb-passage-box"><span class="sb-passage-tag">PASSAGE / উদ্দীপক</span><p>${esc(q.passage)}</p></div>`;
    }

    html += `<div class="sb-prompt-box"><h3>${esc(q.prompt || "")}</h3></div>`;

    if (q.judgement) {
      const isCorrect = q.judgement === "correct";
      html += `
        <div class="sb-judgement-banner ${isCorrect ? "correct" : "wrong"}">
          <b>${isCorrect ? "✓ CORRECT! +10 MOVE CREDITS AWARDED" : "↻ INCORRECT! NO CREDITS AWARDED"}</b>
          ${q.answer ? `<div class="sb-answer-revealed"><strong>Answer:</strong> ${esc(q.answer)}</div>` : ""}
        </div>
      `;
    } else if (isTeacherRole && teacherAnswerNumber === q.number) {
      html += `
        <div class="sb-teacher-key-box">
          <span class="sb-key-tag">🔑 TEACHER ANSWER KEY</span>
          <p>${esc(teacherAnswer || "Answer key loading...")}</p>
        </div>
      `;
    } else if (!isTeacherRole) {
      html += '<p class="sb-projector-awaiting">Listen carefully. Your teacher will check the answer.</p>';
    }

    target.innerHTML = html;
  }

  // State Broadcast Handler
  function render(s) {
    state = s;

    if (!s) {
      if (!isTeacher) {
        projectorSessionId = null;
        projectorObservedQuestionNumber = null;
        projectorQuestionNumberAllowed = null;
      }
      $("gamePanel")?.setAttribute("hidden", "");
      $("noSession")?.removeAttribute("hidden");
      if (!isTeacher) {
        $("questionOverlay")?.setAttribute("hidden", "");
        $("winnerOverlay")?.setAttribute("hidden", "");
        if ($("gameStatus")) $("gameStatus").textContent = "Waiting for the teacher to start a match.";
      }
      return;
    }

    // The question-asked event is the primary signal. Also detect a new
    // question in the state stream so a projector that missed that event
    // (for example during a brief reconnect) still opens the modal. The first
    // state for a match is only a baseline, so reloading the page won't reopen
    // an old question from saved state.
    if (!isTeacher) {
      const sessionId = s.id ?? null;
      const questionNumber = Number(s.questionNumber);
      if (sessionId !== projectorSessionId) {
        projectorSessionId = sessionId;
        projectorObservedQuestionNumber = questionNumber;
        projectorQuestionNumberAllowed = null;
      } else if (Number.isFinite(questionNumber)) {
        if (Number.isFinite(projectorObservedQuestionNumber) && questionNumber > projectorObservedQuestionNumber) {
          projectorQuestionNumberAllowed = questionNumber;
        }
        projectorObservedQuestionNumber = questionNumber;
      }
    }

    $("gamePanel")?.removeAttribute("hidden");
    $("noSession")?.setAttribute("hidden", "");

    // Update Counters
    document.querySelectorAll("[data-credit]").forEach(el => el.textContent = s.credits[el.dataset.credit] ?? 0);
    document.querySelectorAll("[data-count]").forEach(el => el.textContent = s.counts[el.dataset.count] ?? 0);
    document.querySelectorAll("[data-turn]").forEach(el => el.textContent = label[s.currentTeam]);
    document.querySelectorAll("[data-team-photo]").forEach(img => {
      const src = s.teamImages?.[img.dataset.teamPhoto];
      img.hidden = !src;
      if (src && img.dataset.src !== src) { img.src = src; img.dataset.src = src; }
    });

    // Active Team Highlighting on Cards
    document.querySelectorAll(".sb-team-card").forEach(card => {
      card.classList.toggle("is-active", card.classList.contains(s.currentTeam));
    });

    if (isTeacher) {
      const captureAvailable = s.captureAvailable === true;
      if ($("gameCode")) $("gameCode").textContent = s.id ? s.id.slice(0, 6).toUpperCase() : "LIVE";
      if ($("gameStatus")) $("gameStatus").textContent = s.status === "finished" ? s.result : "Live Match";
      if ($("questionCount")) $("questionCount").textContent = `${s.questionNumber} / ${s.questionCount}`;

      renderQuestion($("teacherQuestion"), s.currentQuestion, true);

      // Button states
      const hasPendingQuestion = s.currentQuestion && !s.currentQuestion.judgement;
      if ($("markCorrect")) $("markCorrect").disabled = !hasPendingQuestion;
      if ($("markWrong")) $("markWrong").disabled = !hasPendingQuestion;
      if ($("askQuestion")) $("askQuestion").disabled = s.status !== "playing" || hasPendingQuestion;
      if ($("toggleQuestion")) {
        $("toggleQuestion").disabled = !s.currentQuestion || s.status !== "playing";
        $("toggleQuestion").textContent = s.questionVisible ? "Hide question on projector" : "Show question on projector";
      }

      const opponent = s.currentTeam === "blue" ? "red" : "blue";
      if ($("switchTeam")) {
        $("switchTeam").textContent = s.continuationFrom !== null ? "Pass remaining chain & switch turn" : `Switch turn to ${label[opponent]}`;
        $("switchTeam").disabled = s.status !== "playing";
      }

      // Guidance message
      if ($("moveHelp")) {
        if (s.status === "finished") {
          $("moveHelp").textContent = s.result;
        } else if (s.continuationFrom !== null) {
          $("moveHelp").textContent = "Multi-jump active: make the next capture jump, or click Switch Turn to pass.";
        } else if (captureAvailable) {
          $("moveHelp").textContent = "Capture jump available, or choose any other highlighted legal move.";
        } else if (s.credits[s.currentTeam] === 0) {
          $("moveHelp").textContent = `${label[s.currentTeam]} needs a correct CQ answer to earn 10 move credits.`;
        } else if (s.selectedFrom !== null && s.selectedFrom !== undefined) {
          $("moveHelp").textContent = "Choose a highlighted point to move your bead.";
        } else {
          $("moveHelp").textContent = "Select a bead to move. Each move costs 1 credit.";
        }
      }

      drawBoard($("teacherBoard"), s, true);

      if (activeName) {
        const old = sessions[activeName] || {};
        sessions[activeName] = { ...old, ...s, savedAt: new Date().toISOString() };
        try { localStorage.setItem(sessionsKey, JSON.stringify(sessions)); } catch (_) {}
      }
      updateSessionUI();
    } else {
      // Projector Page
      const won = s.status === "finished" && !!s.winner;
      if ($("gameStatus")) {
        $("gameStatus").textContent = s.status === "finished" ? s.result : `${label[s.currentTeam]}'s turn`;
      }
      if ($("projectorHelp")) {
        if (s.status === "finished") {
          $("projectorHelp").textContent = s.result;
        } else if (s.continuationFrom !== null) {
          $("projectorHelp").textContent = `${label[s.currentTeam]} can continue jumping or pass.`;
        } else if (s.credits[s.currentTeam] > 0) {
          $("projectorHelp").textContent = `${label[s.currentTeam]} has ${s.credits[s.currentTeam]} move credit${s.credits[s.currentTeam] === 1 ? "" : "s"}.`;
        } else {
          $("projectorHelp").textContent = "A correct CQ answer earns 10 bead moves.";
        }
      }

      // Question HUD / Banner
      if ($("questionOverlay")) {
        const showQ = s.questionVisible && s.currentQuestion && Number(s.questionNumber) === projectorQuestionNumberAllowed;
        $("questionOverlay").hidden = !showQ;
        if (showQ) {
          if ($("projectorQuestionCount")) $("projectorQuestionCount").textContent = `${s.questionNumber} / ${s.questionCount}`;
          if ($("projectorQuestionTeam")) $("projectorQuestionTeam").textContent = label[s.currentQuestion.team] || label[s.currentTeam];
          renderQuestion($("projectorQuestion"), s.currentQuestion, false);
        }
      }

      // Winner Overlay
      if ($("winnerOverlay")) {
        $("winnerOverlay").hidden = !won;
        if (won) {
          if ($("winnerTitle")) $("winnerTitle").textContent = `${label[s.winner]} Wins!`;
          if ($("winnerMessage")) $("winnerMessage").textContent = s.result;
        }
      }

      // Allow interactive board touches/clicks on Projector too!
      drawBoard($("gameBoard"), s, true);
    }
  }

  socket.on("sixteen-bead:state", render);
  socket.on("classroom-navigate", data => {
    if (data?.url) window.location.href = data.url;
  });

  // Projector: live image preview before/during a match
  socket.on("sixteen-bead:team-image-preview", ({ team, url } = {}) => {
    if (isTeacher) return;
    document.querySelectorAll(`[data-team-photo="${team}"]`).forEach(img => {
      img.src = url;
      img.hidden = false;
      img.dataset.src = url;
    });
  });

  // Teacher: confirmation that server saved the uploaded image
  socket.on("sixteen-bead:team-image-saved", ({ team, url } = {}) => {
    if (!isTeacher) return;
    document.querySelectorAll(`[data-team-photo="${team}"]`).forEach(img => {
      img.src = url;
      img.hidden = false;
      img.dataset.src = url;
    });
  });

  socket.on("sixteen-bead:question-asked", ({ number } = {}) => {
    if (isTeacher || !Number.isFinite(Number(number))) return;
    projectorQuestionNumberAllowed = Number(number);
    if (state) render(state);
  });

  socket.on("sixteen-bead:teacher-answer", data => {
    teacherAnswer = data.answer;
    teacherAnswerNumber = data.number;
    if (state && isTeacher) render(state);
  });

  socket.on("connect", () => {
    socket.emit("sixteen-bead:join", { role: isTeacher ? "teacher" : "projector" });
  });

  if (isTeacher) {
    const loadChapters = async () => {
      const paper = $("paper").value;
      const params = new URLSearchParams({ paper });
      const list = await fetch("/api/creative/chapters?" + params).then(r => r.json()).catch(() => []);
      const select = $("chapter"), old = select.value;
      select.innerHTML = '<option value="All">All Chapters</option>' + list.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
      if (list.includes(old)) select.value = old;
    };
    $("paper").addEventListener("change", loadChapters);
    loadChapters();

    $("loadQuestions").addEventListener("click", async () => {
      const params = new URLSearchParams({ paper: $("paper").value, chapter: $("chapter").value, amount: "All" });
      const status = $("questionStatus");
      status.textContent = "Loading CQ questions…";
      try {
        const rows = await fetch("/api/creative?" + params).then(r => { if (!r.ok) throw Error(); return r.json(); });
        questions = rows.flatMap(row => ["knowledge", "understanding"].map(type => String(row[type] || "").trim() ? { ...row, promptType: type, prompt: String(row[type]).trim() } : null).filter(Boolean));
        status.textContent = `${questions.length} questions loaded (Knowledge + Understanding).`;
        $("questionList").innerHTML = questions.map((q, idx) => `
          <article><b>${idx + 1}</b><div><small>${esc(q.promptType)}</small>${esc(q.prompt)}</div></article>
        `).join("") || "<p>No matching questions found.</p>";
        $("createGame").disabled = !questions.length;
      } catch (_) {
        status.textContent = "Could not load CQ Question Bank.";
      }
    });

    $("createGame").addEventListener("click", async () => {
      if (!questions.length) return;
      $("setupMessage").textContent = "Starting new match…";
      try {
        const form = new FormData();
        form.append("questionIds", JSON.stringify(questions.map(q => ({ id: String(q.id), type: q.promptType }))));
        if (selectedTeamImages.blue) form.append("blueImage", selectedTeamImages.blue);
        if (selectedTeamImages.red) form.append("redImage", selectedTeamImages.red);
        const response = await fetch("/api/sixteen-bead/new", {
          method: "POST",
          body: form
        });
        const data = await readJson(response);
        if (!response.ok) throw Error(data.error || "Could not start match.");
        activeName = null;
        cacheSessions(sessions, null);
        $("setupMessage").textContent = "Sixteen Bead is live! Team Blue starts.";
      } catch (error) {
        $("setupMessage").textContent = error.message || "Could not start match.";
      }
    });

    ["blue", "red"].forEach(team => $(team + "TeamImage").addEventListener("change", event => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) { $("setupMessage").textContent = "Choose a JPG, PNG, or WebP picture."; event.target.value = ""; return; }
      if (file.size > 12 * 1024 * 1024) { $("setupMessage").textContent = "Each team picture must be 12 MB or smaller."; event.target.value = ""; return; }
      selectedTeamImages[team] = file;
      const preview = $(team + "TeamPreview");
      if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
      preview.dataset.objectUrl = URL.createObjectURL(file);
      preview.src = preview.dataset.objectUrl;
      preview.hidden = false;
      $(team + "TeamFileName").textContent = file.name;

      // Immediately push the image to all connected projectors via socket
      const reader = new FileReader();
      reader.onload = e => {
        const dataUrl = e.target.result;
        socket.emit("sixteen-bead:update-team-image", { team, dataUrl });
        // Also update the scorebar preview on the teacher page right away
        document.querySelectorAll(`[data-team-photo="${team}"]`).forEach(img => {
          img.src = dataUrl;
          img.hidden = false;
          img.dataset.src = dataUrl;
        });
      };
      reader.readAsDataURL(file);
    }));

    $("createSession").addEventListener("click", async () => {
      const name = $("newSessionName").value.trim();
      if (!name) return alert("Enter a session name.");
      if (!state) return alert("Start a match before saving.");
      if (sessions[name] && !confirm(`Overwrite session "${name}"?`)) return;
      try {
        const response = await fetch(`/api/sixteen-bead/sessions/${encodeURIComponent(name)}`, { method: "POST" });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "Could not save session.");
        cacheSessions(data.sessions, data.activeSessionName);
        $("newSessionName").value = "";
        showToast(`Saved session "${name}"`);
      } catch (error) {
        alert(error.message);
      }
    });

    $("saveSession").addEventListener("click", async () => {
      if (!activeName) return alert("Select or create a saved session first.");
      try {
        const response = await fetch(`/api/sixteen-bead/sessions/${encodeURIComponent(activeName)}`, { method: "POST" });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "Could not save session.");
        cacheSessions(data.sessions, data.activeSessionName);
        showToast(`Saved ${activeName}.`);
      } catch (error) {
        alert(error.message);
      }
    });

    $("sessionDropdown").addEventListener("change", async event => {
      const name = event.target.value;
      if (!name) return;
      if (!confirm(`Restore session "${name}"?`)) {
        updateSessionUI();
        return;
      }
      try {
        const response = await fetch(`/api/sixteen-bead/sessions/${encodeURIComponent(name)}/restore`, { method: "POST" });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "Could not restore session.");
        cacheSessions(data.sessions, data.activeSessionName);
        showToast(`Restored "${name}".`);
      } catch (error) {
        alert(error.message);
        updateSessionUI();
      }
    });

    $("deleteSession").addEventListener("click", async () => {
      const name = $("sessionDropdown").value;
      if (!name) return alert("Select a session to delete.");
      if (!confirm(`Delete saved session "${name}"?`)) return;
      try {
        const response = await fetch(`/api/sixteen-bead/sessions/${encodeURIComponent(name)}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "Could not delete session.");
        cacheSessions(data.sessions, data.activeSessionName);
        showToast(`Deleted "${name}".`);
      } catch (error) {
        alert(error.message);
      }
    });

    $("markCorrect").addEventListener("click", () => socket.emit("sixteen-bead:judge", { correct: true }));
    $("markWrong").addEventListener("click", () => socket.emit("sixteen-bead:judge", { correct: false }));
    $("askQuestion").addEventListener("click", () => socket.emit("sixteen-bead:ask"));
    $("switchTeam").addEventListener("click", () => socket.emit("sixteen-bead:switch"));
    $("toggleQuestion").addEventListener("click", () => socket.emit("sixteen-bead:question-visibility", { visible: !state?.questionVisible }));
    $("endGame").addEventListener("click", () => {
      if (confirm("End match now?")) socket.emit("sixteen-bead:finish");
    });
    $("resetGame").addEventListener("click", async () => {
      if (!confirm("Reset the active match?")) return;
      await fetch("/api/sixteen-bead/current", { method: "DELETE" });
    });

    syncSessions();
  } else {
    // Projector Event Listeners
    $("winnerBack")?.addEventListener("click", () => {
      if ($("winnerOverlay")) $("winnerOverlay").hidden = true;
    });
  }

  function showToast(message) {
    let toast = $("sbToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "sbToast";
      toast.className = "sb-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
  }
})();

(function () {
  const socket = io();
  let code = "", state = null, timerHandle = null, activeQuestion = null;
  let studentAnswers = {}, answerSubmitted = false;
  let studentPhotoData = null; // base64 photo data
  let participantPhotos = {}; // { participantId: photoUrl, name: photoUrl }
  let currentResultsView = 'chart'; // 'chart', 'table', or 'both'
  let goToStepFn = null;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const expectedParts = q => Number(q.type) === 4
    ? { ...(q.question ? { q1:q.answer } : {}), ...(q.question2 ? { q2:q.q2_answer } : {}) }
    : { q1:q.answer };
  const answerFields = (q, part) => {
    const type = Number(q.type);
    if (type === 2 || (type === 4 && part === "q1") || (type === 4 && part === "q2" && q.q2_type === "point")) {
      const prefix = type === 4 && part === "q2" ? "q2_combo_option_" : "combo_option_";
      return [1,2,3,4].map((n,i) => ({ value:String(n), label:QuestionBank.OPTION_LABELS[i], text:q[prefix+n] })).filter(x => x.text);
    }
    const prefix = type === 4 && part === "q2" ? "q2_option_" : "option_";
    return ["a","b","c","d"].map((letter,i) => ({ value:String.fromCharCode(65+i), label:QuestionBank.OPTION_LABELS[i], text:q[prefix+letter] })).filter(x => x.text);
  };
  const PALETTES = [
    { gradient: "linear-gradient(90deg, #f59e0b, #fbbf24, #f97316)", color: "#d97706", glow: "rgba(245,158,11,0.35)", accent: "#fef3c7", icon: "👑", cardGrad: "linear-gradient(135deg, #f59e0b, #fbbf24)" },
    { gradient: "linear-gradient(90deg, #06b6d4, #0ea5e9, #3b82f6)", color: "#0284c7", glow: "rgba(14,165,233,0.35)", accent: "#e0f2fe", icon: "⚡", cardGrad: "linear-gradient(135deg, #06b6d4, #3b82f6)" },
    { gradient: "linear-gradient(90deg, #10b981, #34d399, #059669)", color: "#059669", glow: "rgba(16,185,129,0.35)", accent: "#dcfce7", icon: "🌟", cardGrad: "linear-gradient(135deg, #10b981, #34d399)" },
    { gradient: "linear-gradient(90deg, #8b5cf6, #c084fc, #ec4899)", color: "#7c3aed", glow: "rgba(139,92,246,0.35)", accent: "#f3e8ff", icon: "🔥", cardGrad: "linear-gradient(135deg, #8b5cf6, #a78bfa)" },
    { gradient: "linear-gradient(90deg, #f43f5e, #fb7185, #f97316)", color: "#e11d48", glow: "rgba(244,63,94,0.35)", accent: "#ffe4e6", icon: "🎯", cardGrad: "linear-gradient(135deg, #f43f5e, #fb7185)" },
    { gradient: "linear-gradient(90deg, #6366f1, #818cf8, #38bdf8)", color: "#4f46e5", glow: "rgba(99,102,241,0.35)", accent: "#e0e7ff", icon: "🛡️", cardGrad: "linear-gradient(135deg, #6366f1, #818cf8)" },
    { gradient: "linear-gradient(90deg, #14b8a6, #2dd4bf, #06b6d4)", color: "#0f766e", glow: "rgba(20,184,166,0.35)", accent: "#ccfbf1", icon: "💎", cardGrad: "linear-gradient(135deg, #14b8a6, #2dd4bf)" },
    { gradient: "linear-gradient(90deg, #ec4899, #f472b6, #fb7185)", color: "#db2777", glow: "rgba(236,72,153,0.35)", accent: "#fce7f3", icon: "🚀", cardGrad: "linear-gradient(135deg, #ec4899, #f472b6)" }
  ];

  function launchConfetti(container) {
    if (!container) return;
    if (container.querySelector(".th-confetti-particle")) return;
    const colors = ["#f59e0b", "#3b82f6", "#10b981", "#ec4899", "#8b5cf6", "#06b6d4", "#f43f5e", "#eab308"];
    for (let i = 0; i < 55; i++) {
      const p = document.createElement("div");
      p.className = "th-confetti-particle";
      p.style.left = `${Math.random() * 96 + 2}%`;
      p.style.top = `${-15 - Math.random() * 25}px`;
      p.style.backgroundColor = colors[i % colors.length];
      p.style.animationDelay = `${Math.random() * 1.8}s`;
      p.style.animationDuration = `${2.4 + Math.random() * 2.2}s`;
      p.style.width = `${Math.random() * 6 + 8}px`;
      p.style.height = `${Math.random() * 8 + 12}px`;
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      container.appendChild(p);
      setTimeout(() => p.remove(), 6000);
    }
  }

  // Generate a vibrant student illustration SVG placeholder avatar
  function getStudentPlaceholderAvatar(name, size, cssClass) {
    const s = String(name || "Student").trim();
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) & 0xffffff;
    const absHash = Math.abs(hash);
    const AVATAR_PALETTES = [
      { bg1: "#8b5cf6", bg2: "#ec4899", skin: "#fed7aa", hair: "#312e81", shirt: "#7c3aed" },
      { bg1: "#06b6d4", bg2: "#3b82f6", skin: "#fcd34d", hair: "#1e3a8a", shirt: "#0284c7" },
      { bg1: "#f59e0b", bg2: "#ea580c", skin: "#fed7aa", hair: "#78350f", shirt: "#d97706" },
      { bg1: "#10b981", bg2: "#0d9488", skin: "#fde68a", hair: "#064e3b", shirt: "#059669" },
      { bg1: "#f43f5e", bg2: "#d946ef", skin: "#fed7aa", hair: "#831843", shirt: "#e11d48" },
      { bg1: "#6366f1", bg2: "#8b5cf6", skin: "#fcd34d", hair: "#312e81", shirt: "#4f46e5" }
    ];
    const pal = AVATAR_PALETTES[absHash % AVATAR_PALETTES.length];
    const initial = (s[0] || "S").toUpperCase();
    const hairStyle = absHash % 3; // 0: cap, 1: spiky/curly, 2: sleek bangs

    let hairSvg = '';
    if (hairStyle === 0) {
      hairSvg = `<path d="M12 28 L32 20 L52 28 L32 36 Z" fill="${pal.hair}"/><circle cx="32" cy="20" r="3" fill="#fbbf24"/><path d="M52 28 L52 38" stroke="#fbbf24" stroke-width="2"/>`;
    } else if (hairStyle === 1) {
      hairSvg = `<path d="M18 32 C18 20 25 15 32 15 C39 15 46 20 46 32 C46 32 44 26 38 27 C34 24 28 25 26 28 C23 27 20 29 18 32 Z" fill="${pal.hair}"/>`;
    } else {
      hairSvg = `<path d="M18 34 C18 19 46 19 46 34 C44 26 38 24 32 25 C26 24 20 26 18 34 Z" fill="${pal.hair}"/>`;
    }

    const svg = `<svg viewBox="0 0 64 64" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg_${absHash}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${pal.bg1}"/>
          <stop offset="100%" stop-color="${pal.bg2}"/>
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="32" fill="url(#bg_${absHash})"/>
      <path d="M12 64 C12 50 20 46 32 46 C44 46 52 50 52 64 Z" fill="${pal.shirt}"/>
      <rect x="28" y="38" width="8" height="8" rx="2" fill="${pal.skin}"/>
      <circle cx="32" cy="32" r="14" fill="${pal.skin}"/>
      ${hairSvg}
      <circle cx="27" cy="32" r="2" fill="#1e1b4b"/>
      <circle cx="37" cy="32" r="2" fill="#1e1b4b"/>
      <circle cx="27.5" cy="31.5" r="0.6" fill="#fff"/>
      <circle cx="37.5" cy="31.5" r="0.6" fill="#fff"/>
      <circle cx="24" cy="35" r="2" fill="#f43f5e" opacity="0.35"/>
      <circle cx="40" cy="35" r="2" fill="#f43f5e" opacity="0.35"/>
      <path d="M29 36 Q32 39 35 36" stroke="#1e1b4b" stroke-width="1.8" stroke-linecap="round" fill="none"/>
      <g transform="translate(42, 42)">
        <circle cx="9" cy="9" r="9" fill="#ffffff" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))"/>
        <text x="9" y="13" font-family="'Outfit', sans-serif" font-weight="900" font-size="10" fill="${pal.bg1}" text-anchor="middle">${initial}</text>
      </g>
    </svg>`;

    return `<div class="${cssClass || 'th-rd-chart-avatar-placeholder'}" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${svg}</div>`;
  }

  // Build avatar HTML helper
  function avatarHtml(participant, size, cssClass) {
    const photo = participantPhotos[participant.id] || participantPhotos[participant.name];
    if (photo) {
      return `<img src="${esc(photo)}" alt="${esc(participant.name)}" style="width:100%;height:100%;object-fit:cover;">`;
    }
    return getStudentPlaceholderAvatar(participant.name, size, cssClass);
  }

  const scoreRows = s => (s.mode === "teams" ? s.teams.map(t => ({name:t.name,score:t.score,id:t.id})) : s.participants.map(p => ({name:p.name,score:p.score,id:p.id}))).sort((a,b) => b.score-a.score);

  function showScores(target, s) {
    if (!target) return;
    const rows = scoreRows(s);
    if (!rows.length) {
      target.innerHTML = '<p style="color:#8e87ad;text-align:center;padding:20px;font-family:Outfit,sans-serif;">No players or teams have joined yet.</p>';
      return;
    }
    const maxPoints = Number(s.maxPoints) || s.questions?.length || 0;
    const maxScored = Math.max(...rows.map(r => r.score), 1);
    const leader = rows[0];

    const winnerBanner = document.getElementById("screenWinnerBanner");
    if (winnerBanner) {
      if (s.status === "finished" && leader && leader.score > 0) {
        winnerBanner.innerHTML = `<span class="th-champ-trophy">🏆</span> <span>Arena Champion: <strong>${esc(leader.name)}</strong> with <strong>${leader.score}</strong> pts!</span>`;
        winnerBanner.style.display = "inline-flex";
      } else if (s.status === "finished" && leader) {
        winnerBanner.innerHTML = `<span class="th-champ-trophy">🤝</span> <span>Match Completed · All teams participated!</span>`;
        winnerBanner.style.display = "inline-flex";
      } else {
        winnerBanner.style.display = "none";
      }
    }

    // Check if we're in redesign mode
    const isRedesign = document.body.classList.contains('th-redesign');

    if (isRedesign) {
      // Build chart view
      const chartHtml = `
        <div class="th-rd-view-chart th-rd-chart-container">
          <div class="th-rd-chart-title">
            <span>📊 Leaderboard Ranking</span>
          </div>
          ${rows.map((row, i) => {
            const pal = PALETTES[i % PALETTES.length];
            const relPct = maxScored > 0 ? (row.score / maxScored) * 100 : 0;
            const barWidth = row.score === 0 ? 5 : Math.max(12, Math.round(relPct * 0.96));
            const accuracy = maxPoints > 0 ? Math.round((row.score / maxPoints) * 100) : 0;
            const rankMedal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
            const rankClass = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "other";
            const participant = { id: row.id, name: row.name };

            return `
              <div class="th-rd-chart-bar-row" style="animation-delay: ${i * 0.08}s;">
                <div class="th-rd-chart-rank ${rankClass}">${rankMedal}</div>
                <div class="th-rd-chart-avatar">${avatarHtml(participant, 24)}</div>
                <div class="th-rd-chart-info">
                  <div class="th-rd-chart-name">${esc(row.name)} ${i === 0 && row.score > 0 ? '<span style="font-size:12px;">👑</span>' : ''}</div>
                  <div class="th-rd-chart-bar-wrap">
                    <div class="th-rd-chart-bar-track">
                      <div class="th-rd-chart-bar-fill" style="width: ${barWidth}%; --bar-grad: ${pal.gradient}; --bar-glow: ${pal.glow};"></div>
                    </div>
                    <span class="th-rd-chart-bar-pct">${accuracy}%</span>
                  </div>
                </div>
                <div class="th-rd-chart-score">
                  <div>
                    <span class="th-rd-chart-score-big">${row.score}</span>
                    <span class="th-rd-chart-score-denom">/ ${maxPoints}</span>
                  </div>
                  <span class="th-rd-chart-score-badge" style="background: ${pal.accent}; color: ${pal.color};">${row.score} PTS</span>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;

      // Build table view
      const tableHtml = `
        <div class="th-rd-view-table th-rd-table-container">
          <div class="th-rd-table-title">
            <span>📋 Scorecard Overview</span>
          </div>
          <table class="th-rd-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th></th>
                <th>Name</th>
                <th>Score</th>
                <th>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row, i) => {
                const pal = PALETTES[i % PALETTES.length];
                const accuracy = maxPoints > 0 ? Math.round((row.score / maxPoints) * 100) : 0;
                const rankMedal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
                const rankClass = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "other";
                const trClass = i === 0 ? "rank-gold" : "";
                const participant = { id: row.id, name: row.name };
                const accColor = accuracy >= 80 ? '#059669' : accuracy >= 50 ? '#d97706' : '#dc2626';
                const accBg = accuracy >= 80 ? '#dcfce7' : accuracy >= 50 ? '#fef3c7' : '#fee2e2';

                return `
                  <tr class="${trClass}" style="animation-delay: ${i * 0.06}s;">
                    <td><span class="th-rd-table-rank-badge" style="background: ${pal.accent}; color: ${pal.color};">${rankMedal}</span></td>
                    <td><div class="th-rd-table-avatar">${avatarHtml(participant, 18, 'th-rd-table-avatar-placeholder')}</div></td>
                    <td><span class="th-rd-table-name">${esc(row.name)} ${i === 0 && row.score > 0 ? '👑' : ''}</span></td>
                    <td><span class="th-rd-table-score">${row.score} / ${maxPoints}</span></td>
                    <td><span class="th-rd-table-accuracy" style="background: ${accBg}; color: ${accColor};">${accuracy}%</span></td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `;

      target.innerHTML = chartHtml + tableHtml;

      // Apply current view state
      target.classList.remove('show-table', 'show-both');
      if (currentResultsView === 'table') {
        target.classList.add('show-table');
      } else if (currentResultsView === 'both') {
        target.classList.add('show-both');
      }
    } else {
      // Legacy bar graph rendering (non-redesign)
      target.innerHTML = `
        <div class="th-bargraph-list ${rows.length >= 4 ? 'multi-col' : ''}">
          ${rows.map((row, i) => {
            const pal = PALETTES[i % PALETTES.length];
            const isLeader = i === 0 && row.score > 0;
            const relPct = maxScored > 0 ? (row.score / maxScored) * 100 : 0;
            const barWidth = row.score === 0 ? 5 : Math.max(12, Math.round(relPct * 0.96));
            const accuracy = maxPoints > 0 ? Math.round((row.score / maxPoints) * 100) : 0;
            const rankMedal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
            const rankClass = i === 0 ? "rank-1" : i === 1 ? "rank-2" : i === 2 ? "rank-3" : "rank-other";

            return `
              <div class="th-bar-card ${rankClass}" style="--bar-color: ${pal.color}; --bar-gradient: ${pal.gradient}; --bar-glow: ${pal.glow}; --bar-accent: ${pal.accent}; animation-delay: ${i * 0.08}s;">
                <div class="th-bar-meta">
                  <div class="th-bar-identity">
                    <div class="th-rank-pill ${rankClass}">${rankMedal}</div>
                    <div class="th-team-badge" style="background: ${pal.accent}; color: ${pal.color};">${pal.icon}</div>
                    <div class="th-team-name-wrap">
                      <span class="th-team-title">${esc(row.name)}</span>
                      ${isLeader ? '<span class="th-badge-leader">👑 LEADER</span>' : ''}
                    </div>
                  </div>
                  <div class="th-bar-score">
                    <div class="th-score-numbers">
                      <b class="th-score-big">${row.score}</b>
                      <span class="th-score-denom">/ ${maxPoints}</span>
                    </div>
                    <span class="th-score-badge" style="background: ${pal.accent}; color: ${pal.color};">${row.score} PTS</span>
                  </div>
                </div>
                <div class="th-bar-track-container">
                  <div class="th-bar-track">
                    <div class="th-bar-fill" style="width: ${barWidth}%;">
                      <div class="th-bar-shimmer"></div>
                    </div>
                  </div>
                  <span class="th-bar-pct">${accuracy}%</span>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }
  }

  // Render 3D player cards in the waiting screen
  function renderPlayerCards(participants) {
    const grid = document.getElementById("playersGrid");
    if (!grid) return;
    if (!participants || !participants.length) {
      grid.innerHTML = '<p style="color:#8e87ad;font:500 14px Outfit,sans-serif;text-align:center;padding:12px;">Waiting for players to join…</p>';
      return;
    }
    grid.innerHTML = participants.map((p, i) => {
      const pal = PALETTES[i % PALETTES.length];
      const participant = { id: p.id, name: p.name };
      return `
        <div class="th-rd-player-card" style="animation-delay: ${i * 0.08}s; --card-index: ${i};">
          <div class="th-rd-player-card-inner" style="--card-gradient: ${pal.cardGrad};">
            <div class="th-rd-player-avatar">
              ${avatarHtml(participant, 36, 'th-rd-player-avatar-placeholder')}
            </div>
            <div class="th-rd-player-name" title="${esc(p.name)}">${esc(p.name)}</div>
            <div class="th-rd-player-status">${p.online !== false ? 'READY' : 'OFFLINE'}</div>
          </div>
        </div>
      `;
    }).join("");
  }

  function optionHtml(q, part) {
    const opts = answerFields(q, part);
    return `<label class="th-team-answer"><span>${part === "q2" ? "Part 2" : "Answer"}</span><select data-part="${part}">${opts.map(o => `<option value="${o.value}">${o.label} · ${esc(o.text)}</option>`).join("")}</select></label>`;
  }
  function renderQuestion(target, q, index, interactive) {
    if (!target) return;
    target.innerHTML = `<div class="mcq-enter">${QuestionBank.formatMcq(q,index+1)}</div>`;
    if (!interactive) return;
    activeQuestion = q;
    studentAnswers = {};
    answerSubmitted = false;
    const parts = Object.keys(expectedParts(q));
    const buttons = target.querySelectorAll(".mcq-option[data-opt]");
    buttons.forEach(option => {
      option.setAttribute("role","button");
      option.setAttribute("tabindex","0");
      option.onclick = () => {
        if (answerSubmitted) return;
        const group = option.closest('.mcq-sub-question');
        const part = group?.dataset.sub === "2" ? "q2" : group?.dataset.sub === "1" ? "q1" : "q1";
        if (studentAnswers[part] !== undefined) return;
        studentAnswers[part] = option.dataset.opt;
        option.classList.add("selected");
        if (group) group.querySelectorAll('.mcq-option').forEach(el => { if (el !== option) el.classList.add("answer-locked"); });
        else target.querySelectorAll('.mcq-option').forEach(el => { if (el !== option) el.classList.add("answer-locked"); });
        if (parts.every(key => studentAnswers[key] !== undefined)) submitStudentAnswer();
      };
      option.onkeydown = event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); option.click(); } };
    });
  }
  function submitStudentAnswer() {
    if (answerSubmitted) return;
    answerSubmitted = true;
    document.querySelectorAll('#studentQuestion .mcq-option').forEach(el => el.classList.add("answer-locked"));
    socket.emit("th:answer", {answer:{...studentAnswers}});
  }
  function join(role,name) {
    const payload = {code,name,role};
    if (studentPhotoData && role === 'student') {
      payload.photo = studentPhotoData;
    }
    socket.emit("th:join", payload);
  }

  // Listen for photo broadcasts
  socket.on("th:photos", photos => {
    if (photos && typeof photos === 'object') {
      participantPhotos = { ...participantPhotos, ...photos };
    }
  });

  socket.on("th:state", s => {
    state=s;

    // Update participant photos from state
    if (s.participants) {
      s.participants.forEach(p => {
        if (p.photo) {
          participantPhotos[p.id] = p.photo;
          participantPhotos[p.name] = p.photo;
        }
      });
    }

    const participants=document.getElementById("participants");
    if(participants) participants.innerHTML=s.participants.map(p=>`<span class="pill">${esc(p.name)}${p.online===false?" · offline":" · ready"}</span>`).join("")||'<span class="muted">Waiting for students to join…</span>';
    showScores(document.getElementById("scores"),s); showScores(document.getElementById("screenScores"),s);

    // Render player cards if in redesign mode
    if (document.body.classList.contains('th-redesign')) {
      renderPlayerCards(s.participants);
    }

    const roster=document.getElementById("screenPeople");
    if(roster) {
      if (document.body.classList.contains('th-redesign')) {
        roster.innerHTML=s.participants.map(p=>{
          const photo = participantPhotos[p.id] || participantPhotos[p.name];
          const avatar = photo 
            ? `<img src="${esc(photo)}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:5px;">` 
            : `<span style="display:inline-block;width:20px;height:20px;border-radius:50%;vertical-align:middle;margin-right:5px;overflow:hidden;">${getStudentPlaceholderAvatar(p.name, 20)}</span>`;
          return `<span class="pill">${avatar}${esc(p.name)}</span>`;
        }).join("");
      } else {
        roster.innerHTML=s.participants.map(p=>`<span class="pill">${esc(p.name)}</span>`).join("");
      }
    }

    const hasPlayers = Boolean(s.participants && s.participants.length > 0);
    const waiting=document.getElementById("thWaiting"), card=document.getElementById("questionCard"), finalScreen=document.getElementById("screenFinal");
    if(waiting) {
      waiting.hidden = s.status !== "waiting";
      waiting.classList.toggle("has-players", hasPlayers);
    }
    const waitingHero = document.getElementById("waitingHero");
    if(waitingHero) {
      waitingHero.style.display = hasPlayers ? "none" : "";
    }
    if(card)card.hidden=s.status!=="running";
    const progress=document.getElementById("progressText"); if(progress&&s.questions.length)progress.textContent=`ROUND ${Math.min(s.questionIndex+1,s.questions.length)} / ${s.questions.length}`;
    if(s.status==="finished"){
      const final=document.getElementById("finalScores"); 
      if(final){
        showScores(final,s);
        const resultsSection = document.getElementById("results");
        if(resultsSection) {
          resultsSection.hidden=false;
          launchConfetti(resultsSection);
        }
        const playSection = document.getElementById("play");
        if(playSection) playSection.hidden=true;
      }
      if(finalScreen){
        showScores(document.getElementById("screenScores"),s);
        finalScreen.hidden=false;
        launchConfetti(finalScreen);
      }
    }
  });

  socket.on("th:question", packet => {
    clearInterval(timerHandle);
    const {answer,q2_answer,...q}=packet;
    activeQuestion=q;
    const index=packet.index;
    renderQuestion(document.getElementById("question"),q,index,false);
    renderQuestion(document.getElementById("studentQuestion"),q,index,true);
    renderQuestion(document.getElementById("teacherQuestion"),q,index,false);
    const reveal=document.getElementById("screenAnswer");if(reveal)reveal.textContent="";
    const teamReveal=document.getElementById("teamNotice");if(teamReveal)teamReveal.textContent="";
    const status=document.getElementById("studentStatus");if(status)status.textContent="Choose your answer";
    const counter=document.getElementById("screenTimer");const bar=document.getElementById("timerProgress");
    const teams=document.getElementById("teamControls");
    if(teams&&state?.mode==="teams"){
      teams.innerHTML=`<p class="muted">Record each team's attempt. Each correct part earns one point.</p><div class="team-entry"><label>Team<select id="attemptTeam">${state.teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></label>${Object.keys(expectedParts(q)).map(part=>optionHtml(q,part)).join("")}<button id="recordAttempt" class="primary">Record attempt</button><button id="nextQuestion" class="secondary">Reveal answer & continue</button></div>`;
      document.getElementById("recordAttempt").onclick=()=>{const answer={};teams.querySelectorAll('select[data-part]').forEach(select=>answer[select.dataset.part]=select.value);socket.emit("th:team-attempt",{teamId:document.getElementById("attemptTeam").value,answer});};
      document.getElementById("nextQuestion").onclick=()=>socket.emit("th:next");
    }else if(teams){teams.innerHTML='<button id="advanceQuestion" class="secondary">Reveal answer & continue</button>';document.getElementById("advanceQuestion").onclick=()=>socket.emit("th:advance");}
    const ends=packet.endsAt;
    timerHandle=setInterval(()=>{
      const remaining=Math.max(0,Math.ceil((ends-Date.now())/1000));
      if(counter)counter.textContent=`${remaining.toString().padStart(2,"0")}s`;
      if(bar)bar.style.width=`${Math.max(0,Math.min(100,remaining/(state?.timer||30)*100))}%`;
      const studentCounter=document.getElementById("countdown");if(studentCounter)studentCounter.textContent=`${remaining}s`;
      const studentBar=document.getElementById("studentTimerBar");if(studentBar)studentBar.style.width=`${Math.max(0,Math.min(100,remaining/(state?.timer||30)*100))}%`;
      if(!remaining){clearInterval(timerHandle);if(!answerSubmitted&&document.getElementById("studentQuestion"))submitStudentAnswer();if(status)status.textContent="Time is up · answer revealed";}
    },200);
  });
  socket.on("th:answer-result",r=>{const note=document.getElementById("answerNotice");if(note)note.textContent=r.correct?`✅ Correct · ${r.points} point${r.points===1?"":"s"}`:`Answer submitted · ${r.points}/${r.maxPoints} correct`;});
  socket.on("th:team-result",r=>{const note=document.getElementById("teamNotice");if(note)note.textContent=`${r.teamName}: ${r.correct?"Correct":"Attempt recorded"} · ${r.points}/${r.maxPoints} point${r.points===1?"":"s"}`;});
  socket.on("th:reveal",r=>{
    const screenTimer=document.getElementById("screenTimer");if(screenTimer)screenTimer.textContent="ANSWER";
    const answers=typeof r.answer==="object"?r.answer:{q1:String(r.answer)};
    Object.entries(answers).forEach(([part,key])=>{
      const selector=part==="q2"?`.mcq-sub-question[data-sub="2"]`:`.mcq-sub-question[data-sub="1"]`;
      const roots=document.querySelectorAll("#question, #studentQuestion, #teacherQuestion");
      roots.forEach(root=>{
        let container=root.querySelector(selector);
        if(!container&&Number(activeQuestion?.type)!==4)container=root;
        if(container)container.querySelectorAll('.mcq-option[data-opt]').forEach(el=>{if(String(el.dataset.opt)===String(key))el.classList.add("correct");else el.classList.add("wrong-dim");});
      });
    });
    const text=typeof r.answerText==="object"?Object.entries(r.answerText).map(([k,v])=>`${k.toUpperCase()}: ${v||answers[k]}`).join(" · "):r.answerText?`Correct answer: ${r.answerText}`:`Correct answer: ${JSON.stringify(r.answer)}`;
    const screen=document.getElementById("screenAnswer");if(screen)screen.textContent=text;
    const student=document.getElementById("answerNotice");if(student)student.textContent=text;
  });
  socket.on("th:error",e=>{
    const message=document.getElementById("message");if(message)message.textContent=e.message;
    if(document.getElementById("join")&&document.getElementById("play")){
      document.getElementById("join").hidden=false;
      document.getElementById("play").hidden=true;
      document.querySelector('.th-student-shell')?.classList.remove('in-game');
      if (goToStepFn) goToStepFn(1);
    }
  });

  // ── Step form navigation for redesign ──
  function setupStepNavigation() {
    const steps = document.querySelectorAll('.th-rd-step');
    const stepLines = document.querySelectorAll('.th-rd-step-line');
    const formSteps = [
      document.getElementById('formStep1'),
      document.getElementById('formStep2'),
      document.getElementById('formStep3')
    ];

    if (!formSteps[0]) return; // Not on student page or not redesign

    function goToStep(num) {
      formSteps.forEach((s, i) => {
        if (s) {
          s.classList.toggle('active', i === num - 1);
        }
      });
      steps.forEach((s, i) => {
        s.classList.remove('active', 'completed');
        if (i < num - 1) s.classList.add('completed');
        if (i === num - 1) s.classList.add('active');
      });
      stepLines.forEach((l, i) => {
        l.classList.toggle('filled', i < num - 1);
      });

      // Update ready preview on step 3
      if (num === 3) {
        const name = document.getElementById('studentName')?.value?.trim() || 'Player';
        const codeVal = document.getElementById('joinCode')?.value?.trim().toUpperCase() || 'CODE';
        const readyName = document.getElementById('readyName');
        const readyCode = document.getElementById('readyCode');
        const readyImg = document.getElementById('readyAvatarImg');
        const readyPlaceholder = document.getElementById('readyAvatarPlaceholder');
        if (readyName) readyName.textContent = name;
        if (readyCode) readyCode.textContent = codeVal;
        if (studentPhotoData && readyImg) {
          readyImg.src = studentPhotoData;
          readyImg.style.display = '';
          if (readyPlaceholder) readyPlaceholder.style.display = 'none';
        } else {
          if (readyImg) readyImg.style.display = 'none';
          if (readyPlaceholder) {
            readyPlaceholder.innerHTML = getStudentPlaceholderAvatar(name, 48);
            readyPlaceholder.style.display = '';
          }
        }
      }
    }
    goToStepFn = goToStep;

    // Step 1 -> 2
    document.getElementById('toStep2')?.addEventListener('click', () => {
      const codeInput = document.getElementById('joinCode');
      const nameInput = document.getElementById('studentName');
      const msg = document.getElementById('message');
      if (!codeInput.value.trim() || !nameInput.value.trim()) {
        if (msg) msg.textContent = 'Please enter both the session code and your name.';
        return;
      }
      if (msg) msg.textContent = '';
      goToStep(2);
    });

    // Enter key shortcuts
    const codeInput = document.getElementById('joinCode');
    const nameInput = document.getElementById('studentName');
    codeInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        nameInput?.focus();
      }
    });
    nameInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('toStep2')?.click();
      }
    });

    // Step 2 -> 1
    document.getElementById('backToStep1')?.addEventListener('click', () => goToStep(1));

    // Step 2 -> 3
    document.getElementById('toStep3')?.addEventListener('click', () => goToStep(3));

    // Step 3 -> 2
    document.getElementById('backToStep2')?.addEventListener('click', () => goToStep(2));

    // Step 3 enter key to join
    document.addEventListener('keydown', e => {
      const step3 = document.getElementById('formStep3');
      if (step3 && step3.classList.contains('active') && e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('joinButton')?.click();
      }
    });

    // Photo upload with centered-square compression
    const photoPreview = document.getElementById('photoPreview');
    const photoInput = document.getElementById('photoInput');
    const photoImg = document.getElementById('photoImg');
    const photoPlaceholder = document.getElementById('photoPlaceholder');
    const removePhotoBtn = document.getElementById('removePhoto');

    if (photoPreview && photoInput) {
      photoPreview.addEventListener('click', (e) => {
        if (e.target === removePhotoBtn || removePhotoBtn?.contains(e.target)) return;
        photoInput.click();
      });

      photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Resize, center-crop square, and compress the image
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = 160;
            canvas.width = size;
            canvas.height = size;
            const minDim = Math.min(img.width, img.height);
            const sx = (img.width - minDim) / 2;
            const sy = (img.height - minDim) / 2;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
            studentPhotoData = canvas.toDataURL('image/jpeg', 0.75);

            if (photoImg) {
              photoImg.src = studentPhotoData;
              photoImg.style.display = '';
            }
            if (photoPlaceholder) photoPlaceholder.style.display = 'none';
            if (removePhotoBtn) removePhotoBtn.style.display = '';
            if (photoPreview) photoPreview.classList.add('has-photo');
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      });

      if (removePhotoBtn) {
        removePhotoBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          studentPhotoData = null;
          if (photoImg) { photoImg.src = ''; photoImg.style.display = 'none'; }
          if (photoPlaceholder) photoPlaceholder.style.display = '';
          removePhotoBtn.style.display = 'none';
          if (photoPreview) photoPreview.classList.remove('has-photo');
          photoInput.value = '';
        });
      }
    }
  }

  // ── Tab switching for results (supports Chart / Table / Both) ──
  function setupResultsTabs() {
    const tabConfigs = [
      { id: 'tabChart', view: 'chart' },
      { id: 'tabTable', view: 'table' },
      { id: 'tabBoth', view: 'both' },
      { id: 'tabChartStudent', view: 'chart' },
      { id: 'tabTableStudent', view: 'table' },
      { id: 'tabBothStudent', view: 'both' }
    ];

    tabConfigs.forEach(t => {
      const btn = document.getElementById(t.id);
      if (!btn) return;
      btn.addEventListener('click', () => {
        currentResultsView = t.view;
        const parent = btn.parentElement;
        if (parent) {
          parent.querySelectorAll('.th-rd-tab').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
        document.querySelectorAll('.th-rd-scores-container').forEach(c => {
          c.classList.remove('show-table', 'show-both');
          if (t.view === 'table') c.classList.add('show-table');
          else if (t.view === 'both') c.classList.add('show-both');
        });
      });
    });
  }

  window.TalentHunt={
    teacher(){
      let questions=[];
      const loadTopics=async()=>{const params=new URLSearchParams({paper:document.getElementById("paper").value});const chapter=document.getElementById("chapter").value.trim();if(chapter)params.set("chapter",chapter);const topics=await fetch("/api/mcq/topics?"+params).then(r=>r.json()).catch(()=>[]);document.getElementById("topicOptions").innerHTML=topics.map(t=>`<option value="${esc(t)}">`).join("");};
      const loadChapters=async()=>{const chapters=await fetch("/api/mcq/chapters").then(r=>r.json()).catch(()=>[]);document.getElementById("chapterOptions").innerHTML=chapters.map(c=>`<option value="${esc(c)}">`).join("");await loadTopics();};
      document.getElementById("paper").onchange=loadTopics;document.getElementById("chapter").onchange=loadTopics;
      document.getElementById("mode").onchange=e=>document.getElementById("teamField").hidden=e.target.value!=="teams";
      document.getElementById("copyStudent").onclick=async()=>{const input=document.getElementById("studentLink");try{await navigator.clipboard.writeText(input.value);document.getElementById("copyStudent").textContent="Copied";}catch(_){input.select();document.execCommand("copy");}};
      document.getElementById("load").onclick=async()=>{
        const params=new URLSearchParams({paper:document.getElementById("paper").value,amount:document.getElementById("amount").value});
        for(const key of ["chapter","topics"]){const value=document.getElementById(key).value.trim();if(value)params.set(key,value);}
        if(document.getElementById("board").checked)params.set("boardOnly","true");if(document.getElementById("important").checked)params.set("importantOnly","true");
        const info=document.getElementById("questionInfo");info.textContent="Loading matching MCQ types…";
        try{questions=await fetch("/api/mcq?"+params).then(r=>r.json());questions=questions.filter(q=>[1,2,3,4].includes(Number(q.type))&&Object.keys(expectedParts(q)).length>0);info.textContent=`${questions.length} questions loaded · Types 1–4 included · Question order is fixed for the session.`;}catch(_){info.textContent="Could not load the question bank.";}
      };
      document.getElementById("create").onclick=async()=>{
        if(!questions.length){document.getElementById("questionInfo").textContent="Load matching MCQ questions first.";return;}
        const response=await fetch("/api/talent-hunt/sessions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({questions,mode:document.getElementById("mode").value,timer:document.getElementById("timer").value,teamCount:document.getElementById("teamCount").value})});
        const result=await response.json();if(!response.ok){document.getElementById("questionInfo").textContent=result.error;return;}
        code=result.code;document.getElementById("live").hidden=false;document.getElementById("code").textContent=code;
        document.getElementById("studentLink").value=`${location.origin}${location.pathname.replace("talent-hunt-dashboard.html","talent-hunt-student.html")}?code=${code}`;
        join("teacher","Teacher");
      };
      document.getElementById("start").onclick=()=>socket.emit("th:start");document.getElementById("finish").onclick=()=>socket.emit("th:finish");loadChapters();
    },
    screen(){
      const title=document.getElementById("screenTitle");
      const attach=c=>{if(code===c)return;code=c;document.getElementById("screenCode").textContent=c;title.textContent="Connecting to Talent Hunt…";join("projector","Projector");};
      socket.on("classroom-navigate", data => { if(data?.url) window.location.href=data.url; });
      socket.on("th:session",d=>attach(d.code));
      const requested=new URLSearchParams(location.search).get("code");
      if(requested)attach(requested);else fetch("/api/talent-hunt/current").then(r=>{if(!r.ok)throw Error();return r.json();}).then(s=>attach(s.code)).catch(()=>{title.textContent="Talent Hunt · Waiting for teacher";document.getElementById("thWaiting").hidden=false;});
      setupResultsTabs();
    },
    student(){
      const query=new URLSearchParams(location.search).get("code");if(query)document.getElementById("joinCode").value=query;

      // Setup step navigation for redesign
      if (document.body.classList.contains('th-redesign')) {
        setupStepNavigation();
        setupResultsTabs();
      }

      document.getElementById("joinButton").onclick=()=>{
        code=document.getElementById("joinCode").value.trim().toUpperCase();
        const name=document.getElementById("studentName").value.trim();
        if(!code||!name){document.getElementById("message").textContent="Enter both the code and your name.";return;}
        document.getElementById("join").hidden=true;
        document.getElementById("play").hidden=false;
        document.querySelector('.th-student-shell')?.classList.add('in-game');
        const waitHeading = document.getElementById("studentWaitHeading");
        if (waitHeading) waitHeading.textContent = `Welcome, ${esc(name)}! 🚀`;
        join("student",name);
      };
    }
  };
})();

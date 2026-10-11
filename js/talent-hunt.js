(function () {
  const socket = io();
  let code = "", state = null, timerHandle = null, activeQuestion = null;
  let studentAnswers = {}, answerSubmitted = false;

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
  const scoreRows = s => (s.mode === "teams" ? s.teams.map(t => ({name:t.name,score:t.score})) : s.participants.map(p => ({name:p.name,score:p.score}))).sort((a,b) => b.score-a.score);
  function showScores(target, s) {
    if (!target) return;
    const maxPoints = Number(s.maxPoints) || s.questions?.length || 0;
    target.innerHTML = scoreRows(s).map((row,i) => `<div class="score-row"><span>${i+1}. ${esc(row.name)}</span><b>${row.score} / ${maxPoints}</b></div>`).join("") || '<p class="muted">No players have joined yet.</p>';
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
  function join(role,name) { socket.emit("th:join",{code,name,role}); }

  socket.on("th:state", s => {
    state=s;
    const participants=document.getElementById("participants");
    if(participants) participants.innerHTML=s.participants.map(p=>`<span class="pill">${esc(p.name)}${p.online===false?" · offline":" · ready"}</span>`).join("")||'<span class="muted">Waiting for students to join…</span>';
    showScores(document.getElementById("scores"),s); showScores(document.getElementById("screenScores"),s);
    const roster=document.getElementById("screenPeople"); if(roster)roster.innerHTML=s.participants.map(p=>`<span class="pill">${esc(p.name)}</span>`).join("");
    const title=document.getElementById("screenTitle"); if(title)title.textContent=s.status==="waiting"?"Players, get ready!":s.status==="finished"?"Talent Hunt · Final results":`Talent Hunt · ${s.mode==="teams"?"Team challenge":"Individual challenge"}`;
    const waiting=document.getElementById("thWaiting"), card=document.getElementById("questionCard"), finalScreen=document.getElementById("screenFinal");
    if(waiting)waiting.hidden=s.status!=="waiting";
    if(card)card.hidden=s.status!=="running";
    const progress=document.getElementById("progressText"); if(progress&&s.questions.length)progress.textContent=`ROUND ${Math.min(s.questionIndex+1,s.questions.length)} / ${s.questions.length}`;
    if(s.status==="finished"){
      const final=document.getElementById("finalScores"); if(final){showScores(final,s);document.getElementById("results").hidden=false;document.getElementById("play").hidden=true;}
      if(finalScreen){showScores(document.getElementById("screenScores"),s);finalScreen.hidden=false;}
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
    if(document.getElementById("join")&&document.getElementById("play")){document.getElementById("join").hidden=false;document.getElementById("play").hidden=true;}
  });

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
    },
    student(){
      const query=new URLSearchParams(location.search).get("code");if(query)document.getElementById("joinCode").value=query;
      document.getElementById("joinButton").onclick=()=>{code=document.getElementById("joinCode").value.trim().toUpperCase();const name=document.getElementById("studentName").value.trim();if(!code||!name){document.getElementById("message").textContent="Enter both the code and your name.";return;}document.getElementById("join").hidden=true;document.getElementById("play").hidden=false;join("student",name);};
    }
  };
})();

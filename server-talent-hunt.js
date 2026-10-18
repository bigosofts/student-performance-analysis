const fs = require('fs');
const path = require('path');

module.exports = function (app, io, uploadsDir) {
  const storeDir = process.env.TALENT_HUNT_DATA_DIR
    ? path.resolve(process.env.TALENT_HUNT_DATA_DIR)
    : path.join(uploadsDir, '.talent-hunt-data');
  const legacyStorePath = path.join(path.dirname(uploadsDir), '.talent-hunt-data', 'sessions.json');
  if (!fs.existsSync(storeDir)) fs.mkdirSync(storeDir, { recursive: true });
  const storePath = path.join(storeDir, 'sessions.json');
  if (!fs.existsSync(storePath) && fs.existsSync(legacyStorePath)) {
    try { fs.copyFileSync(legacyStorePath, storePath); } catch (_) {}
  }
  let sessions = {};
  try { sessions = JSON.parse(fs.readFileSync(storePath, 'utf8')); } catch (_) {}
  Object.values(sessions).forEach(s => { if (s.status === 'running') { s.status = 'waiting'; s.questionEndsAt = null; s.revealing = false; } });
  const persist = () => fs.writeFileSync(storePath, JSON.stringify(sessions, null, 2));
  const publicSession = (s) => ({ code:s.code, mode:s.mode, teamCount:s.teamCount, timer:s.timer, maxPoints:s.questions.length, status:s.status, questionIndex:s.questionIndex, questions:s.questions.map(({answer,q2_answer,...q})=>q), participants:Object.values(s.participants), teams:s.teams, scores:s.scores });
  const sendState = (s) => io.to(`talent:${s.code}`).emit('th:state', publicSession(s));
  const currentQuestion = (s) => {
    const { answer, q2_answer, ...q } = s.questions[s.questionIndex] || {};
    return { ...q, index:s.questionIndex, total:s.questions.length, endsAt:s.questionEndsAt };
  };
  const code = () => { let c; do { c = Math.random().toString(36).slice(2,7).toUpperCase(); } while (sessions[c] && sessions[c].status !== 'finished'); return c; };
  let currentCode = Object.values(sessions).filter(s => s.status !== 'finished').sort((a,b) => b.createdAt-a.createdAt)[0]?.code || null;
  const finish = (s) => { clearTimeout(timers[s.code]); s.status='finished'; s.questionEndsAt=null; persist(); sendState(s); };
  const timers = {};
  const scheduleAdvance = (s) => { clearTimeout(timers[s.code]); timers[s.code] = setTimeout(() => revealAnswer(s), s.timer * 1000); };
  const revealAnswer = (s) => {
    if (s.status !== 'running' || s.revealing) return;
    clearTimeout(timers[s.code]);
    s.revealing = true;
    const q = s.questions[s.questionIndex];
    const getAnswerText = (value, part) => {
      if (Number(q.type) === 4 && part === 'q2') return q.q2_type === 'point' ? q[`q2_combo_option_${value}`] : q[`q2_option_${String(value).toLowerCase()}`];
      if (Number(q.type) === 2 || Number(q.type) === 4) return q[`combo_option_${value}`];
      return q[`option_${String(value).toLowerCase()}`];
    };
    const answer = Number(q.type) === 4
      ? { ...(q.question ? { q1:String(q.answer) } : {}), ...(q.question2 ? { q2:String(q.q2_answer) } : {}) }
      : String(q.answer);
    const answerText = Number(q.type) === 4
      ? { ...(q.question ? { q1:getAnswerText(q.answer,'q1')||'' } : {}), ...(q.question2 ? { q2:getAnswerText(q.q2_answer,'q2')||'' } : {}) }
      : getAnswerText(q.answer,'q1')||'';
    io.to(`talent:${s.code}`).emit('th:reveal', { index:s.questionIndex, answer, answerText });
    persist();
    timers[s.code] = setTimeout(() => advance(s), 2500);
  };
  const advance = (s) => { if (s.status !== 'running') return; if (s.questionIndex + 1 >= s.questions.length) return finish(s); s.questionIndex++; s.revealing=false; s.questionEndsAt=Date.now()+s.timer*1000; persist(); io.to(`talent:${s.code}`).emit('th:question', currentQuestion(s)); sendState(s); scheduleAdvance(s); };
  app.post('/api/talent-hunt/sessions', (req,res) => {
    const {questions,mode,timer,teamCount}=req.body||{};
    if (!Array.isArray(questions)||!questions.length||!['individual','teams'].includes(mode)) return res.status(400).json({error:'Choose at least one MCQ and a valid game mode.'});
    const isPlayable = q => {
      if (!q || ![1, 2, 3, 4].includes(Number(q.type))) return false;
      if (Number(q.type) === 4) return (q.question ? q.answer && q.combo_option_1 : true) && (q.question2 ? q.q2_answer && (q.q2_type === 'point' ? q.q2_combo_option_1 : q.q2_option_a) : true) && (q.question || q.question2);
      return q.answer && (Number(q.type) === 2 ? q.combo_option_1 : q.option_a);
    };
    if (questions.some(q => !isPlayable(q))) return res.status(400).json({error:'Each MCQ needs its answer and available options.'});
    const c=code(), seconds=Math.max(5,Math.min(300,Number(timer)||30));
    const maxPoints=questions.length;
    sessions[c]={code:c,mode,timer:seconds,maxPoints,teamCount:mode==='teams'?[2,4,6].includes(Number(teamCount))?Number(teamCount):2:0,questions,questionIndex:0,status:'waiting',participants:{},teams:mode==='teams'?Array.from({length:[2,4,6].includes(Number(teamCount))?Number(teamCount):2},(_,i)=>({id:i+1,name:`Team ${i+1}`,score:0})):[],scores:{},attempts:[],questionEndsAt:null,createdAt:Date.now()};
    currentCode=c; persist(); io.emit('th:session', {code:c}); res.json({code:c});
  });
  app.get('/api/talent-hunt/sessions/:code', (req,res)=>{ const s=sessions[String(req.params.code).toUpperCase()]; if(!s)return res.status(404).json({error:'Session not found'}); res.json(publicSession(s)); });
  app.get('/api/talent-hunt/current', (_req,res)=>{ const s=currentCode&&sessions[currentCode]; if(!s || s.status==='finished')return res.status(404).json({error:'No active Talent Hunt'}); res.json({code:s.code,...publicSession(s)}); });
  io.on('connection', socket => {
    socket.on('th:join', ({code:raw,name,role})=>{
      const c=String(raw||'').trim().toUpperCase(), s=sessions[c];
      if(!s || s.status==='finished'){ socket.emit('th:error',{message:'Session code is invalid or the hunt has finished.'}); return; }
      if(role==='teacher' || role==='projector') { socket.join(`talent:${c}`); socket.data.th={code:c,role}; sendState(s); if(s.status==='running')socket.emit('th:question',currentQuestion(s)); return; }
      const clean=String(name||'').trim().slice(0,40); if(!clean){socket.emit('th:error',{message:'Enter your name.'});return;}
      const existing=Object.values(s.participants).find(p=>p.name.toLowerCase()===clean.toLowerCase());
      const p=existing||{id:socket.id,name:clean,ready:true,score:0,answers:0}; p.socketId=socket.id; p.online=true; s.participants[p.id]=p;
      socket.join(`talent:${c}`); socket.data.th={code:c,role:'student',participantId:p.id}; persist(); sendState(s);
      if(s.status==='running')socket.emit('th:question',currentQuestion(s));
    });
    socket.on('th:start',()=>{const x=socket.data.th,s=x&&sessions[x.code];if(!s||x.role!=='teacher'||s.status!=='waiting')return;s.status='running';s.questionIndex=0;s.questionEndsAt=Date.now()+s.timer*1000;persist();io.to(`talent:${s.code}`).emit('th:question',currentQuestion(s));sendState(s);scheduleAdvance(s);});
    socket.on('th:answer',({answer})=>{const x=socket.data.th,s=x&&sessions[x.code];if(!s||x.role!=='student'||s.mode!=='individual'||s.status!=='running'||s.revealing||Date.now()>s.questionEndsAt)return;const p=s.participants[x.participantId];if(!p||p.lastQuestion===s.questionIndex)return;p.lastQuestion=s.questionIndex;p.answers++;const q=s.questions[s.questionIndex];const submitted=answer&&typeof answer==='object'?answer:{q1:answer};const expected=Number(q.type)===4?{...(q.question?{q1:q.answer}:{}),...(q.question2?{q2:q.q2_answer}:{})}:{q1:q.answer};let points=0;for(const [part,key]of Object.entries(expected))if(String(submitted[part]||'')===String(key))points++;const correct=points===Object.keys(expected).length;p.score+=points;socket.emit('th:answer-result',{correct,points,maxPoints:Object.keys(expected).length});persist();sendState(s);});
    socket.on('th:team-attempt',({teamId,answer})=>{const x=socket.data.th,s=x&&sessions[x.code];if(!s||x.role!=='teacher'||s.mode!=='teams'||s.status!=='running'||s.revealing||Date.now()>s.questionEndsAt)return;const team=s.teams.find(t=>t.id===Number(teamId));if(!team)return;if(s.attempts.some(a=>a.question===s.questionIndex&&a.teamId===team.id)){socket.emit('th:error',{message:`${team.name} already attempted this question.`});return;}const q=s.questions[s.questionIndex],submitted=answer&&typeof answer==='object'?answer:{q1:answer};const expected=Number(q.type)===4?{...(q.question?{q1:q.answer}:{}),...(q.question2?{q2:q.q2_answer}:{})}:{q1:q.answer};let points=0;for(const [part,key]of Object.entries(expected))if(String(submitted[part]||'')===String(key))points++;const correct=points===Object.keys(expected).length;s.attempts.push({question:s.questionIndex,teamId:team.id,answer:submitted,correct,points,at:Date.now()});team.score+=points;persist();io.to(`talent:${s.code}`).emit('th:team-result',{teamId:team.id,teamName:team.name,correct,points,maxPoints:Object.keys(expected).length});sendState(s);});
    socket.on('th:next',()=>{const x=socket.data.th,s=x&&sessions[x.code];if(s&&x.role==='teacher'&&s.mode==='teams'&&s.status==='running')revealAnswer(s);});
    socket.on('th:advance',()=>{const x=socket.data.th,s=x&&sessions[x.code];if(s&&x.role==='teacher'&&s.mode==='individual'&&s.status==='running')revealAnswer(s);});
    socket.on('th:finish',()=>{const x=socket.data.th,s=x&&sessions[x.code];if(s&&x.role==='teacher'){clearTimeout(timers[s.code]);finish(s);}});
    socket.on('disconnect',()=>{const x=socket.data.th,s=x&&sessions[x.code],p=x&&s&&s.participants[x.participantId];if(x&&x.role==='student'&&p&&p.socketId===socket.id){p.online=false;persist();sendState(s);}});
  });
};

// ============================================================
// WORD PUZZLE GAME — Game State Engine
// Follows the exact same pattern as maze.js
// ============================================================

const WP_STORAGE_KEY       = 'wordpuzzle-game-v1';
const WP_SESSIONS_KEY      = 'wordpuzzle-sessions-v1';
const WP_CURRENT_SESSION_KEY = 'wordpuzzle-current-session';
let wpCurrentSessionName   = null;

// ── Default state ──────────────────────────────────────────
let wpGame = {
  boysPoints       : 0,
  girlsPoints      : 0,
  currentTurn      : 'boys',
  gridRows         : 10,
  gridCols         : 10,
  cells            : {},  // "row,col" => { color, letter, displayLetter }
  boysImage        : null,
  girlsImage       : null,
  currentWord      : '',
  currentWordIndex : 0,
  winner           : null,
  classInfo        : '',
  sectionInfo      : '',
  lastUpdate       : Date.now(),
};

// ── Socket reference (set by each page) ──────────────────
let wpSocket = null;

// ── Audio (Web Audio API) ────────────────────────────────
const WPAudioCtx = window.AudioContext || window.webkitAudioContext;
let wpAudioCtx = null;

function getWPAudioCtx() {
  if (!wpAudioCtx) wpAudioCtx = new WPAudioCtx();
  return wpAudioCtx;
}

function playWPPaintSound(team) {
  try {
    const ctx  = getWPAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const base = team === 'boys' ? 440 : 550;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(base * 1.2, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.14);
  } catch (e) {}
}

function playWPPointsSound() {
  try {
    const ctx   = getWPAudioCtx();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.09 + 0.12);
      osc.start(ctx.currentTime + i * 0.09);
      osc.stop(ctx.currentTime + i * 0.09 + 0.14);
    });
  } catch (e) {}
}

// ── Persistence ───────────────────────────────────────────
function saveWPGame() {
  wpGame.lastUpdate = Date.now();
  localStorage.setItem(WP_STORAGE_KEY, JSON.stringify(wpGame));

  if (wpSocket) {
    wpSocket.emit('wordpuzzle-update-game', wpGame);
  }

  // Auto-save to active session
  const sessionName = localStorage.getItem(WP_CURRENT_SESSION_KEY);
  if (sessionName) {
    try {
      const sessions = JSON.parse(localStorage.getItem(WP_SESSIONS_KEY) || '{}');
      sessions[sessionName] = buildWPSessionSnapshot();
      localStorage.setItem(WP_SESSIONS_KEY, JSON.stringify(sessions));
    } catch (e) {}
  }
}

function loadWPGame() {
  const saved = localStorage.getItem(WP_STORAGE_KEY);
  if (saved) {
    try {
      const d = JSON.parse(saved);
      wpGame = {
        boysPoints       : d.boysPoints       ?? 0,
        girlsPoints      : d.girlsPoints      ?? 0,
        currentTurn      : d.currentTurn      || 'boys',
        gridRows         : d.gridRows         || 10,
        gridCols         : d.gridCols         || 10,
        cells            : d.cells            || {},
        boysImage        : d.boysImage        || null,
        girlsImage       : d.girlsImage       || null,
        currentWord      : d.currentWord      || '',
        currentWordIndex : d.currentWordIndex || 0,
        winner           : d.winner           || null,
        classInfo        : d.classInfo        || '',
        sectionInfo      : d.sectionInfo      || '',
        lastUpdate       : d.lastUpdate       || Date.now(),
      };
    } catch (e) {
      console.error('WP load error:', e);
    }
  }
}

function setWPGame(newState) {
  if (newState) {
    wpGame = newState;
    localStorage.setItem(WP_STORAGE_KEY, JSON.stringify(wpGame));
  }
}

// ── Grid Size ─────────────────────────────────────────────
function setWPGridSize(rows, cols) {
  // Preserve cells that fit within the new size
  const newCells = {};
  for (const key of Object.keys(wpGame.cells)) {
    const [r, c] = key.split(',').map(Number);
    if (r < rows && c < cols) {
      newCells[key] = wpGame.cells[key];
    }
  }
  wpGame.gridRows = rows;
  wpGame.gridCols = cols;
  wpGame.cells    = newCells;
  saveWPGame();
}

// ── Turn ──────────────────────────────────────────────────
function setWPTurn(turn) {
  wpGame.currentTurn = turn;
  saveWPGame();
}

function switchWPTurn() {
  wpGame.currentTurn = wpGame.currentTurn === 'boys' ? 'girls' : 'boys';
  saveWPGame();
}

// ── Points ────────────────────────────────────────────────
function setWPPoints(team, points) {
  const val = parseInt(points, 10);
  if (isNaN(val)) return;
  if (team === 'boys') wpGame.boysPoints = val;
  else                 wpGame.girlsPoints = val;
  saveWPGame();
}

function addWPPoints(team, amount) {
  const val = parseInt(amount, 10);
  if (isNaN(val)) return;
  if (team === 'boys') wpGame.boysPoints += val;
  else                 wpGame.girlsPoints += val;
  playWPPointsSound();
  saveWPGame();
}

// ── Cell Painting ─────────────────────────────────────────
// Each click: paint with current team colour + assign next letter of current word
function paintWPCell(row, col) {
  const key  = `${row},${col}`;
  const team = wpGame.currentTurn;
  const word = (wpGame.currentWord || '').toUpperCase();
  let letter = null;

  if (word.length > 0 && wpGame.currentWordIndex < word.length) {
    letter = word[wpGame.currentWordIndex];
    wpGame.currentWordIndex++;
  }

  if (!wpGame.cells[key]) {
    wpGame.cells[key] = { color: null, letter: null, displayLetter: null };
  }

  wpGame.cells[key].color = team;                        // always repaint
  if (letter !== null) {
    wpGame.cells[key].letter = letter;                   // assign letter only when word has chars left
  }

  playWPPaintSound(team);
  saveWPGame();
}

// ── Word ──────────────────────────────────────────────────
function setWPCurrentWord(word) {
  wpGame.currentWord      = word;
  wpGame.currentWordIndex = 0;       // reset pointer whenever word changes
  saveWPGame();
}

function resetWPWordIndex() {
  wpGame.currentWordIndex = 0;
  saveWPGame();
}

// ── Image Upload (reuses existing /upload/:tileId endpoint) ───
async function saveWPTeamImage(team, file) {
  const formData = new FormData();
  formData.append('image', file);
  const tileId = `wordpuzzle-team-${team}`;
  try {
    const response = await fetch(`/upload/${tileId}`, { method: 'POST', body: formData });
    const data     = await response.json();
    if (data.status === 'ok') {
      if (team === 'boys')  wpGame.boysImage  = data.url;
      if (team === 'girls') wpGame.girlsImage = data.url;
      saveWPGame();
      return data.url;
    }
  } catch (err) {
    console.error('Upload failed:', err);
  }
}

// ── Winner ────────────────────────────────────────────────
function announceWPWinner(team, className, sectionName) {
  wpGame.winner      = team;
  wpGame.classInfo   = className;
  wpGame.sectionInfo = sectionName;
  saveWPGame();
}

function clearWPWinner() {
  wpGame.winner = null;
  saveWPGame();
}

// ── Reset ─────────────────────────────────────────────────
async function resetWPGame() {
  localStorage.removeItem(WP_STORAGE_KEY);
  wpGame = {
    boysPoints       : 0,
    girlsPoints      : 0,
    currentTurn      : 'boys',
    gridRows         : 10,
    gridCols         : 10,
    cells            : {},
    boysImage        : null,
    girlsImage       : null,
    currentWord      : '',
    currentWordIndex : 0,
    winner           : null,
    classInfo        : '',
    sectionInfo      : '',
    lastUpdate       : Date.now(),
  };
  try { await fetch('/clear-uploads?game=wordpuzzle', { method: 'POST' }); } catch (e) {}
  saveWPGame();
}

// ── Session Management ────────────────────────────────────
function buildWPSessionSnapshot() {
  return {
    boysPoints       : wpGame.boysPoints,
    girlsPoints      : wpGame.girlsPoints,
    currentTurn      : wpGame.currentTurn,
    gridRows         : wpGame.gridRows,
    gridCols         : wpGame.gridCols,
    cells            : JSON.parse(JSON.stringify(wpGame.cells)),
    boysImage        : wpGame.boysImage,
    girlsImage       : wpGame.girlsImage,
    currentWord      : wpGame.currentWord,
    currentWordIndex : wpGame.currentWordIndex,
    winner           : wpGame.winner,
    classInfo        : wpGame.classInfo,
    sectionInfo      : wpGame.sectionInfo,
    savedAt          : new Date().toISOString(),
  };
}

function getWPSessions() {
  try {
    const d = localStorage.getItem(WP_SESSIONS_KEY);
    return d ? JSON.parse(d) : {};
  } catch (e) { return {}; }
}

function saveWPSession(sessionName) {
  if (!sessionName || !sessionName.trim()) return false;
  sessionName = sessionName.trim();
  const sessions = getWPSessions();
  sessions[sessionName] = buildWPSessionSnapshot();
  localStorage.setItem(WP_SESSIONS_KEY, JSON.stringify(sessions));
  wpCurrentSessionName = sessionName;
  localStorage.setItem(WP_CURRENT_SESSION_KEY, sessionName);
  return true;
}

/**
 * Load a saved session.
 * Key behaviour: when loading, all saved cell letters become displayLetters
 * (visible on the game page). Any NEW letter assignments after loading will
 * update `letter` but NOT `displayLetter` — so today's work stays hidden
 * on the projector until tomorrow's session load.
 */
function loadWPSession(sessionName) {
  const sessions = getWPSessions();
  const session  = sessions[sessionName];
  if (!session) return false;

  wpGame.boysPoints       = session.boysPoints       ?? 0;
  wpGame.girlsPoints      = session.girlsPoints      ?? 0;
  wpGame.currentTurn      = session.currentTurn      || 'boys';
  wpGame.gridRows         = session.gridRows         || 10;
  wpGame.gridCols         = session.gridCols         || 10;
  wpGame.boysImage        = session.boysImage        || null;
  wpGame.girlsImage       = session.girlsImage       || null;
  wpGame.currentWord      = session.currentWord      || '';
  wpGame.currentWordIndex = session.currentWordIndex || 0;
  wpGame.winner           = session.winner           || null;
  wpGame.classInfo        = session.classInfo        || '';
  wpGame.sectionInfo      = session.sectionInfo      || '';
  wpGame.lastUpdate       = Date.now();
  wpCurrentSessionName    = sessionName;
  localStorage.setItem(WP_CURRENT_SESSION_KEY, sessionName);

  // Cells: promote `letter` → `displayLetter` so they appear on game page
  const loadedCells = session.cells || {};
  const newCells    = {};
  for (const [key, cell] of Object.entries(loadedCells)) {
    newCells[key] = {
      color         : cell.color         || null,
      letter        : cell.letter        || null,
      displayLetter : cell.letter        || null,  // visible on game page
    };
  }
  wpGame.cells = newCells;

  saveWPGame();
  return true;
}

function deleteWPSession(sessionName) {
  const sessions = getWPSessions();
  delete sessions[sessionName];
  localStorage.setItem(WP_SESSIONS_KEY, JSON.stringify(sessions));
  if (wpCurrentSessionName === sessionName) {
    wpCurrentSessionName = null;
    localStorage.removeItem(WP_CURRENT_SESSION_KEY);
  }
}

function getWPCurrentSessionName() {
  if (!wpCurrentSessionName) {
    wpCurrentSessionName = localStorage.getItem(WP_CURRENT_SESSION_KEY) || null;
  }
  return wpCurrentSessionName;
}

// ── Global Export ─────────────────────────────────────────
window.WordPuzzle = {
  get game() { return wpGame; },
  saveWPGame,
  loadWPGame,
  setWPGame,
  setWPGridSize,
  setWPTurn,
  switchWPTurn,
  setWPPoints,
  addWPPoints,
  paintWPCell,
  setWPCurrentWord,
  resetWPWordIndex,
  saveWPTeamImage,
  announceWPWinner,
  clearWPWinner,
  resetWPGame,
  getWPSessions,
  saveWPSession,
  loadWPSession,
  deleteWPSession,
  getWPCurrentSessionName,
  setSocket(s) { wpSocket = s; },
};

loadWPGame();

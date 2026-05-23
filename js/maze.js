// ============================================================
// MAZE RUNNER QUIZ — Game State Engine
// Mirrors the pattern of monopoly.js
// ============================================================

const MAZE_STORAGE_KEY = "maze-game-v1";
const MAZE_SESSIONS_KEY = "maze-sessions-v1";
const MAZE_CURRENT_SESSION_KEY = "maze-current-session";
let mazeCurrentSessionName = null;

// ── Default state ─────────────────────────────────────────
let mazeGame = {
  boysCredit: 0,
  girlsCredit: 0,
  currentTurn: "boys",
  boysMaze: null, // { size, cells[], runnerPos:{x,y}, visited:Set, solutionPath:[] }
  girlsMaze: null,
  boysImage: null,
  girlsImage: null,
  winner: null,
  classInfo: "",
  sectionInfo: "",
  lastUpdate: Date.now(),
};

// ── Audio (Web Audio API) ────────────────────────────────
const MazeAudioCtx = window.AudioContext || window.webkitAudioContext;
let mazeAudioCtx = null;
function getMazeAudioCtx() {
  if (!mazeAudioCtx) mazeAudioCtx = new MazeAudioCtx();
  return mazeAudioCtx;
}

function playMazeStepSound(team) {
  try {
    const ctx = getMazeAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const base = team === "boys" ? 380 : 520;
    osc.type = "sine";
    osc.frequency.setValueAtTime(base, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      base * 1.3,
      ctx.currentTime + 0.08,
    );
    osc.frequency.exponentialRampToValueAtTime(
      base * 0.7,
      ctx.currentTime + 0.16,
    );
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.18);
  } catch (e) {}
}

function playMazeQuizCorrectSound() {
  try {
    const ctx = getMazeAudioCtx();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(
        0.01,
        ctx.currentTime + i * 0.1 + 0.15,
      );
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.15);
    });
  } catch (e) {}
}

// ── Maze Generation (Recursive Backtracker) ───────────────
/**
 * Generates a maze using recursive depth-first backtracker.
 * Returns { size, cells, runnerPos, visited, solutionPath }
 * cells[y][x] = { walls: {N,S,E,W} }
 */
function generateMazeData(size) {
  // Initialize grid — all walls closed
  const cells = [];
  for (let y = 0; y < size; y++) {
    cells[y] = [];
    for (let x = 0; x < size; x++) {
      cells[y][x] = {
        walls: { N: true, S: true, E: true, W: true },
        visited: false,
      };
    }
  }

  // Recursive backtracker
  function carve(x, y) {
    cells[y][x].visited = true;
    const dirs = shuffle([
      { dx: 0, dy: -1, wall: "N", opp: "S" },
      { dx: 0, dy: 1, wall: "S", opp: "N" },
      { dx: 1, dy: 0, wall: "E", opp: "W" },
      { dx: -1, dy: 0, wall: "W", opp: "E" },
    ]);
    for (const d of dirs) {
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (
        nx >= 0 &&
        ny >= 0 &&
        nx < size &&
        ny < size &&
        !cells[ny][nx].visited
      ) {
        cells[y][x].walls[d.wall] = false;
        cells[ny][nx].walls[d.opp] = false;
        carve(nx, ny);
      }
    }
  }

  carve(0, 0);

  // Reset visited flags (will be used for runner tracking)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) cells[y][x].visited = false;

  // Solve maze from (0,0) to (size-1, size-1) using BFS to find solution path
  const solutionPath = solveMazeBFS(
    cells,
    size,
    { x: 0, y: 0 },
    { x: size - 1, y: size - 1 },
  );

  return {
    size,
    cells,
    runnerPos: { x: 0, y: 0 },
    visitedSet: [], // serialisable array of "x,y" strings
    solutionPath, // array of {x,y} from start to end
  };
}

function solveMazeBFS(cells, size, start, end) {
  const queue = [{ ...start, path: [{ x: start.x, y: start.y }] }];
  const seen = new Set([`${start.x},${start.y}`]);
  const dirMap = [
    { dx: 0, dy: -1, wall: "N" },
    { dx: 0, dy: 1, wall: "S" },
    { dx: 1, dy: 0, wall: "E" },
    { dx: -1, dy: 0, wall: "W" },
  ];
  while (queue.length) {
    const cur = queue.shift();
    if (cur.x === end.x && cur.y === end.y) return cur.path;
    for (const d of dirMap) {
      const nx = cur.x + d.dx;
      const ny = cur.y + d.dy;
      const key = `${nx},${ny}`;
      if (
        nx >= 0 &&
        ny >= 0 &&
        nx < size &&
        ny < size &&
        !seen.has(key) &&
        !cells[cur.y][cur.x].walls[d.wall]
      ) {
        seen.add(key);
        queue.push({ x: nx, y: ny, path: [...cur.path, { x: nx, y: ny }] });
      }
    }
  }
  return [];
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Move Runner ───────────────────────────────────────────
function moveRunner(team, direction) {
  const mz = team === "boys" ? mazeGame.boysMaze : mazeGame.girlsMaze;
  if (!mz) return false;

  const credit = team === "boys" ? mazeGame.boysCredit : mazeGame.girlsCredit;
  if (credit < 100) return false; // not enough credit

  const { x, y } = mz.runnerPos;
  const cell = mz.cells[y][x];

  // Check wall
  const wallMap = { up: "N", down: "S", right: "E", left: "W" };
  const wallDir = wallMap[direction];
  if (!wallDir || cell.walls[wallDir]) return false; // wall blocks

  // Move
  const deltas = {
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
    right: { dx: 1, dy: 0 },
    left: { dx: -1, dy: 0 },
  };
  const d = deltas[direction];
  const nx = x + d.dx;
  const ny = y + d.dy;

  mz.runnerPos = { x: nx, y: ny };

  // Track visited (for progress)
  const key = `${nx},${ny}`;
  if (!mz.visitedSet.includes(key)) mz.visitedSet.push(key);

  // Deduct credit
  if (team === "boys") mazeGame.boysCredit -= 100;
  else mazeGame.girlsCredit -= 100;

  playMazeStepSound(team);
  saveMazeGame();
  return true;
}

// ── Progress: % of solution path cells visited ────────────
function getMazeProgress(team) {
  const mz = team === "boys" ? mazeGame.boysMaze : mazeGame.girlsMaze;
  if (!mz || !mz.solutionPath || mz.solutionPath.length === 0) return 0;
  const visited = new Set(mz.visitedSet);
  let count = 0;
  for (const cell of mz.solutionPath) {
    if (visited.has(`${cell.x},${cell.y}`)) count++;
  }
  return Math.round((count / mz.solutionPath.length) * 100);
}

// ── Score / Credit ────────────────────────────────────────
function updateMazeScore(team, amount) {
  if (team === "boys") mazeGame.boysCredit += amount;
  else if (team === "girls") mazeGame.girlsCredit += amount;
  saveMazeGame();
}

// ── Turn ──────────────────────────────────────────────────
function switchMazeTurn() {
  mazeGame.currentTurn = mazeGame.currentTurn === "boys" ? "girls" : "boys";
  saveMazeGame();
}

function setMazeTurn(turn) {
  mazeGame.currentTurn = turn;
  saveMazeGame();
}

// ── Winner ────────────────────────────────────────────────
function announceMazeWinner(team, className, sectionName) {
  mazeGame.winner = team;
  mazeGame.classInfo = className;
  mazeGame.sectionInfo = sectionName;
  saveMazeGame();
}

function clearMazeWinner() {
  mazeGame.winner = null;
  saveMazeGame();
}

// ── Image Upload ──────────────────────────────────────────
async function saveMazeTeamImage(team, file) {
  const formData = new FormData();
  formData.append("image", file);
  const tileId = `maze-team-${team}`;
  try {
    const response = await fetch(`/upload/${tileId}`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (data.status === "ok") {
      if (team === "boys") mazeGame.boysImage = data.url;
      if (team === "girls") mazeGame.girlsImage = data.url;
      saveMazeGame();
      return data.url;
    }
  } catch (error) {
    console.error("Upload failed:", error);
  }
}

// ── Persistence ───────────────────────────────────────────
function saveMazeGame() {
  mazeGame.lastUpdate = Date.now();
  // Convert visitedSet arrays remain arrays (JSON-safe)
  localStorage.setItem(MAZE_STORAGE_KEY, JSON.stringify(mazeGame));
  if (typeof mazeSocket !== "undefined" && mazeSocket) {
    mazeSocket.emit("maze-update-game", mazeGame);
  }
  // Auto-save to current session
  const sessionName = localStorage.getItem(MAZE_CURRENT_SESSION_KEY);
  if (sessionName) {
    try {
      const sessions = JSON.parse(
        localStorage.getItem(MAZE_SESSIONS_KEY) || "{}",
      );
      sessions[sessionName] = buildSessionSnapshot();
      localStorage.setItem(MAZE_SESSIONS_KEY, JSON.stringify(sessions));
    } catch (e) {}
  }
}

function loadMazeGame() {
  const saved = localStorage.getItem(MAZE_STORAGE_KEY);
  if (saved) {
    try {
      const loaded = JSON.parse(saved);
      mazeGame = {
        boysCredit: loaded.boysCredit !== undefined ? loaded.boysCredit : 3000,
        girlsCredit:
          loaded.girlsCredit !== undefined ? loaded.girlsCredit : 3000,
        currentTurn: loaded.currentTurn || "boys",
        boysMaze: loaded.boysMaze || null,
        girlsMaze: loaded.girlsMaze || null,
        boysImage: loaded.boysImage || null,
        girlsImage: loaded.girlsImage || null,
        winner: loaded.winner || null,
        classInfo: loaded.classInfo || "",
        sectionInfo: loaded.sectionInfo || "",
        lastUpdate: loaded.lastUpdate || Date.now(),
      };
    } catch (e) {
      console.error("Maze load error:", e);
    }
  }
}

function setMazeGame(newState) {
  if (newState) {
    mazeGame = newState;
    localStorage.setItem(MAZE_STORAGE_KEY, JSON.stringify(mazeGame));
  }
}

// ── Reset ─────────────────────────────────────────────────
async function resetMazeGame() {
  localStorage.removeItem(MAZE_STORAGE_KEY);
  mazeGame = {
    boysCredit: 0,
    girlsCredit: 0,
    currentTurn: "boys",
    boysMaze: null,
    girlsMaze: null,
    boysImage: null,
    girlsImage: null,
    winner: null,
    classInfo: "",
    sectionInfo: "",
    lastUpdate: Date.now(),
  };
  try {
    await fetch("/clear-uploads?game=maze", { method: "POST" });
  } catch (e) {}
  saveMazeGame();
}

// ── Session Management ────────────────────────────────────
function buildSessionSnapshot() {
  return {
    boysCredit: mazeGame.boysCredit,
    girlsCredit: mazeGame.girlsCredit,
    currentTurn: mazeGame.currentTurn,
    boysMaze: mazeGame.boysMaze,
    girlsMaze: mazeGame.girlsMaze,
    boysImage: mazeGame.boysImage,
    girlsImage: mazeGame.girlsImage,
    winner: mazeGame.winner,
    classInfo: mazeGame.classInfo,
    sectionInfo: mazeGame.sectionInfo,
    savedAt: new Date().toISOString(),
  };
}

function getMazeSessions() {
  try {
    const data = localStorage.getItem(MAZE_SESSIONS_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    return {};
  }
}

function saveMazeSession(sessionName) {
  if (!sessionName || !sessionName.trim()) return false;
  sessionName = sessionName.trim();
  const sessions = getMazeSessions();
  sessions[sessionName] = buildSessionSnapshot();
  localStorage.setItem(MAZE_SESSIONS_KEY, JSON.stringify(sessions));
  mazeCurrentSessionName = sessionName;
  localStorage.setItem(MAZE_CURRENT_SESSION_KEY, sessionName);
  return true;
}

function loadMazeSession(sessionName) {
  const sessions = getMazeSessions();
  const session = sessions[sessionName];
  if (!session) return false;
  mazeGame.boysCredit =
    session.boysCredit !== undefined ? session.boysCredit : 0;
  mazeGame.girlsCredit =
    session.girlsCredit !== undefined ? session.girlsCredit : 0;
  mazeGame.currentTurn = session.currentTurn || "boys";
  mazeGame.boysMaze = session.boysMaze || null;
  mazeGame.girlsMaze = session.girlsMaze || null;
  mazeGame.boysImage = session.boysImage || null;
  mazeGame.girlsImage = session.girlsImage || null;
  mazeGame.winner = session.winner || null;
  mazeGame.classInfo = session.classInfo || "";
  mazeGame.sectionInfo = session.sectionInfo || "";
  mazeGame.lastUpdate = Date.now();
  mazeCurrentSessionName = sessionName;
  localStorage.setItem(MAZE_CURRENT_SESSION_KEY, sessionName);
  saveMazeGame();
  return true;
}

function deleteMazeSession(sessionName) {
  const sessions = getMazeSessions();
  delete sessions[sessionName];
  localStorage.setItem(MAZE_SESSIONS_KEY, JSON.stringify(sessions));
  if (mazeCurrentSessionName === sessionName) {
    mazeCurrentSessionName = null;
    localStorage.removeItem(MAZE_CURRENT_SESSION_KEY);
  }
}

function getMazeCurrentSessionName() {
  if (!mazeCurrentSessionName) {
    mazeCurrentSessionName =
      localStorage.getItem(MAZE_CURRENT_SESSION_KEY) || null;
  }
  return mazeCurrentSessionName;
}

// ── Generate Maze for team ────────────────────────────────
function generateTeamMaze(team, size) {
  const data = generateMazeData(size);
  if (team === "boys") mazeGame.boysMaze = data;
  else mazeGame.girlsMaze = data;
  saveMazeGame();
  return data;
}

// ── Socket reference (set by page) ───────────────────────
let mazeSocket = null;

// ── Global Export ─────────────────────────────────────────
window.MazeGame = {
  get game() {
    return mazeGame;
  },
  generateTeamMaze,
  moveRunner,
  getMazeProgress,
  updateMazeScore,
  switchMazeTurn,
  setMazeTurn,
  announceMazeWinner,
  clearMazeWinner,
  saveMazeTeamImage,
  saveMazeGame,
  loadMazeGame,
  setMazeGame,
  resetMazeGame,
  getMazeSessions,
  saveMazeSession,
  loadMazeSession,
  deleteMazeSession,
  getMazeCurrentSessionName,
  setSocket(s) {
    mazeSocket = s;
  },
  MAZE_STORAGE_KEY,
};

loadMazeGame();

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

// ── Maze Generation (Dilemma-Rich Growing Tree + Braided Loops) ──
/**
 * Generates a dilemma-rich maze.
 * Features:
 *  1. Growing-tree exploration with fork injection for multi-way decision points (T-junctions & 4-way forks).
 *  2. Long deceptive branches / deep decoys that mimic the true path and branch themselves.
 *  3. Controlled loop braiding (~22% of dead-ends opened into adjacent corridors) to eliminate
 *     simple dead-end visual pruning, creating genuine circular dilemmas & alternate routes.
 * Returns { size, cells, runnerPos, visitedSet, solutionPath }
 */
function generateMazeData(size, windingRatio = 0.82, braidRatio = 0.22) {
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

  const dirMap = [
    { dx: 0, dy: -1, wall: "N", opp: "S" },
    { dx: 0, dy: 1, wall: "S", opp: "N" },
    { dx: 1, dy: 0, wall: "E", opp: "W" },
    { dx: -1, dy: 0, wall: "W", opp: "E" },
  ];

  const activeList = [{ x: 0, y: 0 }];
  cells[0][0].visited = true;

  while (activeList.length > 0) {
    // Mixed selection: predominantly newest (deep winding tunnels) combined with random (parallel branching)
    const idx =
      Math.random() < windingRatio
        ? activeList.length - 1
        : Math.floor(Math.random() * activeList.length);
    const { x, y } = activeList[idx];

    const unvisitedNeighbors = [];
    for (const d of dirMap) {
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (
        nx >= 0 &&
        ny >= 0 &&
        nx < size &&
        ny < size &&
        !cells[ny][nx].visited
      ) {
        unvisitedNeighbors.push({ nx, ny, d });
      }
    }

    if (unvisitedNeighbors.length > 0) {
      shuffle(unvisitedNeighbors);
      const chosen = unvisitedNeighbors[0];
      cells[y][x].walls[chosen.d.wall] = false;
      cells[chosen.ny][chosen.nx].walls[chosen.d.opp] = false;
      cells[chosen.ny][chosen.nx].visited = true;
      activeList.push({ x: chosen.nx, y: chosen.ny });

      // Fork Injection: If there is another unvisited neighbor, carve a secondary fork with ~28% probability.
      // This produces 3-way/4-way junctions directly on corridors, sending students down competing deep pathways!
      if (unvisitedNeighbors.length > 1 && Math.random() < 0.28) {
        const branch = unvisitedNeighbors[1];
        cells[y][x].walls[branch.d.wall] = false;
        cells[branch.ny][branch.nx].walls[branch.d.opp] = false;
        cells[branch.ny][branch.nx].visited = true;
        activeList.push({ x: branch.nx, y: branch.ny });
      }
    } else {
      activeList.splice(idx, 1);
    }
  }

  // Controlled Braiding (Cycles & Loop Injection):
  // Collect dead ends (cells with 3 walls closed)
  const deadEnds = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if ((x === 0 && y === 0) || (x === size - 1 && y === size - 1)) continue;
      let wallCount = 0;
      for (const d of ["N", "S", "E", "W"]) {
        if (cells[y][x].walls[d]) wallCount++;
      }
      if (wallCount === 3) deadEnds.push({ x, y });
    }
  }

  shuffle(deadEnds);
  const braidCount = Math.floor(deadEnds.length * braidRatio);
  for (let i = 0; i < braidCount; i++) {
    const { x, y } = deadEnds[i];
    const closedDirs = [];
    for (const d of dirMap) {
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (
        nx >= 0 &&
        ny >= 0 &&
        nx < size &&
        ny < size &&
        cells[y][x].walls[d.wall]
      ) {
        closedDirs.push({ nx, ny, d });
      }
    }
    if (closedDirs.length > 0) {
      const pick = closedDirs[Math.floor(Math.random() * closedDirs.length)];
      cells[y][x].walls[pick.d.wall] = false;
      cells[pick.ny][pick.nx].walls[pick.d.opp] = false;
    }
  }

  // Reset visited flags
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      cells[y][x].visited = false;
    }
  }

  // Solve maze from (0,0) to (size-1, size-1) using BFS
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
    visitedSet: ["0,0"],
    solutionPath,
  };
}

function solveMazeBFS(cells, size, start, end) {
  const startIdx = start.y * size + start.x;
  const endIdx = end.y * size + end.x;
  const queue = [startIdx];
  let head = 0;
  const parent = new Int32Array(size * size).fill(-1);
  const seen = new Uint8Array(size * size);
  seen[startIdx] = 1;
  const dirMap = [
    { dx: 0, dy: -1, wall: "N" },
    { dx: 0, dy: 1, wall: "S" },
    { dx: 1, dy: 0, wall: "E" },
    { dx: -1, dy: 0, wall: "W" },
  ];

  let reached = false;
  while (head < queue.length) {
    const curIdx = queue[head++];
    if (curIdx === endIdx) {
      reached = true;
      break;
    }
    const cx = curIdx % size;
    const cy = Math.floor(curIdx / size);
    const cell = cells[cy][cx];

    for (let i = 0; i < 4; i++) {
      const d = dirMap[i];
      if (cell.walls[d.wall]) continue;
      const nx = cx + d.dx;
      const ny = cy + d.dy;
      if (nx >= 0 && ny >= 0 && nx < size && ny < size) {
        const nIdx = ny * size + nx;
        if (!seen[nIdx]) {
          seen[nIdx] = 1;
          parent[nIdx] = curIdx;
          queue.push(nIdx);
        }
      }
    }
  }

  if (!reached) return [];
  const path = [];
  let curr = endIdx;
  while (curr !== -1) {
    path.push({ x: curr % size, y: Math.floor(curr / size) });
    if (curr === startIdx) break;
    curr = parent[curr];
  }
  path.reverse();
  return path;
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

  // Check if reached finish line!
  if (nx === mz.size - 1 && ny === mz.size - 1) {
    if (!mazeGame.winner) {
      announceMazeWinner(
        team,
        mazeGame.classInfo || "",
        mazeGame.sectionInfo || "",
      );
    }
  }

  saveMazeGame();
  return true;
}

// ── Helper: BFS distance map from Goal (size-1, size-1) to all cells ──
function computeDistToGoal(cells, size) {
  const dist = new Int32Array(size * size).fill(-1);
  const goalIdx = (size - 1) * size + (size - 1);
  dist[goalIdx] = 0;
  const queue = [goalIdx];
  let head = 0;
  const dirMap = [
    { dx: 0, dy: -1, wall: "N" },
    { dx: 0, dy: 1, wall: "S" },
    { dx: 1, dy: 0, wall: "E" },
    { dx: -1, dy: 0, wall: "W" },
  ];
  while (head < queue.length) {
    const curIdx = queue[head++];
    const cx = curIdx % size;
    const cy = Math.floor(curIdx / size);
    const d = dist[curIdx];
    const cell = cells[cy][cx];
    for (let i = 0; i < 4; i++) {
      const dm = dirMap[i];
      if (cell.walls[dm.wall]) continue;
      const nx = cx + dm.dx;
      const ny = cy + dm.dy;
      if (nx >= 0 && ny >= 0 && nx < size && ny < size) {
        const nIdx = ny * size + nx;
        if (dist[nIdx] === -1) {
          dist[nIdx] = d + 1;
          queue.push(nIdx);
        }
      }
    }
  }
  return dist;
}

// ── Progress: Goal-distance completion (accurate across all paths) ────────────
function getMazeProgress(team) {
  const mz = team === "boys" ? mazeGame.boysMaze : mazeGame.girlsMaze;
  if (!mz || !mz.cells || !mz.size) return 0;

  // 1. If winner declared or runner is on finish line -> 100%
  if (
    mazeGame.winner === team ||
    (mz.runnerPos &&
      mz.runnerPos.x === mz.size - 1 &&
      mz.runnerPos.y === mz.size - 1)
  ) {
    return 100;
  }

  // 2. Retrieve or compute distance map from goal
  if (!mz._distToGoal || mz._distToGoal.length !== mz.size * mz.size) {
    mz._distToGoal = computeDistToGoal(mz.cells, mz.size);
  }
  const distMap = mz._distToGoal;
  const startDist = distMap[0]; // Shortest distance from (0,0) to goal
  if (startDist <= 0) return 100;

  // 3. Find closest distance to goal reached so far (current pos + visited set)
  let bestDist = distMap[mz.runnerPos.y * mz.size + mz.runnerPos.x];
  if (bestDist === -1) bestDist = startDist;

  if (Array.isArray(mz.visitedSet)) {
    for (let i = 0; i < mz.visitedSet.length; i++) {
      const parts = mz.visitedSet[i].split(",");
      const vx = Number(parts[0]);
      const vy = Number(parts[1]);
      if (vx >= 0 && vx < mz.size && vy >= 0 && vy < mz.size) {
        const d = distMap[vy * mz.size + vx];
        if (d !== -1 && d < bestDist) {
          bestDist = d;
        }
      }
    }
  }

  if (bestDist <= 0) return 100;

  // 4. Calculate progress percentage (capped at 99% until finish line is touched)
  const progress = Math.round(((startDist - bestDist) / startDist) * 100);
  return Math.max(0, Math.min(99, progress));
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

// ── Balanced Mazes Generator ───────────────────────────────
/**
 * Generates two distinct dilemma mazes with GUARANTEED identical shortest solution path lengths.
 * Uses bucket matching on random candidates (typically completes in 5-25ms).
 */
function generateBalancedMazes(size) {
  const buckets = new Map();
  let attempts = 0;
  while (attempts < 1200) {
    attempts++;
    const wRatio = Math.min(
      0.92,
      Math.max(0.7, 0.82 + (Math.random() - 0.5) * 0.16),
    );
    const bRatio = Math.min(
      0.35,
      Math.max(0.12, 0.22 + (Math.random() - 0.5) * 0.14),
    );
    const maze = generateMazeData(size, wRatio, bRatio);
    const steps = maze.solutionPath.length - 1;

    if (buckets.has(steps)) {
      const mazeA = buckets.get(steps);
      mazeA.runnerPos = { x: 0, y: 0 };
      mazeA.visitedSet = ["0,0"];
      maze.runnerPos = { x: 0, y: 0 };
      maze.visitedSet = ["0,0"];
      return {
        boysMaze: mazeA,
        girlsMaze: maze,
        shortestSteps: steps,
        size,
        attempts,
      };
    } else {
      buckets.set(steps, maze);
    }
  }

  // Safe fallback
  const m1 = generateMazeData(size);
  const m2 = generateMazeData(size);
  return {
    boysMaze: m1,
    girlsMaze: m2,
    shortestSteps: m1.solutionPath.length - 1,
    size,
    attempts,
  };
}

/**
 * Generates both Blue and Red mazes simultaneously with guaranteed equal step length.
 */
function generateBothTeamMazes(size) {
  const pair = generateBalancedMazes(size);
  mazeGame.boysMaze = pair.boysMaze;
  mazeGame.girlsMaze = pair.girlsMaze;
  saveMazeGame();
  return pair;
}

// ── Generate Maze for team ────────────────────────────────
function generateTeamMaze(team, size, targetSteps) {
  const otherTeam = team === "boys" ? "girls" : "boys";
  const otherMaze = team === "boys" ? mazeGame.girlsMaze : mazeGame.boysMaze;

  let target = targetSteps;
  if (
    !target &&
    otherMaze &&
    otherMaze.size === size &&
    otherMaze.solutionPath &&
    otherMaze.solutionPath.length > 0
  ) {
    target = otherMaze.solutionPath.length - 1;
  }

  if (target && target > 0) {
    // Attempt exact match against other team's shortest steps
    for (let i = 0; i < 400; i++) {
      const wRatio = Math.min(
        0.92,
        Math.max(0.7, 0.82 + (Math.random() - 0.5) * 0.16),
      );
      const bRatio = Math.min(
        0.35,
        Math.max(0.12, 0.22 + (Math.random() - 0.5) * 0.14),
      );
      const candidate = generateMazeData(size, wRatio, bRatio);
      if (candidate.solutionPath.length - 1 === target) {
        if (team === "boys") mazeGame.boysMaze = candidate;
        else mazeGame.girlsMaze = candidate;
        saveMazeGame();
        return candidate;
      }
    }
    // Target couldn't be matched (e.g. outlier): rebalance both teams to guarantee fairness!
    const balanced = generateBalancedMazes(size);
    mazeGame.boysMaze = balanced.boysMaze;
    mazeGame.girlsMaze = balanced.girlsMaze;
    saveMazeGame();
    return team === "boys" ? balanced.boysMaze : balanced.girlsMaze;
  }

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
  generateBothTeamMazes,
  generateBalancedMazes,
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

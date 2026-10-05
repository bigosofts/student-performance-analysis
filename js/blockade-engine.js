/**
 * Blockade 3D — Pure Rules / State Engine
 * ────────────────────────────────────────
 * Shared between client and server.
 * No rendering, no Socket.IO — just game logic.
 */

(function (exports) {
  "use strict";

  // ─── Constants ──────────────────────────────────────────────
  const BOARD_SIZE = 9;
  const CREDITS_PER_CORRECT = 2;
  const MOVE_COST = 1;
  const WALL_COST = 1;

  const PLAYER_COLORS = {
    1: { name: "Red", hex: "#ef4444" },
    2: { name: "Blue", hex: "#3b82f6" },
    3: { name: "Green", hex: "#22c55e" },
    4: { name: "Purple", hex: "#a855f7" },
  };

  const TWO_PLAYER_WALLS = 15;
  const FOUR_PLAYER_WALLS = 10;

  // ─── Initial Positions & Goals ──────────────────────────────
  function getInitialPositions(mode) {
    if (mode === "two-player") {
      return {
        1: { row: 8, col: 4 },
        2: { row: 0, col: 4 },
      };
    }
    return {
      1: { row: 8, col: 4 }, // Red
      2: { row: 0, col: 4 }, // Blue
      3: { row: 4, col: 0 }, // Green
      4: { row: 4, col: 8 }, // Purple
    };
  }

  function getGoalCells(playerId, mode) {
    if (mode === "two-player") {
      if (playerId === 1) {
        // Goal: any cell in row 0
        const goals = [];
        for (let c = 0; c < BOARD_SIZE; c++) goals.push({ row: 0, col: c });
        return goals;
      } else {
        // Goal: any cell in row 8
        const goals = [];
        for (let c = 0; c < BOARD_SIZE; c++) goals.push({ row: 8, col: c });
        return goals;
      }
    }
    // Four-player: center cell (4,4)
    return [{ row: 4, col: 4 }];
  }

  function isGoalCell(row, col, playerId, mode) {
    const goals = getGoalCells(playerId, mode);
    return goals.some((g) => g.row === row && g.col === col);
  }

  // ─── Wall Geometry ──────────────────────────────────────────
  // A wall is { row, col, orientation }
  //   orientation: "horizontal" | "vertical"
  //   A horizontal wall sits between row and row+1, spanning col and col+1
  //   A vertical wall sits between col and col+1, spanning row and row+1
  //   Anchor constraints:
  //     horizontal: 0 <= row <= 7, 0 <= col <= 7
  //     vertical:   0 <= row <= 7, 0 <= col <= 7

  function wallInBounds(wall) {
    return (
      wall.row >= 0 &&
      wall.row <= BOARD_SIZE - 2 &&
      wall.col >= 0 &&
      wall.col <= BOARD_SIZE - 2 &&
      (wall.orientation === "horizontal" || wall.orientation === "vertical")
    );
  }

  /**
   * Returns the set of cell-edge pairs that a wall blocks.
   * Each element is [[r1,c1],[r2,c2]] — movement between those two cells is blocked.
   */
  function wallBlockedEdges(wall) {
    const edges = [];
    if (wall.orientation === "horizontal") {
      // Blocks movement between (row, col)↔(row+1, col) and (row, col+1)↔(row+1, col+1)
      edges.push([
        [wall.row, wall.col],
        [wall.row + 1, wall.col],
      ]);
      edges.push([
        [wall.row, wall.col + 1],
        [wall.row + 1, wall.col + 1],
      ]);
    } else {
      // vertical
      // Blocks movement between (row, col)↔(row, col+1) and (row+1, col)↔(row+1, col+1)
      edges.push([
        [wall.row, wall.col],
        [wall.row, wall.col + 1],
      ]);
      edges.push([
        [wall.row + 1, wall.col],
        [wall.row + 1, wall.col + 1],
      ]);
    }
    return edges;
  }

  function wallsOverlap(a, b) {
    if (a.orientation === b.orientation) {
      if (a.orientation === "horizontal") {
        // Same row, overlapping columns
        return a.row === b.row && Math.abs(a.col - b.col) < 2;
      } else {
        // Same col, overlapping rows
        return a.col === b.col && Math.abs(a.row - b.row) < 2;
      }
    }
    // Different orientations — check cross intersection
    // A horizontal wall at (hr, hc) and vertical wall at (vr, vc) intersect
    // if they share the same center point
    const ha = a.orientation === "horizontal" ? a : b;
    const va = a.orientation === "horizontal" ? b : a;
    return ha.row === va.row && ha.col === va.col;
  }

  // ─── canMoveBetween ─────────────────────────────────────────
  /**
   * Check if movement between two orthogonally adjacent cells is allowed.
   * walls: array of wall objects on the board.
   */
  function canMoveBetween(cellA, cellB, walls) {
    // Must be orthogonally adjacent
    const dr = cellB.row - cellA.row;
    const dc = cellB.col - cellA.col;
    if (Math.abs(dr) + Math.abs(dc) !== 1) return false;

    // Check bounds
    if (
      cellA.row < 0 ||
      cellA.row >= BOARD_SIZE ||
      cellA.col < 0 ||
      cellA.col >= BOARD_SIZE ||
      cellB.row < 0 ||
      cellB.row >= BOARD_SIZE ||
      cellB.col < 0 ||
      cellB.col >= BOARD_SIZE
    )
      return false;

    // Check if any wall blocks this edge
    for (const w of walls) {
      const edges = wallBlockedEdges(w);
      for (const [[r1, c1], [r2, c2]] of edges) {
        if (
          (cellA.row === r1 &&
            cellA.col === c1 &&
            cellB.row === r2 &&
            cellB.col === c2) ||
          (cellA.row === r2 &&
            cellA.col === c2 &&
            cellB.row === r1 &&
            cellB.col === c1)
        ) {
          return false;
        }
      }
    }
    return true;
  }

  // ─── BFS Pathfinding ───────────────────────────────────────
  /**
   * Returns true if at least one goal cell is reachable from start.
   */
  function hasPath(start, goalCells, walls) {
    const visited = new Set();
    const key = (r, c) => r * BOARD_SIZE + c;
    const queue = [start];
    visited.add(key(start.row, start.col));

    const goalSet = new Set(goalCells.map((g) => key(g.row, g.col)));

    while (queue.length > 0) {
      const cur = queue.shift();
      if (goalSet.has(key(cur.row, cur.col))) return true;

      const neighbors = [
        { row: cur.row - 1, col: cur.col },
        { row: cur.row + 1, col: cur.col },
        { row: cur.row, col: cur.col - 1 },
        { row: cur.row, col: cur.col + 1 },
      ];

      for (const nb of neighbors) {
        const k = key(nb.row, nb.col);
        if (!visited.has(k) && canMoveBetween(cur, nb, walls)) {
          visited.add(k);
          queue.push(nb);
        }
      }
    }
    return false;
  }

  /**
   * Returns the shortest-path distance (number of moves) from start to any goal cell, or -1 if unreachable.
   */
  function shortestPath(start, goalCells, walls) {
    const visited = new Set();
    const key = (r, c) => r * BOARD_SIZE + c;
    const queue = [{ ...start, dist: 0 }];
    visited.add(key(start.row, start.col));

    const goalSet = new Set(goalCells.map((g) => key(g.row, g.col)));

    while (queue.length > 0) {
      const cur = queue.shift();
      if (goalSet.has(key(cur.row, cur.col))) return cur.dist;

      const neighbors = [
        { row: cur.row - 1, col: cur.col },
        { row: cur.row + 1, col: cur.col },
        { row: cur.row, col: cur.col - 1 },
        { row: cur.row, col: cur.col + 1 },
      ];

      for (const nb of neighbors) {
        const k = key(nb.row, nb.col);
        if (!visited.has(k) && canMoveBetween(cur, nb, walls)) {
          visited.add(k);
          queue.push({ ...nb, dist: cur.dist + 1 });
        }
      }
    }
    return -1;
  }

  // ─── Movement with Jumping ──────────────────────────────────
  /**
   * Get legal destinations for a player.
   * Handles jumping: if two players face each other (adjacent), the active player
   * can jump over the opponent if no wall blocks either step. If a wall is behind
   * the opponent, the active player can go diagonally around them.
   */
  function getLegalMoves(playerId, state) {
    const player = state.players[playerId];
    if (!player || !player.active) return [];
    if (player.credits < MOVE_COST) return [];

    const pos = player.position;
    const walls = state.walls;
    const destinations = [];

    // Get positions of all other active players
    const occupiedCells = new Set();
    for (const [pid, p] of Object.entries(state.players)) {
      if (parseInt(pid) !== playerId && p.active) {
        occupiedCells.add(p.position.row * BOARD_SIZE + p.position.col);
      }
    }

    const directions = [
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 },
    ];

    for (const { dr, dc } of directions) {
      const adj = { row: pos.row + dr, col: pos.col + dc };

      // Out of bounds
      if (
        adj.row < 0 ||
        adj.row >= BOARD_SIZE ||
        adj.col < 0 ||
        adj.col >= BOARD_SIZE
      )
        continue;

      // Wall blocks this edge
      if (!canMoveBetween(pos, adj, walls)) continue;

      // Check if another player occupies adj
      if (occupiedCells.has(adj.row * BOARD_SIZE + adj.col)) {
        // Jump logic: try jumping straight over
        const behind = { row: adj.row + dr, col: adj.col + dc };
        if (
          behind.row >= 0 &&
          behind.row < BOARD_SIZE &&
          behind.col >= 0 &&
          behind.col < BOARD_SIZE &&
          canMoveBetween(adj, behind, walls) &&
          !occupiedCells.has(behind.row * BOARD_SIZE + behind.col)
        ) {
          destinations.push(behind);
        } else {
          // Wall behind or out of bounds — try diagonal
          const diags = [];
          if (dr !== 0) {
            // Moving vertically, try left and right
            diags.push({ row: adj.row, col: adj.col - 1 });
            diags.push({ row: adj.row, col: adj.col + 1 });
          } else {
            // Moving horizontally, try up and down
            diags.push({ row: adj.row - 1, col: adj.col });
            diags.push({ row: adj.row + 1, col: adj.col });
          }
          for (const d of diags) {
            if (
              d.row >= 0 &&
              d.row < BOARD_SIZE &&
              d.col >= 0 &&
              d.col < BOARD_SIZE &&
              canMoveBetween(adj, d, walls) &&
              !occupiedCells.has(d.row * BOARD_SIZE + d.col)
            ) {
              destinations.push(d);
            }
          }
        }
      } else {
        destinations.push(adj);
      }
    }

    return destinations;
  }

  // ─── State Factory ──────────────────────────────────────────

  function createInitialState(sessionId, code, mode) {
    const positions = getInitialPositions(mode);
    const wallStock =
      mode === "two-player" ? TWO_PLAYER_WALLS : FOUR_PLAYER_WALLS;
    const playerCount = mode === "two-player" ? 2 : 4;
    const players = {};

    for (let i = 1; i <= playerCount; i++) {
      players[i] = {
        id: i,
        name: PLAYER_COLORS[i].name,
        color: PLAYER_COLORS[i].hex,
        position: { ...positions[i] },
        goalCells: getGoalCells(i, mode),
        credits: 0,
        wallsRemaining: wallStock,
        active: true,
        finished: false,
        rank: null,
        controller: null, // socket ID or 'teacher'
        studentName: null,
      };
    }

    return {
      sessionId: sessionId,
      code: code,
      title: "Blockade 3D",
      mode: mode,
      phase: "waiting", // waiting | active | completed | cancelled
      currentPlayerId: 1,
      players: players,
      walls: [],
      currentQuestion: null,
      questionHistory: [],
      rankings: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // ─── Turn Management ───────────────────────────────────────

  function getNextActivePlayer(currentId, players, mode) {
    const count = mode === "two-player" ? 2 : 4;
    let next = currentId;
    for (let i = 0; i < count; i++) {
      next = (next % count) + 1;
      if (players[next] && players[next].active && !players[next].finished) {
        return next;
      }
    }
    return null; // No active players left
  }

  function getActivePlayers(state) {
    return Object.values(state.players).filter(
      (p) => p.active && !p.finished
    );
  }

  // ─── Action Validators ─────────────────────────────────────

  /**
   * Validate and apply a move action. Returns { valid, state, error }.
   */
  function applyMove(state, playerId, destination) {
    if (state.phase !== "active") {
      return { valid: false, error: "Game is not active" };
    }
    if (state.currentPlayerId !== playerId) {
      return { valid: false, error: "Not your turn" };
    }
    const player = state.players[playerId];
    if (!player || !player.active || player.finished) {
      return { valid: false, error: "Player is not active" };
    }
    if (player.credits < MOVE_COST) {
      return { valid: false, error: "Not enough credits to move" };
    }

    // Check legal moves
    const legal = getLegalMoves(playerId, state);
    const isLegal = legal.some(
      (m) => m.row === destination.row && m.col === destination.col
    );
    if (!isLegal) {
      return { valid: false, error: "Invalid move destination" };
    }

    // Apply
    const newState = JSON.parse(JSON.stringify(state));
    newState.players[playerId].position = {
      row: destination.row,
      col: destination.col,
    };
    newState.players[playerId].credits -= MOVE_COST;

    // Check win condition
    if (isGoalCell(destination.row, destination.col, playerId, state.mode)) {
      newState.players[playerId].finished = true;
      newState.players[playerId].active = false;
      const rank = newState.rankings.length + 1;
      newState.players[playerId].rank = rank;
      newState.rankings.push({
        playerId: playerId,
        rank: rank,
        name: newState.players[playerId].name,
      });

      // Check if game is over
      const remaining = getActivePlayers(newState);
      if (
        newState.mode === "two-player" ||
        remaining.length <= 1
      ) {
        // If remaining, give last player final rank
        if (remaining.length === 1) {
          const last = remaining[0];
          const lastRank = newState.rankings.length + 1;
          newState.players[last.id].rank = lastRank;
          newState.players[last.id].finished = true;
          newState.rankings.push({
            playerId: last.id,
            rank: lastRank,
            name: last.name,
          });
        }
        newState.phase = "completed";
        newState.currentPlayerId = null;
      } else {
        newState.currentPlayerId = getNextActivePlayer(
          playerId,
          newState.players,
          newState.mode
        );
      }
    } else {
      newState.currentPlayerId = getNextActivePlayer(
        playerId,
        newState.players,
        newState.mode
      );
    }

    newState.updatedAt = new Date().toISOString();
    return { valid: true, state: newState };
  }

  /**
   * Validate and apply a wall placement. Returns { valid, state, error }.
   */
  function applyWall(state, playerId, wall) {
    if (state.phase !== "active") {
      return { valid: false, error: "Game is not active" };
    }
    if (state.currentPlayerId !== playerId) {
      return { valid: false, error: "Not your turn" };
    }
    const player = state.players[playerId];
    if (!player || !player.active || player.finished) {
      return { valid: false, error: "Player is not active" };
    }
    if (player.credits < WALL_COST) {
      return { valid: false, error: "Not enough credits to place a wall" };
    }
    if (player.wallsRemaining <= 0) {
      return { valid: false, error: "No walls remaining" };
    }

    // Validate wall geometry
    if (!wallInBounds(wall)) {
      return { valid: false, error: "Wall is out of bounds" };
    }

    // Check overlap with existing walls
    for (const existing of state.walls) {
      if (wallsOverlap(wall, existing)) {
        return { valid: false, error: "Wall overlaps an existing wall" };
      }
    }

    // Temporarily add the wall and check paths for all active players
    const testWalls = [...state.walls, wall];
    for (const [pid, p] of Object.entries(state.players)) {
      if (p.active && !p.finished) {
        const goals = getGoalCells(parseInt(pid), state.mode);
        if (!hasPath(p.position, goals, testWalls)) {
          return {
            valid: false,
            error: "Wall would block all paths for player " + p.name,
          };
        }
      }
    }

    // Apply
    const newState = JSON.parse(JSON.stringify(state));
    newState.walls.push({
      row: wall.row,
      col: wall.col,
      orientation: wall.orientation,
      placedBy: playerId,
    });
    newState.players[playerId].credits -= WALL_COST;
    newState.players[playerId].wallsRemaining -= 1;

    newState.currentPlayerId = getNextActivePlayer(
      playerId,
      newState.players,
      newState.mode
    );
    newState.updatedAt = new Date().toISOString();
    return { valid: true, state: newState };
  }

  /**
   * Award credits for a correct answer.
   * Does NOT advance the turn.
   */
  function awardCredits(state, playerId, amount) {
    const newState = JSON.parse(JSON.stringify(state));
    if (!newState.players[playerId]) {
      return { valid: false, error: "Invalid player" };
    }
    newState.players[playerId].credits += amount;
    newState.updatedAt = new Date().toISOString();
    return { valid: true, state: newState };
  }

  // ─── Exports ────────────────────────────────────────────────
  exports.BOARD_SIZE = BOARD_SIZE;
  exports.CREDITS_PER_CORRECT = CREDITS_PER_CORRECT;
  exports.MOVE_COST = MOVE_COST;
  exports.WALL_COST = WALL_COST;
  exports.PLAYER_COLORS = PLAYER_COLORS;
  exports.TWO_PLAYER_WALLS = TWO_PLAYER_WALLS;
  exports.FOUR_PLAYER_WALLS = FOUR_PLAYER_WALLS;

  exports.getInitialPositions = getInitialPositions;
  exports.getGoalCells = getGoalCells;
  exports.isGoalCell = isGoalCell;
  exports.wallInBounds = wallInBounds;
  exports.wallBlockedEdges = wallBlockedEdges;
  exports.wallsOverlap = wallsOverlap;
  exports.canMoveBetween = canMoveBetween;
  exports.hasPath = hasPath;
  exports.shortestPath = shortestPath;
  exports.getLegalMoves = getLegalMoves;
  exports.createInitialState = createInitialState;
  exports.getNextActivePlayer = getNextActivePlayer;
  exports.getActivePlayers = getActivePlayers;
  exports.applyMove = applyMove;
  exports.applyWall = applyWall;
  exports.awardCredits = awardCredits;
})(typeof module !== "undefined" ? module.exports : (window.BlockadeEngine = {}));

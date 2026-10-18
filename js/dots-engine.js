(function (root) {
  "use strict";
  const SIZE = 10, TOTAL = 220, TARGET = Math.round(TOTAL * 0.4);
  const TEAMS = ["blue", "red", "green", "golden"];
  const TEAM_NAMES = { blue: "Blue Team", red: "Red Team", green: "Green Team", golden: "Golden Team" };
  const key = (e) => `${e.type}:${e.r}:${e.c}`;
  function edges() {
    const out = [];
    for (let r = 0; r <= SIZE; r++) for (let c = 0; c < SIZE; c++) out.push({ type: "h", r, c });
    for (let r = 0; r < SIZE; r++) for (let c = 0; c <= SIZE; c++) out.push({ type: "v", r, c });
    return out;
  }
  function boxEdges(r, c) { return [{ type: "h", r, c }, { type: "h", r: r + 1, c }, { type: "v", r, c }, { type: "v", r, c: c + 1 }]; }
  function adjacent(e) {
    if (e.type === "h") return [...(e.r > 0 ? [{ r: e.r - 1, c: e.c }] : []), ...(e.r < SIZE ? [{ r: e.r, c: e.c }] : [])];
    return [...(e.c > 0 ? [{ r: e.r, c: e.c - 1 }] : []), ...(e.c < SIZE ? [{ r: e.r, c: e.c }] : [])];
  }
  function edgeCount(box, set) { return boxEdges(box.r, box.c).filter(e => set.has(key(e))).length; }
  function generateBoard(target = TARGET, rng = Math.random) {
    const pool = edges();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const set = new Set();
    // Favor three-edge boxes, then fill remaining slots while preserving the no-capture invariant.
    for (const threshold of [2, 3]) {
      for (const e of pool) {
        if (set.size >= target) break;
        const boxes = adjacent(e);
        if (boxes.every(b => edgeCount(b, set) < threshold)) set.add(key(e));
      }
    }
    return Array.from(set, k => { const [type, r, c] = k.split(":"); return { type, r: +r, c: +c }; });
  }
  function normalizeState(s) {
    if (!s || typeof s !== "object") return s;
    for (const field of ["scores", "credits"]) {
      s[field] ||= {};
      for (const team of TEAMS) {
        s[field][team] = Number(s[field][team]) || 0;
        if (field === "credits") s[field][team] = Math.max(0, Math.min(9999, s[field][team]));
      }
    }
    for (const team of TEAMS) { s[`${team}Name`] ||= TEAM_NAMES[team]; s[`${team}Image`] ||= ""; }
    if (!TEAMS.includes(s.activeTeam)) s.activeTeam = "blue";
    return s;
  }
  function createState() { return normalizeState({ title: "Dots & Boxes", edges: generateBoard(), boxes: {}, scores: {}, credits: {}, activeTeam: "blue", question: null, winner: null, className: "", section: "", sessionName: "Match 1", updatedAt: Date.now() }); }
  function placeEdge(state, edge, team = state.activeTeam) {
    if (!edge || !["h", "v"].includes(edge.type) || !Number.isInteger(+edge.r) || !Number.isInteger(+edge.c)) return { ok: false, error: "Invalid edge" };
    const e = { type: edge.type, r: +edge.r, c: +edge.c };
    if ((e.type === "h" && (e.r < 0 || e.r > SIZE || e.c < 0 || e.c >= SIZE)) || (e.type === "v" && (e.r < 0 || e.r >= SIZE || e.c < 0 || e.c > SIZE))) return { ok: false, error: "Edge is outside the board" };
    if (state.edges.some(x => key(x) === key(e))) return { ok: false, error: "That line is already drawn" };
    e.owner = team;
    state.edges.push(e); state.lastEdge = e; const captured = [];
    for (const b of adjacent(e)) if (!state.boxes[`${b.r}:${b.c}`] && edgeCount(b, new Set(state.edges.map(key))) === 4) { state.boxes[`${b.r}:${b.c}`] = team; captured.push(b); }
    state.scores[team] = (state.scores[team] || 0) + captured.length;
    if (!captured.length) state.activeTeam = TEAMS[(TEAMS.indexOf(team) + 1) % TEAMS.length];
    state.updatedAt = Date.now();
    return { ok: true, captured, score: captured.length, state };
  }
  function isValidState(s) { if (!s || !Array.isArray(s.edges) || s.edges.length > TOTAL || !s.boxes) return false; normalizeState(s); return true; }
  const api = { SIZE, TOTAL, TARGET, TEAMS, TEAM_NAMES, edges, boxEdges, adjacent, key, generateBoard, createState, normalizeState, placeEdge, isValidState };
  root.DotsEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

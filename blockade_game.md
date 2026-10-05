# Blockade 3D Game Integration Prompt

## Goal

Implement a new classroom game named **Blockade 3D** in this existing project. Add it as a separate game without rewriting Maze Runner, Monopoly, or other stable features.

The project currently uses a plain HTML/CSS/JavaScript frontend with Express and Socket.IO. Existing game pages and scripts include `game-maze.html` / `js/maze.js` and `game-monopoly.html` / `js/monopoly.js`, with matching dashboard pages. Socket.IO is used for live updates, but current game events generally broadcast rather than providing isolated, code-based game rooms. Build Blockade's session and room flow as new functionality; do not assume that unique join codes, room isolation, or multiplayer player registration already exist.

## Inspect Before Implementing

Before editing, inspect:

- `package.json` to confirm the frontend/runtime dependencies.
- `server.js` and the relevant Socket.IO handlers.
- `game-maze.html`, `js/maze.js`, `dashboard-maze.html`.
- `game-monopoly.html`, `js/monopoly.js`, `dashboard-monopoly.html`.
- Relevant Q-Bank routes and data shape in `server-qbank.js` and its integration with `server.js`.
- The app's navigation/launch points and existing save/session behavior.

Use these files to match naming, styling, page layout, and question-bank data formats. Existing games use vanilla browser JavaScript and Socket.IO. Do not introduce React or React Three Fiber. Use the existing stack; only add a 3D dependency if needed, and explain why before adding it. Prefer a browser-native rendering approach or a small dependency already present if it can meet the visual requirements.

## Scope and Integration

Create Blockade-specific pages and modules, such as:

- `game-blockade.html`
- `dashboard-blockade.html`
- `js/blockade.js`
- `js/blockade-engine.js`
- Blockade-specific CSS as appropriate
- Blockade-specific server session/socket handlers

Make only the minimal shared integration edits needed to register/launch the new game, serve its pages, and connect it to existing question-bank functionality. Do not alter Maze Runner or Monopoly behavior except where a small shared integration change is necessary. Keep Blockade logic namespaced and isolated.

## Classroom Session Flow

The large-screen game page creates a new Blockade session when launched. Each launch must receive a unique session ID and join code. A second game page launch must create a separate session and code.

The teacher dashboard connects to a session by entering its join code. Students may connect from separate devices using that code and an assigned player slot. The server must keep each Blockade session in its own Socket.IO room; do not use global broadcasts for Blockade state or actions.

Implement and document:

- Session creation and join-code generation with collision handling.
- Controller and student joining, player assignment, reconnect/disconnect behavior.
- Authoritative server-side validation for gameplay actions and credits.
- State synchronization to all clients in that session room.
- A clear launch/navigation path consistent with the current app.
- Session persistence only using an existing project mechanism if one is confirmed during inspection. Existing dashboard save/load controls appear to be client-side game-state sessions; do not assume server persistence exists. If server-side saving is needed for Blockade, keep it isolated and state where/how it is stored.

Use the existing event naming style as a guide, but create distinct Blockade events, for example `blockade:create-session`, `blockade:join-session`, `blockade:state`, `blockade:move`, and `blockade:place-wall`. Validate payloads and session membership on the server. Reject unknown sessions, wrong codes, invalid assignments, out-of-turn actions, duplicate actions, malformed payloads, unaffordable actions, and illegal moves/walls.

## Teacher and Student Controls

The teacher controller must be able to:

- Join a session using its code.
- Choose two-player or four-player mode and start the match.
- Set or edit the session title; show it on both controller and game screen.
- Assign players and optionally control any player in teacher-led mode.
- Select a question for all players or a specific player.
- Review/submit an answer result through a clearly defined flow.

Students may join from separate devices and control only their assigned player, if the teacher enables student control. The dashboard should identify who controls each player. Do not trust a browser's claimed player ID or answer correctness without verifying the assignment and the chosen answer against the question data on the server.

Example session titles:

- `Finding the Agricultural Research Institute`
- `Asking Questions from Agriculturists About Solving Problems`

## Learning and Credit Rules

Students earn credits by answering questions correctly. Credits are session state validated by the server.

- Each correct answer awards 2 credits.
- Moving one cell costs 1 credit.
- Placing one wall costs 1 credit.
- An invalid action costs nothing and does not advance the turn.
- A player with 0 credits cannot move or place a wall.
- A teacher can request a new question for a specific player.
- Answering a question and awarding credits does not consume a board-action turn.

Define who can submit an answer (assigned student or teacher controller), how the server checks it, and how repeat submissions are prevented. Never send the correct answer to student clients before the answer is locked. Record the question, target player, answer/result, and credit change in the session history.

## Questions and Q-Bank Integration

Inspect the existing question routes and data formats before choosing an integration. Reuse existing Q-Bank filters/API behavior where compatible; do not create a new question database or assume that the requested filters already exist.

The requested question selection is:

- MCQ questions.
- Type `1` questions.
- Knowledge-based questions from CQ data, if the existing Q-Bank schema and routes support that classification.
- Existing subject/chapter/lesson filters, where available.

If the existing Q-Bank cannot express one of these filters, identify the schema/API gap and implement the smallest compatible extension without changing existing games' behavior. The same active question and target player must appear on the controller and large screen. Use the project's established handling for images or other question fields.

## Game Rules

Blockade is a turn-based tactical board game. On a board-action turn, an active player may take exactly one action:

1. Move one cell, or
2. Place one wall.

Question requests/answers and credit awards happen outside that board-action turn and do not advance it.

### Board

- Default board is 9 x 9.
- Rows increase from top to bottom, starting at 0.
- Columns increase left to right, starting at 0.
- A cell is `{ row, col }`.
- Logical board state is authoritative; rendering must never decide legality.
- Keep rules/engine functions independent from rendering and usable by server validation.

### Two-player mode

- Player 1 starts at `{ row: 8, col: 4 }`; goal is any cell in row 0.
- Player 2 starts at `{ row: 0, col: 4 }`; goal is any cell in row 8.
- First player reaching their goal wins.

### Four-player mode

Turn order: Red, Blue, Green, Purple.

- Red starts at `{ row: 8, col: 4 }`.
- Blue starts at `{ row: 0, col: 4 }`.
- Green starts at `{ row: 4, col: 0 }`.
- Purple starts at `{ row: 4, col: 8 }`.
- Goal cells are the 3 x 3 center zone: rows 3–5 and columns 3–5.
- Use a ranked race: first arrival receives rank 1; remaining active players continue, and finished players are skipped in turn order.

### Movement

Movement is one orthogonal cell (up, down, left, or right). There is no diagonal movement, multi-cell movement, jumping, or occupying another active player's cell in the default rules. Player can only jump each other if they face each other with one single way. player can go around diagonally if a wall sits behind them when facing each other.

An action is legal only when the match is active, the acting player is the current active player, the destination is in bounds and unoccupied, no wall blocks the edge, and the player has at least 1 credit. Invalid attempts leave the state and turn unchanged.

### Walls

A wall blocks movement between cells; it is not a cell. Each wall has a horizontal or vertical orientation, an anchor row and column, spans two adjacent cell boundaries, costs 1 credit, and uses one wall from the player's stock.

Wall stock:

- Two-player mode: 15 walls per player.
- Four-player mode: 10 walls per player.

Reject walls that are out of bounds, overlap another wall, intersect illegally, leave any active player without a route to a goal, are placed out of turn, or exceed the player's credit or wall stock. A rejected placement must not spend credit, reduce stock, advance the turn, modify board state, or render as committed.

Define wall anchor/orientation geometry precisely in the engine and use the same geometry checks for previews, committed moves, and server validation.

### Pathfinding

Use graph-based BFS: cells are nodes and legal adjacent movement is an edge. Walls remove edges. Use a shared `canMoveBetween(cellA, cellB, boardState)` rule for movement, BFS, legal-move previews, wall checks, and server validation.

Before committing a wall:

1. Validate wall geometry.
2. Apply it temporarily.
3. Run BFS for every active player to confirm at least one goal remains reachable.
4. Commit only if every active player still has a route; otherwise roll it back.

## State and Socket Synchronization

Use a serializable state shape compatible with the project's JavaScript style. A suggested shape is:

```js
{
  (sessionId,
    code,
    title,
    mode, // "two-player" | "four-player"
    phase, // "waiting" | "active" | "completed" | "cancelled"
    currentPlayerId,
    players,
    board,
    walls,
    currentQuestion,
    questionHistory,
    rankings,
    createdAt,
    updatedAt);
}
```

Player records should include stable player ID, name, color, assigned controller/student identity as appropriate, position, goal cells, credits, remaining walls, active/finished status, and rank when applicable. Do not serialize live Socket objects; store socket membership separately on the server.

Broadcast a full or safely versioned state update only to clients in the matching Blockade room after an accepted change. Provide a way for a newly joined/reconnected client to obtain the current state. Keep the game screen display-oriented while the server validates actions and owns authoritative state.

## Visual Requirements

Build the game screen and controller using the existing HTML/CSS/JavaScript conventions. The board should visually read as a 3D board and show:

- Raised tiles and clear cell coordinates.
- Distinct player pieces and positions.
- Wall placement preview and committed walls.
- Current player and goal-zone highlights.
- Question panel/overlay and target-player indicator.
- Credit and remaining-wall counts per player.
- Turn indicator, match title, and join code.

Keep the rendering layer driven by logical state. Support common classroom display sizes and controller screens. Avoid putting implementation details in the student-facing UI.

## Session History and Persistence

Record at least the session title, session/code identifiers, players, questions shown, answer outcomes, credits awarded/spent, moves, walls placed, rankings, and start/end times in the Blockade session history. Follow a confirmed existing persistence mechanism if suitable. If adding persistence, isolate it to Blockade and document retention/storage behavior. Do not claim the project already has a server session-save pattern unless inspection confirms it.

## Suggested Implementation Order

1. Inspect existing pages, scripts, routes, question schemas, and save behavior.
2. Define and implement the pure Blockade rules/state engine.
3. Add isolated server session, join-code, room, assignment, and validation handlers.
4. Add question selection/answer checking through the compatible existing Q-Bank path.
5. Build the large-screen game page and dashboard/controller.
6. Add navigation/launch integration and session history persistence.
7. Verify a full two-device classroom flow and the acceptance criteria below.

Do not add or run tests unless specifically requested. If verification is requested, include rule-engine cases for movement, walls, BFS path preservation, credits, and turn order, along with a browser/socket workflow check.

## Acceptance Criteria

- Launching the game screen creates a unique Blockade session and code.
- Separate launches create isolated sessions.
- Controller and student clients join only the intended session room.
- Teacher can start a two-player or four-player game and assign/control players.
- Question selection uses actual supported Q-Bank fields/filters, and answer checking is trusted and repeat-safe.
- Correct answers award 2 credits; each move/wall costs 1 credit; invalid actions cost nothing.
- Zero-credit players cannot perform board actions.
- A question can be requested for a specific player and displays on both controller and game screen.
- Valid movement, wall geometry, path preservation, turn order, finish order, and rankings follow the rules above.
- All session state stays synchronized within the correct room, including after a client joins/reconnects.
- Session title and join code display correctly.
- Session history is recorded using a confirmed and documented Blockade persistence approach.
- Existing games continue to behave as before, with only necessary shared integration edits.

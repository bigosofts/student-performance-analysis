const STORAGE_KEY = "memory-game-v1";
const DB_NAME = "MemoryGameDB";
const STORE_NAME = "images";

let game = {
    boysScore: 0,
    girlsScore: 0,
    currentTurn: "boys",
    previewMode: false,
    tiles: [],
    lastUpdate: Date.now(),
    winner: null,
    classInfo: "",
    sectionInfo: ""
};

// Database Setup
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveImage(id, dataUrl) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put(dataUrl, id);
        tx.oncomplete = () => {
            resolve();
            if (socket) socket.emit('image-saved', { id, dataUrl });
        };
        tx.onerror = () => reject(tx.error);
    });
}

async function getImage(id) {
    const db = await initDB();
    const dbImage = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });

    if (dbImage) return dbImage;

    // Fallback: Return null if no image in DB. 
    // If you have a physical 'images/' folder with images, you can uncomment the line below.
    // return `images/${id}.jpg`; 
    return null;
}

async function clearImages() {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = () => {
            console.log("Images cleared from DB");
            if (socket) socket.emit('image-updated', { id: 'all' });
            resolve();
        };
        tx.onerror = () => reject(tx.error);
    });
}

// Game Logic
// Socket Initialization
let socket;
if (typeof io !== 'undefined') {
    socket = io();
}

function saveGame() {
    game.lastUpdate = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
    
    // Broadcast via socket if available
    if (socket) {
        socket.emit('update-game', game);
    }
}

function loadGame() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        game = JSON.parse(saved);
    }
}

function setGame(newState) {
    if (newState) {
        game = newState;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
    }
}

function initializeTiles() {
    game.tiles = [];
    for (let i = 1; i <= 30; i++) {
        game.tiles.push({
            id: i,
            title: "T-" + i,
            flipped: false,
            used: false,
        });
    }
    game.boysScore = 0;
    game.girlsScore = 0;
    game.currentTurn = "boys";
    game.previewMode = false;
    game.winner = null;
    game.classInfo = "";
    game.sectionInfo = "";
    saveGame();
}

function switchTurn() {
    game.currentTurn = game.currentTurn === "boys" ? "girls" : "boys";
    saveGame();
}

function markCorrect(id) {
    const tile = game.tiles.find((t) => t.id === id);
    if (!tile || tile.used) return;

    tile.used = true;
    tile.flipped = true;

    if (game.currentTurn === "boys") {
        game.boysScore++;
    } else {
        game.girlsScore++;
    }

    saveGame();
    checkWinner();
}

function markWrong(id) {
    const tile = game.tiles.find((t) => t.id === id);
    if (!tile || tile.used) return;

    tile.flipped = true;
    tile.isWrong = true; // Temporary flag for animation
    saveGame();

    setTimeout(() => {
        // Re-find the tile in the current game object to avoid reference issues
        const currentTile = game.tiles.find((t) => t.id === id);
        if (currentTile) {
            currentTile.flipped = false;
            currentTile.isWrong = false;
            switchTurn();
            // Note: switchTurn already calls saveGame()
        }
    }, 10000); 
}

function startPreview() {
    game.previewMode = true;
    saveGame();

    setTimeout(() => {
        game.previewMode = false;
        saveGame();
    }, 10000);
}

function announceWinner(team, className, sectionName) {
    game.winner = team;
    game.classInfo = className;
    game.sectionInfo = sectionName;
    saveGame();
}

function clearWinner() {
    game.winner = null;
    saveGame();
}

function checkWinner() {
    // Auto-check can be added here if desired
}

async function resetGame() {
    // 1. Reset local state
    game.boysScore = 0;
    game.girlsScore = 0;
    game.currentTurn = "boys";
    game.previewMode = false;
    game.winner = null;
    game.tiles.forEach(t => {
        t.used = false;
        t.flipped = false;
        t.isWrong = false;
    });
    
    // 2. Clear Images (Awaited)
    await clearImages();
    
    // 3. Save and Broadcast
    saveGame();
}

function shuffleTiles() {
    for (let i = game.tiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [game.tiles[i], game.tiles[j]] = [game.tiles[j], game.tiles[i]];
    }
    saveGame();
}

// Global Export
window.MemoryGame = {
    get game() { return game; },
    saveGame,
    loadGame,
    initializeTiles,
    shuffleTiles,
    switchTurn,
    markCorrect,
    markWrong,
    startPreview,
    resetGame,
    saveImage,
    getImage,
    setGame,
    announceWinner,
    clearWinner,
    STORAGE_KEY
};

// Auto-initialize on load
loadGame();
if (!game.tiles || game.tiles.length === 0) {
    initializeTiles();
}

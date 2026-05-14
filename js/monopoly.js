
const STORAGE_KEY = "monopoly-game-v1";

let game = {
    boysScore: 500,
    girlsScore: 500,
    govScore: 5000,
    currentTurn: "boys",
    boysPos: 0,
    girlsPos: 0,
    boysImage: null,
    girlsImage: null,
    lastUpdate: Date.now(),
    winner: null,
    classInfo: "",
    sectionInfo: "",
    bookedCells: {} // { cellIndex: 'boys' | 'girls' }
};

// === Sound Engine (Web Audio API) ===
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function getAudioCtx() {
    if (!audioCtx) audioCtx = new AudioCtx();
    return audioCtx;
}

function playMoveSound(team) {
    try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        // Boys get a deeper tone, Girls get a higher tone
        const baseFreq = team === 'boys' ? 440 : 587;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, ctx.currentTime + 0.1);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, ctx.currentTime + 0.2);

        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
    } catch(e) { /* audio not supported */ }
}

function playBookSound() {
    try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
    } catch(e) {}
}

// Board Configuration
const BOARD_DATA = [
    { name: "যাত্রা শুরু, ৫০০ টাকা পাবে", type: "start", icon: "arrow-right-circle" },
    { name: "লামা বাজার", price: 60, color: "purple", type: "property" },
    { name: "জীবন চলার পথে বাধা", type: "obstacle", icon: "help-circle", color: "darkred" },
    { name: "মীরা বাজার", price: 60, color: "purple", type: "property" },
    { name: "আয়কর", price: 200, type: "tax", icon: "bank" },
    { name: "সিলেট স্টেশন", price: 200, type: "station", icon: "train", color: "darkblue" },
    { name: "রাজেন্দ্রপুর", price: 120, color: "yellow", type: "property" },
    { name: "জীবনে পাওয়া সুযোগ", type: "opportunity", icon: "help-circle", color: "darkblue" },
    { name: "কাপাসিয়া", price: 100, color: "yellow", type: "property" },
    { name: "গাজীপুর চৌরাস্তা", price: 150, color: "yellow", type: "property" },
    { name: "জেলখানা", type: "jail", icon: "lock", desc: "২ প্রশ্ন আটকে থাকবে" },
    
    { name: "মাওনা", price: 150, color: "reddish", type: "property" },
    { name: "বিদ্যুৎ সুবিধা", type: "utility", icon: "zap", color: "darkred" },
    { name: "মাস্টারবাড়ি", price: 120, color: "reddish", type: "property" },
    { name: "শিমুলতলী", price: 100, color: "reddish", type: "property" },
    { name: "ময়মনসিংহ স্টেশন", price: 200, type: "station", icon: "train", color: "darkblue" },
    { name: "উত্তরা", price: 250, color: "bluish", type: "property" },
    { name: "জীবন চলার পথে বাধা", type: "obstacle", icon: "help-circle", color: "darkred" },
    { name: "আব্দুল্লাহপুর", price: 200, color: "bluish", type: "property" },
    { name: "মিরপুর", price: 220, color: "bluish", type: "property" },
    { name: "বিশ্রামাগার", type: "rest", icon: "coffee", desc: "২ প্রশ্ন পর্যন্ত বিশ্রামের সুযোগ" },

    { name: "ধলাদিয়া", price: 100, color: "greenish", type: "property" },
    { name: "জীবনে পাওয়া সুযোগ", type: "opportunity", icon: "help-circle", color: "darkblue" },
    { name: "রাজাবাড়ি", price: 150, color: "greenish", type: "property" },
    { name: "সাটিয়াবাড়ি", price: 120, color: "greenish", type: "property" },
    { name: "চট্রগ্রাম স্টেশন", price: 200, type: "station", icon: "train", color: "darkblue" },
    { name: "সাভার", price: 200, color: "orange", type: "property" },
    { name: "জিরানী", price: 180, color: "orange", type: "property" },
    { name: "পানি সুবিধা", type: "utility", icon: "droplet", color: "darkred" },
    { name: "গাবতলী", price: 250, color: "orange", type: "property" },
    { name: "পুলিশের কাছে ধরা", type: "police", icon: "whistle", desc: "জেলখানায় যাও" },

    { name: "ওয়ারী", price: 300, color: "pink", type: "property" },
    { name: "মতিঝিল", price: 300, color: "pink", type: "property" },
    { name: "জীবন চলার পথে বাধা", type: "obstacle", icon: "help-circle", color: "darkred" },
    { name: "ধানমন্ডি", price: 320, color: "pink", type: "property" },
    { name: "ঢাকা স্টেশন", price: 200, type: "station", icon: "train", color: "darkblue" },
    { name: "জীবনে পাওয়া সুযোগ", type: "opportunity", icon: "help-circle", color: "darkblue" },
    { name: "বনানী", price: 350, color: "deepblue", type: "property" },
    { name: "কর পরিশোধ", price: 100, type: "tax", icon: "bank" },
    { name: "গুলশান", price: 400, color: "deepblue", type: "property" }
];

// Socket Initialization
let socket;
if (typeof io !== 'undefined') {
    socket = io();
}

function saveGame() {
    game.lastUpdate = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
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

async function saveTeamImage(team, file) {
    const formData = new FormData();
    formData.append('image', file);
    const tileId = `team-${team}`;

    try {
        const response = await fetch(`/upload/${tileId}`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        if (data.status === 'ok') {
            if (team === 'boys') game.boysImage = data.url;
            if (team === 'girls') game.girlsImage = data.url;
            saveGame();
            return data.url;
        }
    } catch (error) {
        console.error('Upload failed:', error);
    }
}

function movePlayer(team, steps) {
    if (team === 'boys') {
        game.boysPos = (game.boysPos + steps + 40) % 40;
    } else {
        game.girlsPos = (game.girlsPos + steps + 40) % 40;
    }
    playMoveSound(team);
    saveGame();
}

function bookPlace(team) {
    const pos = team === 'boys' ? game.boysPos : game.girlsPos;
    if (!game.bookedCells) game.bookedCells = {};
    game.bookedCells[pos] = team;
    playBookSound();
    saveGame();
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

function updateScore(team, amount) {
    if (team === 'boys') game.boysScore += amount;
    else if (team === 'girls') game.girlsScore += amount;
    else if (team === 'gov') game.govScore += amount;
    saveGame();
}

function switchTurn() {
    game.currentTurn = game.currentTurn === "boys" ? "girls" : "boys";
    saveGame();
}

async function resetGame() {
    game = {
        boysScore: 500,
        girlsScore: 500,
        govScore: 5000,
        currentTurn: "boys",
        boysPos: 0,
        girlsPos: 0,
        boysImage: null,
        girlsImage: null,
        lastUpdate: Date.now(),
        winner: null,
        classInfo: "",
        sectionInfo: "",
        bookedCells: {}
    };
    // Delete all uploaded images from server
    try {
        await fetch('/clear-uploads', { method: 'POST' });
    } catch(e) {
        console.error('Failed to clear uploads:', e);
    }
    saveGame();
}

// Global Export
window.MonopolyGame = {
    get game() { return game; },
    get boardData() { return BOARD_DATA; },
    saveGame,
    loadGame,
    setGame,
    saveTeamImage,
    movePlayer,
    updateScore,
    switchTurn,
    resetGame,
    bookPlace,
    announceWinner,
    clearWinner,
    STORAGE_KEY
};

loadGame();

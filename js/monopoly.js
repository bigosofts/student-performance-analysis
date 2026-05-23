
const STORAGE_KEY = "monopoly-game-v1";
const SESSIONS_KEY = "monopoly-sessions-v1";
const CURRENT_SESSION_KEY = "monopoly-current-session";
let currentSessionName = null;

let game = {
    boysScore: 2500,
    girlsScore: 2500,
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
    } catch (e) { /* audio not supported */ }
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
    } catch (e) { }
}

// Board Configuration
const BOARD_DATA = [
    { name: "যাত্রা শুরু, ৫০০ টাকা পাবে", type: "start", icon: "arrow-right-circle" },
    { name: "লামা বাজার", price: 60, color: "purple", type: "property" },
    { name: "জীবন চলার পথে বাধা", type: "obstacle", icon: "alert-triangle", color: "darkred" },
    { name: "মীরা বাজার", price: 60, color: "purple", type: "property" },
    { name: "আয়কর", price: 200, type: "tax", icon: "bank" },
    { name: "সিলেট স্টেশন", price: 200, type: "station", icon: "train", color: "darkblue" },
    { name: "রাজেন্দ্রপুর", price: 120, color: "yellow", type: "property" },
    { name: "জীবনে পাওয়া সুযোগ", type: "opportunity", icon: "gift", color: "darkblue" },
    { name: "কাপাসিয়া", price: 100, color: "yellow", type: "property" },
    { name: "গাজীপুর চৌরাস্তা", price: 150, color: "yellow", type: "property" },
    { name: "জেলখানা", type: "jail", icon: "lock", desc: "২ প্রশ্ন আটকে থাকবে" },

    { name: "মাওনা", price: 150, color: "reddish", type: "property" },
    { name: "বিদ্যুৎ সুবিধা", type: "utility", icon: "zap", color: "darkred" },
    { name: "মাস্টারবাড়ি", price: 120, color: "reddish", type: "property" },
    { name: "শিমুলতলী", price: 100, color: "reddish", type: "property" },
    { name: "ময়মনসিংহ স্টেশন", price: 200, type: "station", icon: "train", color: "darkblue" },
    { name: "উত্তরা", price: 250, color: "bluish", type: "property" },
    { name: "জীবন চলার পথে বাধা", type: "obstacle", icon: "alert-triangle", color: "darkred" },
    { name: "আব্দুল্লাহপুর", price: 200, color: "bluish", type: "property" },
    { name: "মিরপুর", price: 220, color: "bluish", type: "property" },
    { name: "বিশ্রামাগার", type: "rest", icon: "coffee", desc: "২ প্রশ্ন পর্যন্ত বিশ্রামের সুযোগ" },

    { name: "ধলাদিয়া", price: 100, color: "greenish", type: "property" },
    { name: "জীবনে পাওয়া সুযোগ", type: "opportunity", icon: "gift", color: "darkblue" },
    { name: "রাজাবাড়ি", price: 150, color: "greenish", type: "property" },
    { name: "সাটিয়াবাড়ি", price: 120, color: "greenish", type: "property" },
    { name: "চট্রগ্রাম স্টেশন", price: 200, type: "station", icon: "train", color: "darkblue" },
    { name: "সাভার", price: 200, color: "orange", type: "property" },
    { name: "জিরানী", price: 180, color: "orange", type: "property" },
    { name: "পানি সুবিধা", type: "utility", icon: "droplet", color: "darkred" },
    { name: "গাবতলী", price: 250, color: "orange", type: "property" },
    { name: "পুলিশের কাছে ধরা", type: "police", icon: "whistle", desc: "জেলখানায় যাও" },

    { name: "ওয়ারী", price: 300, color: "pink", type: "property" },
    { name: "মতিঝিল", price: 300, color: "pink", type: "property" },
    { name: "জীবন চলার পথে বাধা", type: "obstacle", icon: "alert-triangle", color: "darkred" },
    { name: "ধানমন্ডি", price: 320, color: "pink", type: "property" },
    { name: "ঢাকা স্টেশন", price: 200, type: "station", icon: "train", color: "darkblue" },
    { name: "জীবনে পাওয়া সুযোগ", type: "opportunity", icon: "gift", color: "darkblue" },
    { name: "বনানী", price: 350, color: "deepblue", type: "property" },
    { name: "কর পরিশোধ", price: 100, type: "tax", icon: "bank" },
    { name: "গুলশান", price: 400, color: "deepblue", type: "property" }
];

// === Opportunity & Obstacle Data ===
const OPPORTUNITY_EVENTS = [
    "পরবর্তী যাত্রা শুরু পজিশন অতিক্রম করলে ১০০০ টাকা বেতন বৃদ্ধি পাবে 💰",
    "যেকোনো পজিশনে যেতে পারবে, তবে বেতন পাবে না 🚀",
    "লামা বাজার ও মীরা বাজার এলাকায় যাবে, জমিগুলো ফ্রিতে আজ থেকে তোমার",
    "রাজেন্দ্রপুর, কাপাসিয়া ও গাজীপুর চৌরাস্তা এলাকায় যাবে, জমিগুলো ফ্রিতে আজ থেকে তোমার",
    "ঈদ বোনাস হিসেবে ১০০০ টাকা পাবে 🎉",
    "তোমার কেনা জায়গায় ১০০% কর পাবে 🏠",
    "মাওনা, মাস্টারবাড়ি ও শিমুলতলী এলাকায় যাবে, জমিগুলো ফ্রিতে আজ থেকে তোমার",
    "ওয়ারী, মতিঝিল ও ধানমন্ডি এলাকায় যাবে, জমিগুলো ফ্রিতে আজ থেকে তোমার",
    "বনানী, গুলশান এলাকায় যাবে, জমিগুলো ফ্রিতে আজ থেকে তোমার",
    "ময়মনসিংহ স্টেশন ও ঢাকা স্টেশন ফ্রিতে আজ থেকে তোমার",
    "চট্রগ্রাম স্টেশন ও সিলেট স্টেশন ফ্রিতে আজ থেকে তোমার",
    "পানি ও বিদ্যুৎ সুবিধা আজ থেকে তোমার",
    "তোমার কেনা জায়গায় ২০০% কর পাবে 🏠",
    "তোমার কেনা জায়গায় ৫০০% কর পাবে 🏠",
    "উত্তরা, আব্দুল্লাহপুর ও মিরপুর এলাকায় যাবে, জমিগুলো ফ্রিতে আজ থেকে তোমার",
    "ধলাদিয়া, রাজাবাড়ি ও সাটিয়াবাড়ি এলাকায় যাবে, জমিগুলো ফ্রিতে আজ থেকে তোমার",
    "সাভার, জিরানী ও গাবতলী এলাকায় যাবে, জমিগুলো ফ্রিতে আজ থেকে তোমার",
    "পরবর্তী যাত্রা শুরু পজিশন অতিক্রম করলে ২০০০ টাকা বেতন বৃদ্ধি পাবে 💰"
];

const OBSTACLE_EVENTS = [
    "১০০০ টাকা ঋণ পরিশোধ করো 💸",
    "১০০০ টাকা হাসপাতাল বিল দাও 🏥",
    "৫০০ টাকা রাস্তার পুলিশের জরিমানা পরিশোধ করো 🚔",
    "মাদকাসক্তির জন্য জেলে যাও ⛓️"
];

function getRandomEvent(type) {
    const list = type === 'opportunity' ? OPPORTUNITY_EVENTS : OBSTACLE_EVENTS;
    return list[Math.floor(Math.random() * list.length)];
}

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
    // Auto-save to current session if one is active
    const sessionName = localStorage.getItem(CURRENT_SESSION_KEY);
    if (sessionName) {
        try {
            const sessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '{}');
            sessions[sessionName] = {
                boysScore: game.boysScore,
                girlsScore: game.girlsScore,
                govScore: game.govScore,
                currentTurn: game.currentTurn,
                boysPos: game.boysPos,
                girlsPos: game.girlsPos,
                boysImage: game.boysImage,
                girlsImage: game.girlsImage,
                bookedCells: game.bookedCells || {},
                winner: game.winner,
                classInfo: game.classInfo,
                sectionInfo: game.sectionInfo,
                savedAt: new Date().toISOString()
            };
            localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
        } catch (e) { /* ignore session save errors */ }
    }
}

function loadGame() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        const loaded = JSON.parse(saved);
        // Merge with defaults so missing fields don't break anything
        game = {
            boysScore: loaded.boysScore !== undefined ? loaded.boysScore : 2500,
            girlsScore: loaded.girlsScore !== undefined ? loaded.girlsScore : 2500,
            govScore: loaded.govScore !== undefined ? loaded.govScore : 5000,
            currentTurn: loaded.currentTurn || "boys",
            boysPos: loaded.boysPos || 0,
            girlsPos: loaded.girlsPos || 0,
            boysImage: loaded.boysImage || null,
            girlsImage: loaded.girlsImage || null,
            lastUpdate: loaded.lastUpdate || Date.now(),
            winner: loaded.winner || null,
            classInfo: loaded.classInfo || "",
            sectionInfo: loaded.sectionInfo || "",
            bookedCells: loaded.bookedCells || {}
        };
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

// Move player with auto-deduction of 100 taka per step
function movePlayer(team, steps) {
    const absSteps = Math.abs(steps);
    const cost = absSteps * 100;

    if (team === 'boys') {
        game.boysScore -= cost;
        game.boysPos = (game.boysPos + steps + 40) % 40;
    } else {
        game.girlsScore -= cost;
        game.girlsPos = (game.girlsPos + steps + 40) % 40;
    }
    // Movement cost goes to government fund
    game.govScore += cost;

    playMoveSound(team);
    saveGame();

    // Return the landed tile type for event handling
    const pos = team === 'boys' ? game.boysPos : game.girlsPos;
    return BOARD_DATA[pos];
}

function bookPlace(team) {
    const pos = team === 'boys' ? game.boysPos : game.girlsPos;
    if (!game.bookedCells) game.bookedCells = {};
    game.bookedCells[pos] = team;
    playBookSound();
    saveGame();
}

function announceWinner(team, className, sectionName) {
    game.winner = team; // 'boys', 'girls', or 'draw'
    game.classInfo = className;
    game.sectionInfo = sectionName;
    saveGame();
}

function clearWinner() {
    game.winner = null;
    saveGame();
}

// Update score - team money changes are linked to government fund
function updateScore(team, amount) {
    if (team === 'boys') {
        game.boysScore += amount;
        game.govScore -= amount; // Inverse: adding to team deducts from gov
    } else if (team === 'girls') {
        game.girlsScore += amount;
        game.govScore -= amount; // Inverse: adding to team deducts from gov
    } else if (team === 'gov') {
        game.govScore += amount; // Direct gov adjustment (standalone)
    }
    saveGame();
}

function switchTurn() {
    game.currentTurn = game.currentTurn === "boys" ? "girls" : "boys";
    saveGame();
}

async function resetGame() {
    // Clear old data first
    localStorage.removeItem(STORAGE_KEY);

    game = {
        boysScore: 2500,
        girlsScore: 2500,
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
    // Delete all uploaded images from server (monopoly-specific)
    try {
        await fetch('/clear-uploads?game=monopoly', { method: 'POST' });
    } catch (e) {
        console.error('Failed to clear uploads:', e);
    }
    saveGame();
}

// === Session Management ===
function getSessions() {
    try {
        const data = localStorage.getItem(SESSIONS_KEY);
        return data ? JSON.parse(data) : {};
    } catch (e) {
        return {};
    }
}

function saveSession(sessionName) {
    if (!sessionName || !sessionName.trim()) return false;
    sessionName = sessionName.trim();
    const sessions = getSessions();
    sessions[sessionName] = {
        boysScore: game.boysScore,
        girlsScore: game.girlsScore,
        govScore: game.govScore,
        currentTurn: game.currentTurn,
        boysPos: game.boysPos,
        girlsPos: game.girlsPos,
        boysImage: game.boysImage,
        girlsImage: game.girlsImage,
        bookedCells: game.bookedCells || {},
        winner: game.winner,
        classInfo: game.classInfo,
        sectionInfo: game.sectionInfo,
        savedAt: new Date().toISOString()
    };
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    currentSessionName = sessionName;
    localStorage.setItem(CURRENT_SESSION_KEY, sessionName);
    return true;
}

function loadSession(sessionName) {
    const sessions = getSessions();
    const session = sessions[sessionName];
    if (!session) return false;
    game.boysScore = session.boysScore !== undefined ? session.boysScore : 2500;
    game.girlsScore = session.girlsScore !== undefined ? session.girlsScore : 2500;
    game.govScore = session.govScore !== undefined ? session.govScore : 5000;
    game.currentTurn = session.currentTurn || "boys";
    game.boysPos = session.boysPos || 0;
    game.girlsPos = session.girlsPos || 0;
    game.boysImage = session.boysImage || null;
    game.girlsImage = session.girlsImage || null;
    game.bookedCells = session.bookedCells || {};
    game.winner = session.winner || null;
    game.classInfo = session.classInfo || "";
    game.sectionInfo = session.sectionInfo || "";
    game.lastUpdate = Date.now();
    currentSessionName = sessionName;
    localStorage.setItem(CURRENT_SESSION_KEY, sessionName);
    saveGame();
    return true;
}

function deleteSession(sessionName) {
    const sessions = getSessions();
    delete sessions[sessionName];
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    if (currentSessionName === sessionName) {
        currentSessionName = null;
        localStorage.removeItem(CURRENT_SESSION_KEY);
    }
}

function getCurrentSessionName() {
    if (!currentSessionName) {
        currentSessionName = localStorage.getItem(CURRENT_SESSION_KEY) || null;
    }
    return currentSessionName;
}

function autoSaveCurrentSession() {
    const name = getCurrentSessionName();
    if (name) {
        saveSession(name);
    }
}

// Global Export
window.MonopolyGame = {
    get game() { return game; },
    get boardData() { return BOARD_DATA; },
    OPPORTUNITY_EVENTS,
    OBSTACLE_EVENTS,
    getRandomEvent,
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
    getSessions,
    saveSession,
    loadSession,
    deleteSession,
    getCurrentSessionName,
    autoSaveCurrentSession,
    STORAGE_KEY
};

loadGame();

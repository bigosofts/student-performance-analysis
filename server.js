const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const XLSX = require('xlsx');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    },
    maxHttpBufferSize: 1e7 // 10MB limit for high-res images
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// ========== QUIZ SYSTEM ==========
let quizQuestions = [];
let currentQuizIndex = 0;

function createDemoExcel(filePath) {
    const data = [
        ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Answer'],
        ['ধান কোন ধরনের ফসল?', 'রবি ফসল', 'খরিফ ফসল', 'নগদ ফসল', 'দোফসলি', 'B'],
        ['বাংলাদেশের প্রধান খাদ্যশস্য কোনটি?', 'গম', 'ধান', 'ভুট্টা', 'যব', 'B'],
        ['সালোকসংশ্লেষণের জন্য কোনটি প্রয়োজন?', 'অক্সিজেন', 'নাইট্রোজেন', 'কার্বন ডাই অক্সাইড', 'হাইড্রোজেন', 'C'],
        ['কোন মাটি ধান চাষের জন্য উপযুক্ত?', 'বেলে মাটি', 'দোঁয়াশ মাটি', 'কাদামাটি', 'পলি মাটি', 'C'],
        ['বাংলাদেশে কোন ফসল সবচেয়ে বেশি উৎপাদিত হয়?', 'গম', 'পাট', 'ধান', 'আখ', 'C'],
        ['জৈব সার কোনটি?', 'ইউরিয়া', 'টিএসপি', 'কম্পোস্ট', 'এমওপি', 'C'],
        ['ফসলের পোকামাকড় দমনে কোন পদ্ধতি পরিবেশবান্ধব?', 'রাসায়নিক কীটনাশক', 'জৈবিক দমন', 'আগুন', 'কোনোটিই নয়', 'B'],
        ['বাংলাদেশের জাতীয় ফল কোনটি?', 'আম', 'কাঁঠাল', 'লিচু', 'কলা', 'B'],
        ['কোনটি রবি ফসল?', 'ধান', 'পাট', 'গম', 'আউশ', 'C'],
        ['মাটির pH কত হলে ধান চাষ ভালো হয়?', '৩-৪', '৫.৫-৬.৫', '৮-৯', '১০-১১', 'B'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Quiz Questions');
    XLSX.writeFile(wb, filePath);
    console.log('Demo quiz Excel created at:', filePath);
}

function loadQuizFromExcel(filePath) {
    try {
        const wb = XLSX.readFile(filePath);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        quizQuestions = [];
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (row && row[0]) {
                quizQuestions.push({
                    question: row[0],
                    options: [row[1], row[2], row[3], row[4]],
                    answer: (row[5] || 'A').toString().toUpperCase()
                });
            }
        }
        currentQuizIndex = 0;
        console.log(`Loaded ${quizQuestions.length} quiz questions`);
    } catch (e) {
        console.error('Failed to load quiz:', e);
    }
}

function initQuizSystem() {
    const quizPath = path.join(uploadsDir, 'quiz-questions.xlsx');
    if (!fs.existsSync(quizPath)) {
        createDemoExcel(quizPath);
    }
    loadQuizFromExcel(quizPath);
}

// ========== MULTER CONFIGS ==========
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const tileId = req.params.tileId || req.body.tileId || 'unknown';
        const ext = path.extname(file.originalname);
        cb(null, `tile-${tileId}-${Date.now()}${ext}`); // Added timestamp to prevent cache issues
    }

});

const upload = multer({ storage: storage });

const quizUploadStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, 'quiz-upload-temp' + path.extname(file.originalname))
});
const quizUpload = multer({ storage: quizUploadStorage });

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));
// Serve uploads folder
app.use('/uploads', express.static(uploadsDir));
app.use(express.json());

// API to upload image
app.post('/upload/:tileId', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    
    const tileId = req.params.tileId;
    const imageUrl = `/uploads/${req.file.filename}`;
    
    // Broadcast to all clients
    io.emit('image-updated', { id: tileId, url: imageUrl });
    
    res.send({ status: 'ok', url: imageUrl });
});

// API to upload quiz Excel
app.post('/upload-quiz', quizUpload.single('quizFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const dest = path.join(uploadsDir, 'quiz-questions.xlsx');
    const tempPath = path.join(uploadsDir, req.file.filename);
    
    // Remove old quiz file
    if (fs.existsSync(dest)) {
        try { fs.unlinkSync(dest); } catch(e) {}
    }
    
    // Rename temp to permanent
    fs.renameSync(tempPath, dest);
    loadQuizFromExcel(dest);
    
    io.emit('quiz-loaded', { count: quizQuestions.length });
    res.json({ status: 'ok', count: quizQuestions.length });
});

// Get next quiz question (randomized)
app.get('/api/quiz/next', (req, res) => {
    if (quizQuestions.length === 0) {
        return res.json({ question: null });
    }
    const randomIndex = Math.floor(Math.random() * quizQuestions.length);
    const q = quizQuestions[randomIndex];
    currentQuizIndex++;
    res.json({ ...q, index: randomIndex + 1, total: quizQuestions.length });
});

// Get quiz info
app.get('/api/quiz/info', (req, res) => {
    res.json({ count: quizQuestions.length, currentIndex: currentQuizIndex });
});

// API to clear all uploads (except quiz file)
app.post('/clear-uploads', (req, res) => {
    fs.readdir(uploadsDir, (err, files) => {
        if (err) return res.status(500).send(err);
        for (const file of files) {
            if (file === 'quiz-questions.xlsx') continue; // keep quiz file
            fs.unlink(path.join(uploadsDir, file), err => {
                if (err) console.error(err);
            });
        }
        // Broadcast wipe to all clients
        io.emit('image-updated', { id: 'all' });
        res.send({ status: 'ok' });
    });
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // When teacher sends a game update
    socket.on('update-game', (gameState) => {
        socket.broadcast.emit('game-updated', gameState);
    });

    // Forward image-saved events (used for sync-start and other UI signals)
    socket.on('image-saved', (data) => {
        socket.broadcast.emit('image-updated', data);
    });

    // Quiz events
    socket.on('show-quiz', (data) => {
        socket.broadcast.emit('quiz-show', data);
    });

    socket.on('quiz-result', (data) => {
        socket.broadcast.emit('quiz-result', data);
    });

    socket.on('close-quiz', () => {
        socket.broadcast.emit('quiz-close');
    });

    // Event overlay (opportunity/obstacle)
    socket.on('show-event', (data) => {
        socket.broadcast.emit('event-show', data);
    });

    socket.on('close-event', () => {
        socket.broadcast.emit('event-close');
    });

    socket.on('disconnect', () => {

        console.log('User disconnected');
    });
});

// Initialize quiz system
initQuizSystem();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
    🚀 Server is running!
    --------------------------------------
    Game Page:      http://localhost:${PORT}/game.html
    Dashboard:      http://localhost:${PORT}/dashboard.html
    Landing Page:   http://localhost:${PORT}/index.html
    --------------------------------------
    To access from mobile, use your PC's IP address:
    http://[YOUR-IP]:${PORT}/dashboard.html
    `);
});

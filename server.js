const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

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

// Multer storage config
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


// API to clear all uploads
app.post('/clear-uploads', (req, res) => {
    fs.readdir(uploadsDir, (err, files) => {
        if (err) return res.status(500).send(err);
        for (const file of files) {
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

    socket.on('disconnect', () => {

        console.log('User disconnected');
    });
});

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


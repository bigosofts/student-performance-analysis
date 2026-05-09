const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    }
});

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // When teacher sends a game update
    socket.on('update-game', (gameState) => {
        // Broadcast to all other clients (the student page)
        socket.broadcast.emit('game-updated', gameState);
    });

    // When teacher triggers an image save (to notify student page to reload images if needed)
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

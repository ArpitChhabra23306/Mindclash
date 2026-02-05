import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import configurations
import connectDB from './config/db.js';
import { connectRedis } from './config/redis.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import debateRoutes from './routes/debateRoutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';
import communityRoutes from './routes/communityRoutes.js';
import marketplaceRoutes from './routes/marketplaceRoutes.js';
import topicRoutes from './routes/topicRoutes.js';

// Import socket handlers
import { initializeSocket } from './socket/index.js';

const app = express();
const httpServer = createServer(app);

// Socket.io setup with CORS
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

// Connect to databases
connectDB();
connectRedis();

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make io accessible to routes
app.set('io', io);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/debates', debateRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/topics', topicRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: '🎮 DebateVerse API is running!',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
    });
});

// Initialize Socket.io handlers
initializeSocket(io);

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎮 DebateVerse Server Running!                          ║
║                                                           ║
║   🌐 API:     http://localhost:${PORT}/api                  ║
║   🔌 Socket:  http://localhost:${PORT}                      ║
║   💻 Mode:    ${process.env.NODE_ENV || 'development'}                             ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export { io };

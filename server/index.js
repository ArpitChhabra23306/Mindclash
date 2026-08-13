import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

// Import configurations & services
import connectDB from './config/db.js';
import { connectRedis } from './config/redis.js';
import { initCronJobs } from './services/cronService.js';

// Import routes
import authRoutes        from './routes/authRoutes.js';
import userRoutes        from './routes/userRoutes.js';
import debateRoutes      from './routes/debateRoutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';
import communityRoutes   from './routes/communityRoutes.js';
import marketplaceRoutes from './routes/marketplaceRoutes.js';
import topicRoutes       from './routes/topicRoutes.js';
import reportRoutes      from './routes/reportRoutes.js';

// Import socket handler
import { initializeSocket } from './socket/index.js';

const app        = express();
const httpServer = createServer(app);

// ─── CORS — handles both localhost dev and production (Vercel/Render) ────────
const allowedOrigins = [
    process.env.CLIENT_URL,
    'http://localhost:5173',
    'http://localhost:3000',
].filter(Boolean);

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
};

// ─── Socket.io with production-ready transport ───────────────────────────────
const io = new Server(httpServer, {
    cors: corsOptions,
    transports: ['polling', 'websocket'], // polling first for Render compatibility
    pingTimeout:  60000,
    pingInterval: 25000,
});

// Connect databases & background services
connectDB();
connectRedis();
initCronJobs();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight

if (process.env.NODE_ENV !== 'test') {
    app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Make io accessible inside routes
app.set('io', io);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/users',       userRoutes);
app.use('/api/debates',     debateRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/topics',      topicRoutes);
app.use('/api/reports',     reportRoutes);

// ─── Health check (for Render uptime monitoring) ─────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status:    'ok',
        message:   '🎮 MindClash API is running!',
        env:       process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
    });
});

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global error handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
});

// ─── Initialize sockets ──────────────────────────────────────────────────────
initializeSocket(io);

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════╗
║   🎮 MindClash Server v2.0 (OpenAI)          ║
║   🌐 Port:   ${PORT}                              ║
║   💻 Mode:   ${(process.env.NODE_ENV || 'development').padEnd(20)}║
║   🤖 AI:     gpt-4o-mini (batched)           ║
╚══════════════════════════════════════════════╝
`);
});

export { io };

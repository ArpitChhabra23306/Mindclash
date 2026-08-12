# Phase 2: System Architecture & Data Flow

> **Interview Pro-Tip:** Being able to trace the high-level architecture from browser to server to database —
> and explaining how middleware, routes, and services interact — is a senior-level skill.
> You should be able to draw this system design on a whiteboard in under 2 minutes.

---

## 1. The Big Picture — 4-Tier Architecture

MindClash uses an enhanced **4-Tier Application** architecture. Redis sits between the Application Server and MongoDB as a dedicated caching layer.

```
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 1: Presentation Layer (The Client)                            │
│  React 18 SPA running inside the user's browser                     │
│  React Router, Axios, Socket.io-client, Framer Motion               │
│  Deployed on: Vercel                                                 │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           │  Two communication channels:
                           │  1. HTTP (Axios) — for REST API calls
                           │  2. WebSocket (Socket.io) — for real-time events
                           │  Both target PORT 5000
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 2: Application Layer (The Server)                             │
│  Express.js + Node.js — handles business logic & orchestration      │
│  8 REST route groups + 1 Socket.io event hub                        │
│  4 In-Memory RAM Maps for real-time socket state                    │
│  Deployed on: Render                                                 │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                    ┌──────┴───────┐
                    │              │
                    ▼              ▼
┌─────────────────────┐   ┌─────────────────────────────────────────┐
│  TIER 3: Redis      │   │  TIER 4: MongoDB Atlas (Primary DB)     │
│  (Cache Layer)      │   │  Stores all persistent data             │
│  ioredis client     │   │  Users, Debates, Bets, Topics           │
│  Response caching   │   │  Mongoose ORM                           │
│  TTL expiration     │   │                                         │
│  Hosted: Redis Cloud│   │  Hosted: MongoDB Atlas                  │
└─────────────────────┘   └─────────────────────────────────────────┘
```

**How the server decides where to read data:**
```
HTTP Request arrives
       │
       ▼
 1. Check Redis Cache (getCache)   ← <1ms if hit
       │
       ├── CACHE HIT → return cached JSON immediately (no DB query)
       │
       └── CACHE MISS → Query MongoDB → store in Redis → return data
```

### Why 4 Tiers?
Each tier can be scaled, deployed, and maintained **independently**:
- Redis sits in front of MongoDB for heavy read-only queries (Leaderboards, Topics).
- MongoDB remains the single source of truth for all writes.
- In-Memory RAM Maps in the server handle real-time socket state at nanosecond speed.
- React on Vercel CDN never directly touches the DB — everything goes through the API.

---

## 2. Two Communication Channels (HTTP REST vs. WebSockets)

Most web apps only use HTTP. MindClash uses TWO distinct communication channels on the same port (5000):

```
┌────────────────────────────────────────────────────────────────┐
│                        React Client                            │
│                                                                │
│  Axios ──────────────────────────────────► Express REST API   │
│  (HTTP, one-shot request-response)         /api/auth           │
│                                            /api/users          │
│                                            /api/debates        │
│                                            /api/leaderboard    │
│                                            /api/marketplace    │
│                                                                │
│  Socket.io-client ──────────────────────► Socket.io Server    │
│  (WebSocket, persistent open channel)      join_queue          │
│  "stays connected for the whole match"     submit_argument     │
│                                            match_found         │
│                                            debate_ended        │
└────────────────────────────────────────────────────────────────┘
```

| Communication Type | Protocol | Usage in MindClash | Characteristic |
|---|---|---|---|
| **REST API (Axios)** | HTTP / HTTPS | Login, Profile, Leaderboard, History | One-shot request & response |
| **WebSockets (Socket.io)** | WS / WSS | Matchmaking queue, Live argument turns, Betting, Reactions | Long-lived, bi-directional persistent channel |

---

## 3. Server Boot Sequence (`server/index.js`)

`server/index.js` is the central entry point. When `node index.js` runs, the server boots in this exact order:

```javascript
// Step 1 — Load environment variables FIRST before anything reads process.env
dotenv.config();

// Step 2 — Create Express app instance
const app = express();

// Step 3 — Create raw HTTP server wrapping Express
const httpServer = createServer(app);

// Step 4 — Create Socket.io server attached to the HTTP server
const io = new Server(httpServer, {
    cors: corsOptions,
    transports: ['polling', 'websocket'], // polling first for Render cloud compatibility
    pingTimeout: 60000,
    pingInterval: 25000,
});

// Step 5 — Connect to databases
connectDB();      // Connects to MongoDB Atlas
connectRedis();   // Connects to Redis Cloud (optional fallback)

// Step 6 — Register global middleware
app.use(helmet());          // Security headers
app.use(cors(corsOptions)); // Allow React client origin
app.use(morgan('dev'));      // Log requests to terminal
app.use(express.json({ limit: '10kb' })); // Parse JSON body

// Step 7 — Make 'io' accessible inside REST route controllers
app.set('io', io);

// Step 8 — Mount the 8 REST route groups
app.use('/api/auth',        authRoutes);
app.use('/api/users',       userRoutes);
app.use('/api/debates',     debateRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/topics',      topicRoutes);
app.use('/api/reports',     reportRoutes);

// Step 9 — Health check endpoint
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Step 10 — Global Error & 404 Handlers
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
app.use((err, req, res, next) => res.status(500).json({ message: err.message }));

// Step 11 — Wire up Socket.io event listeners & auth middleware
initializeSocket(io);

// Step 12 — Start listening on port 5000
httpServer.listen(5000, '0.0.0.0', () => console.log('Server running on port 5000'));
```

---

## 4. Global Middleware Layer

Middleware functions run sequentially on every incoming HTTP request before reaching route handlers.

```
Incoming Request ──► [express.json] ──► [cors] ──► [helmet] ──► [morgan] ──► Route Handler
```

### 4.1 Body Parsing (`express.json`)
Converts raw JSON payload streams into native JavaScript objects on `req.body`.
* `limit: '10kb'` prevents Memory Exhaustion (DoS) attacks by rejecting payloads larger than 10KB.

### 4.2 How Frontend Sends Data (`req.body` vs `req.params` vs `req.query`)
- **`req.body`**: JSON objects in POST/PUT requests (e.g. `{ email, password }`).
- **`req.params`**: Dynamic URL path parameters (e.g. `/api/users/:id` → `req.params.id`).
- **`req.query`**: Query string filters (e.g. `/api/leaderboard?category=Tech` → `req.query.category`).

### 4.3 CORS Configuration (`cors`)
Allows cross-origin HTTP requests from the React client (`localhost:5173` or Vercel domain) while blocking unauthorized domains.
- `credentials: true` enables client requests with Authorization headers or cookies.
- Options preflight requests (`app.options('*', cors(...))`) ensure pre-flight checks succeed.

### 4.4 HTTP Security Headers (`helmet`)
Sets key security headers:
- `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing attacks.
- `X-Frame-Options: DENY`: Prevents Clickjacking attacks inside iframes.
- `Strict-Transport-Security` (HSTS): Forces HTTPS communication.

### 4.5 Logging (`morgan`)
Prints request logs (`POST /api/auth/login 200 45ms`) to the server console for live monitoring and debugging.

---

## 5. REST Routing & Receptionist Pattern

The server divides endpoint responsibilities into 8 specialized route modules:

```
                  POST /api/auth/login
                           │
                           ▼
                  server/index.js (Receptionist)
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
      /api/auth Prefix            /api/users Prefix
             │                           │
             ▼                           ▼
     authRoutes.js               userRoutes.js
```

| Route Group | Responsibility | Dedicated Phase |
|---|---|---|
| `/api/auth` | Login, Register, Logout, Me | Phase 3 |
| `/api/users` | Profile, Follow/Unfollow, Search | Phase 7 |
| `/api/debates` | Debate History, Replays, AI Assist | Phase 6 |
| `/api/leaderboard` | Global & Weekly Leaderboards | Phase 7 |
| `/api/communities` | Guilds & Group Discussions | Phase 7 |
| `/api/marketplace` | Shop Items & Custom Avatars | Phase 7 |
| `/api/topics` | Topic Generation & Browsing | Phase 5 |
| `/api/reports` | Moderation & Reporting | Phase 6 |

---

## 6. Middleware Pipeline (`protect` & `optionalAuth`)

Route handlers use a modular middleware pipeline:

```javascript
// Step-by-step Pipeline Execution:
router.get('/me', protect, getUserProfile);
//                 │          │
//                 │          └─► Step 2: Route Controller executes only if Step 1 passes
//                 └────────────► Step 1: JWT Verification & Ban Check
```

- **`protect`**: Verifies JWT in `Authorization: Bearer <token>`, fetches user from DB (excluding password), checks `isBanned`, and attaches `req.user`. Rejects with `401 Unauthorized` if token is missing or invalid.
- **`optionalAuth`**: Attaches `req.user` if a valid JWT is present, but allows guest access if no token is provided.

---

## 7. Socket.io Server Architecture

Socket.io runs alongside Express on port 5000, managed via `initializeSocket(io)` in `server/socket/index.js`.

### 7.1 Socket Handshake Authentication (`authenticateSocket`)
Unlike HTTP requests that send headers on every call, Socket.io authenticates **ONCE during the connection handshake**:

```javascript
// Client sends token in handshake auth object:
const socket = io('http://localhost:5000', { auth: { token } });

// Server middleware runs before connection is accepted:
io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = await User.findById(decoded.id).select('-password');
    next(); // Attaches socket.user to the connection
});
```

### 7.2 In-Memory State Maps
The server maintains four high-speed JavaScript `Map` structures in RAM for low-latency state management:
1. `matchmakingQueue`: Tracks queued players awaiting match pairing.
2. `activeDebates`: Caches live debate documents to prevent excessive DB reads.
3. `userSockets`: Maps `userId` → `socketId` for direct message targeting.
4. `pendingDisconnects`: Manages reconnection grace periods before match forfeit.

---

## 8. Controller-Service Pattern (Separation of Concerns)

Business logic is strictly decoupled into distinct operational layers:

```
Request ──► Route ──► Middleware ──► Controller ──► Service ──► External API / DB
```

- **Controller**: Reads `req.body` / `req.params`, manages HTTP status codes, and formats JSON responses.
- **Service**: Pure reusable logic (e.g. `openaiService.js`) handling third-party integrations (OpenAI API, heuristics) without HTTP/Express coupling.

---

## 9. Environment Security & Health Checks

### 9.1 Environment Variables (`.env` & `.gitignore`)
All credentials (`MONGODB_URI`, `JWT_SECRET`, `OPENAI_API_KEY`) reside exclusively in `server/.env`. `.env` is listed in `.gitignore` to prevent secret leaks to public repositories.

### 9.2 Health Check & Server Uptime (`/api/health`)
Render free tier instances sleep after 15 minutes of inactivity. An external keep-alive ping to `GET /api/health` every 14 minutes prevents server sleep, keeping cold-start times at 0ms.

---

## 10. Redis Caching — Overview

Redis sits between the Express server and MongoDB as a cache layer for heavy read-only queries.
It is actively used in MindClash for the Leaderboard and Topics endpoints.

> 📖 **Full Deep Dive → Phase 3:** `phase_3_redis_caching.md` covers everything:
> the connection setup, all 3 helper functions (`getCache` / `setCache` / `delCache`),
> every endpoint using cache with TTL values, the Cache-Aside pattern with real code,
> graceful degradation, and Redis interview Q&A.

**At-a-glance — where Redis is used:**
| Route | Cache Key | TTL |
|---|---|---|
| `GET /api/leaderboard/global` | `leaderboard:global:{page}:{limit}` | 5 min |
| `GET /api/leaderboard/weekly` | `leaderboard:weekly` | 5 min |
| `GET /api/topics/trending` | `topics:trending` | 10 min |
| `GET /api/topics/featured` | `topics:featured` | 1 hour |

---

## 11. Architecture Interview Q&A

**Q: How does port 5000 handle both HTTP REST and WebSockets simultaneously?**
> A: `http.createServer(app)` wraps Express. Socket.io attaches to that raw HTTP server instance. When a WebSocket request arrives, it starts as an HTTP upgrade request on port 5000, which Socket.io upgrades to a persistent WebSocket TCP connection on the exact same port.

**Q: Why use `transports: ['polling', 'websocket']` instead of WebSocket only?**
> A: Cloud platforms like Render often fail on raw WebSocket handshake upgrades. Starting with HTTP polling guarantees a successful connection handshake first, which Socket.io then automatically upgrades to WebSockets seamlessly.

**Q: Why are matchmaking queues kept in server memory (`Map`) instead of MongoDB?**
> A: Matchmaking states change every millisecond. In-memory `Map` lookups run in nanoseconds, whereas MongoDB writes take 5-50ms. RAM storage provides maximum responsiveness during queue pairing.

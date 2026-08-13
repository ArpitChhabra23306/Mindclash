# Phase 3: Redis — Fundamentals, Architecture & Heavily Commented Code Breakdown

> **Goal:** After reading this document, you should understand every single line of Redis code in MindClash. Every code block is packed with line-by-line inline comments explaining the exact inputs, outputs, error handles, and memory behavior.

---

## 1. The Big Picture: All Files & Endpoints Using Redis

Redis operations in MindClash are centralized in a single configuration module (`server/config/redis.js`) and consumed by public REST route controllers:

```
                                  ┌────────────────────────────────────────────────────────┐
                                  │            server/config/redis.js                      │
                                  │  - Connects to REDIS_URL via ioredis                   │
                                  │  - Exports: getCache(), setCache(), delCache()         │
                                  └──────────────────────────┬─────────────────────────────┘
                                                             │
                                   ┌─────────────────────────┴────────────────────────┐
                                   ▼                                                  ▼
┌──────────────────────────────────────────────────────┐  ┌──────────────────────────────────────────────────────┐
│        server/routes/leaderboardRoutes.js            │  │           server/routes/topicRoutes.js               │
│                                                      │  │                                                      │
│  GET /api/leaderboard/global                         │  │  GET /api/topics/trending                            │
│  - Key: leaderboard:global:{page}:{limit}            │  │  - Key: topics:trending                              │
│  - TTL: 300s (5 minutes)                             │  │  - TTL: 600s (10 minutes)                            │
│                                                      │  │                                                      │
│  GET /api/leaderboard/weekly                         │  │  GET /api/topics/featured                            │
│  - Key: leaderboard:weekly                           │  │  - Key: topics:featured                              │
│  - TTL: 300s (5 minutes)                             │  │  - TTL: 3600s (1 hour)                              │
└──────────────────────────────────────────────────────┘  └──────────────────────────────────────────────────────┘
```

### Complete Code & Route Overview Table:

| File Name | Function / Route | Purpose | Redis Action | TTL / Expiry |
|---|---|---|---|---|
| [`server/config/redis.js`](file:///e:/Projects/Mindclash-main/server/config/redis.js) | `connectRedis()` | Connects Node.js to Redis Cloud | Opens persistent TCP connection | Alive for server lifecycle |
| [`server/config/redis.js`](file:///e:/Projects/Mindclash-main/server/config/redis.js) | `getCache(key)` | Safe read helper | `redis.get(key)` + `JSON.parse` | N/A (read only) |
| [`server/config/redis.js`](file:///e:/Projects/Mindclash-main/server/config/redis.js) | `setCache(key, val, ttl)` | Safe write helper | `redis.set(key, JSON.stringify(val), 'EX', ttl)` | Custom per key |
| [`server/config/redis.js`](file:///e:/Projects/Mindclash-main/server/config/redis.js) | `delCache(key)` | Invalidation helper | `redis.del(key)` | Deletes key immediately |
| [`server/index.js`](file:///e:/Projects/Mindclash-main/server/index.js) | `connectRedis()` | Boot sequence call | Initializes Redis connection | Called once on startup |
| [`server/routes/leaderboardRoutes.js`](file:///e:/Projects/Mindclash-main/server/routes/leaderboardRoutes.js) | `GET /api/leaderboard/global` | Caches global rankings | Read/Write `leaderboard:global:{page}:{limit}` | 300s (5 minutes) |
| [`server/routes/leaderboardRoutes.js`](file:///e:/Projects/Mindclash-main/server/routes/leaderboardRoutes.js) | `GET /api/leaderboard/weekly` | Caches weekly rankings | Read/Write `leaderboard:weekly` | 300s (5 minutes) |
| [`server/routes/topicRoutes.js`](file:///e:/Projects/Mindclash-main/server/routes/topicRoutes.js) | `GET /api/topics/trending` | Caches trending topics | Read/Write `topics:trending` | 600s (10 minutes) |
| [`server/routes/topicRoutes.js`](file:///e:/Projects/Mindclash-main/server/routes/topicRoutes.js) | `GET /api/topics/featured` | Caches featured topic | Read/Write `topics:featured` | 3600s (1 hour) |

---

## 2. Fundamentals: What Is Redis & Where Does It Live?

### 2.1 What Is Redis?
Redis stands for **Re**mote **Di**ctionary **S**erver. It is an open-source, ultra-fast key-value data store that keeps 100% of its data inside **RAM (Random Access Memory)** rather than writing it to disk.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            WHERE DATA LIVES                                 │
│                                                                             │
│  MongoDB Atlas (Disk): 📀 Persistent. Survives restarts. Slow reads.       │
│                           ~50-200ms per query on large collections           │
│                                                                             │
│  Redis Cloud (RAM):    ⚡ Temporary. Lost on restart. Instant reads.         │
│                           <1ms per key lookup                               │
│                                                                             │
│  Node.js RAM (Map):    🧠 Per-process memory. Fastest possible. No network. │
│                           <0.001ms — direct memory pointer lookup           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Hardware Speed Hierarchy

| Storage Tier | Physical Technology | Analogy | Read Latency |
|---|---|---|---|
| **Node.js RAM (`Map`)** | Server CPU Cache / RAM | A sticky note attached to your monitor | **<0.001ms** (Nanoseconds) |
| **Redis (In-Memory DB)** | Server RAM Electrical Chips | A notebook sitting on your desk | **<1ms** (Microseconds) |
| **MongoDB (Primary DB)** | SSD / Flash / Disk Storage | Walking to a library 5 miles away | **50ms – 200ms** (Milliseconds) |

---

## 3. Demystifying Locations: Client PC vs Node.js vs Redis Cloud

```
  ┌─────────────────────────────┐
  │   CLIENT TIER (User PC)     │
  │   React App in Chrome       │
  │   - localStorage            │
  │   - React State             │
  │   (Private to 1 user only)  │
  └──────────────┬──────────────┘
                 │
                 │ HTTP / WebSocket Network
                 ▼
  ┌─────────────────────────────┐
  │   SERVER TIER (Node.js)     │
  │   Express API (Render)      │
  │   - In-Memory Maps          │
  │   - Route Handlers          │
  └──────┬───────────────┬──────┘
         │               │
         │ TCP Pipeline  │ Mongoose TCP
         ▼               ▼
┌──────────────────┐  ┌──────────────────┐
│   REDIS CLOUD    │  │  MONGODB ATLAS   │
│   (RAM Storage)  │  │  (Disk Storage)  │
│   Shared Cache   │  │  Primary Data    │
└──────────────────┘  └──────────────────┘
```

1. **Client PC (Browser):** Holds `localStorage`, `sessionStorage`, and React state. This is **private per user**. User A cannot read User B's `localStorage`.
2. **Node.js RAM (Express Server):** Holds local variables, JavaScript `Map` objects (`matchmakingQueue`, `activeDebates`). Access is instantaneous (<0.001ms), but data is lost if Node.js restarts and cannot be shared across 2+ server instances.
3. **Redis Server (Cloud / Infrastructure):** Runs as an independent backend database server. It is **shared across all server nodes and accessible to all users**, while operating at near-RAM speed (<1ms).

---

## 4. What is `REDIS_URL`?

`REDIS_URL` is the URI connection string (address + port + credentials) that allows your Node.js Express server to establish a secure TCP network pipeline to your Redis server.

```
redis://default:MySecretPassword123@redis-12345.c1.us-east-1.ec2.redns.redis-cloud.com:12345
│       │       │                      │                                                  │
└Protocol  User  └──────Password───────┴──────────────Host Domain Name─────────────────────┴Port
```

* **`redis://`**: Standard unencrypted Redis protocol. (`rediss://` is used for TLS/SSL encrypted connections).
* **`default`**: Default username for Redis ACL (Access Control List).
* **`MySecretPassword123`**: Authentication password configured on the Redis server.
* **`redis-12345...com`**: The public hostname or IP address of the Redis cloud instance.
* **`12345`**: The TCP port (default for Redis is `6379`, but cloud providers assign custom ports).

---

## 5. Top 5 Real-World Features of Redis in Production

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           5 CORE USES OF REDIS                              │
│                                                                             │
│  1. Response Caching        👉 Used in MindClash (Leaderboard & Topics)      │
│  2. API Rate Limiting       👉 Block IP spam & brute-force login attacks    │
│  3. Session Storage         👉 Store user cookies across multiple servers   │
│  4. Sorted Sets (ZADD)      👉 Real-time live scoreboards                   │
│  5. Pub/Sub Messaging       👉 Sync WebSocket events across 2+ server nodes │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Heavily Commented Code Breakdown — Every Line Explained

Below is the complete, heavily commented source code for every file where Redis is implemented in MindClash.

---

### 6.1 `server/config/redis.js` (Connection & Wrapper Functions)

```javascript
// Step 1: Import the ioredis package (the standard, high-performance Node.js Redis client driver)
import Redis from 'ioredis';

// Step 2: Declare a module-scoped singleton variable 'redis', initialized to null.
// If REDIS_URL is not set in .env, this remains null so helper functions know to fallback to MongoDB.
let redis = null;

/**
 * Connects Express server to Redis Cloud instance
 * @returns {object|null} The ioredis client instance or null if unconfigured
 */
const connectRedis = () => {
    try {
        // Step 3: Check if the REDIS_URL environment variable is provided in server/.env
        if (process.env.REDIS_URL) {
            
            // Step 4: Instantiate new ioredis client with explicit connection options
            redis = new Redis(process.env.REDIS_URL, {
                maxRetriesPerRequest: 3,      // If a command stalls/fails, retry up to 3 times before throwing error
                retryDelayOnFailover: 100,    // Wait 100 milliseconds between retry attempts during failovers
                lazyConnect: true,            // DEFER TCP connection until .connect() is explicitly called below
            });

            // Step 5: Event Listener — Triggers when TCP connection to Redis succeeds
            redis.on('connect', () => {
                console.log('✅ Redis Connected');
            });

            // Step 6: Event Listener — Triggers if Redis connection encounters an error or network drop
            redis.on('error', (err) => {
                console.error('❌ Redis Error:', err.message);
            });

            // Step 7: Initiate the asynchronous TCP connection to Redis Cloud and catch startup errors
            redis.connect().catch(console.error);

        } else {
            // Step 8: Log a friendly warning if REDIS_URL is omitted. The server continues running smoothly using MongoDB.
            console.log('⚠️ Redis URL not configured, using in-memory fallback');
        }
    } catch (error) {
        // Step 9: Catch any synchronous initialization errors during setup
        console.error('❌ Redis Connection Error:', error.message);
    }

    // Step 10: Return the initialized client (or null)
    return redis;
};

/**
 * Safely reads and parses a JSON value from Redis RAM
 * @param {string} key - The cache key to lookup (e.g. 'leaderboard:global:1:50')
 * @returns {Promise<object|null>} The parsed JSON object if hit, or null if miss/error/unconfigured
 */
export const getCache = async (key) => {
    // Safety Check 1: If Redis is unconfigured or null, return null immediately (triggers MongoDB query)
    if (!redis) return null;

    try {
        // Step 11: Execute Redis GET command. Returns raw JSON string if key exists, or null if expired/missing
        const data = await redis.get(key);

        // Step 12: Deserialization — Redis only stores strings. Convert raw string back into a JS object.
        return data ? JSON.parse(data) : null;

    } catch (err) {
        // Safety Check 2: If a network hiccup occurs, log error and return null. App falls back gracefully to MongoDB!
        console.error('Redis getCache error:', err.message);
        return null;
    }
};

/**
 * Safely stringifies and saves a JSON object to Redis RAM with expiration (TTL)
 * @param {string} key - The cache key to set
 * @param {object} value - The JavaScript object/payload to store
 * @param {number} ttlSeconds - Time-To-Live in seconds (default: 300s / 5 mins)
 */
export const setCache = async (key, value, ttlSeconds = 300) => {
    // Safety Check 1: If Redis is unconfigured or null, exit function silently
    if (!redis) return;

    try {
        // Step 13: Execute Redis SET command with Expiration
        //  - key: The unique identifier string
        //  - JSON.stringify(value): Serializes JS object into a string for storage
        //  - 'EX': Redis flag instructing Redis to EXpire the key
        //  - ttlSeconds: Number of seconds before Redis auto-deletes the key from RAM
        await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);

    } catch (err) {
        // Safety Check 2: If write fails, log error silently. The response was already calculated and returned to user!
        console.error('Redis setCache error:', err.message);
    }
};

/**
 * Manually invalidates and removes a cache key from Redis RAM
 * @param {string} key - The cache key to delete
 */
export const delCache = async (key) => {
    // Safety Check 1: If Redis is unconfigured, exit silently
    if (!redis) return;

    try {
        // Step 14: Execute Redis DEL command to purge key immediately
        await redis.del(key);
    } catch (err) {
        console.error('Redis delCache error:', err.message);
    }
};

// Export redis instance and boot function
export { redis, connectRedis };
```

---

### 6.2 `server/index.js` (Server Boot Sequence)

```javascript
// Step 1: Import the connectRedis initializer function from our configuration module
import { connectRedis } from './config/redis.js';

// ... Express setup, Helmet, CORS, Morgan middleware ...

// Step 2: Execute connectRedis() during Express server boot sequence
// This opens the TCP network connection to Redis Cloud in parallel with MongoDB (connectDB())
connectRedis();

// ... Route mounting and httpServer.listen(5000) ...
```

---

### 6.3 `server/routes/leaderboardRoutes.js` (Global & Weekly Leaderboard Caching)

```javascript
import express from 'express';
import User from '../models/User.js';

// Step 1: Import safe cache wrapper helpers from redis.js
import { getCache, setCache } from '../config/redis.js';

const router = express.Router();

/**
 * @route   GET /api/leaderboard/global
 * @desc    Get global leaderboard (Ranked by reputation & wins)
 * @access  Public
 */
router.get('/global', async (req, res) => {
    try {
        // Step 2: Parse pagination arguments from URL query parameters (e.g. ?page=1&limit=50)
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;

        // Step 3: Construct a dynamic namespace key (e.g. 'leaderboard:global:1:50')
        // Using colons 'entity:aspect:id' is a standard Redis key naming convention
        const cacheKey = `leaderboard:global:${page}:${limit}`;

        // ─── STEP 4: CHECK REDIS CACHE FIRST (CACHE HIT CHECK) ───────────────────────
        const cachedData = await getCache(cacheKey);
        
        if (cachedData) {
            // CACHE HIT! Return JSON directly from Redis RAM in <1ms.
            // MongoDB queries on lines 5-9 below are COMPLETELY SKIPPED!
            return res.json(cachedData);
        }

        // ─── STEP 5: CACHE MISS → QUERY MONGODB DATABASE ─────────────────────────────
        const skip = (page - 1) * limit;

        // Expensive MongoDB query: Scans User collection, sorts by reputation & wins
        const users = await User.find({ totalDebates: { $gt: 0 } })
            .sort({ reputation: -1, wins: -1 })
            .skip(skip)
            .limit(limit)
            .select('username displayName avatar frame tier level reputation xp wins losses totalDebates bestStreak');

        // Count total qualifying users for pagination metadata
        const total = await User.countDocuments({ totalDebates: { $gt: 0 } });

        // Format rankings and calculate win percentage
        const rankedUsers = users.map((user, index) => ({
            rank: skip + index + 1,
            ...user.toObject(),
            winRate: user.totalDebates > 0 ? Math.round((user.wins / user.totalDebates) * 100) : 0,
        }));

        // Construct final payload object
        const responseData = {
            success: true,
            leaderboard: rankedUsers,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalUsers: total,
            },
        };

        // ─── STEP 6: STORE RESPONSE IN REDIS RAM FOR NEXT 5 MINUTES ──────────────────
        // Key: 'leaderboard:global:1:50', Payload: responseData, TTL: 300 seconds (5 mins)
        await setCache(cacheKey, responseData, 300);

        // ─── STEP 7: RETURN FRESH RESPONSE TO CURRENT USER ───────────────────────────
        res.json(responseData);

    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * @route   GET /api/leaderboard/weekly
 * @desc    Get weekly leaderboard (Active in last 7 days)
 * @access  Public
 */
router.get('/weekly', async (req, res) => {
    try {
        // Step 8: Static key for weekly leaderboard
        const cacheKey = 'leaderboard:weekly';

        // Step 9: Check Redis RAM cache
        const cachedData = await getCache(cacheKey);
        if (cachedData) {
            // CACHE HIT → Return cached JSON in <1ms
            return res.json(cachedData);
        }

        // Step 10: CACHE MISS → Query MongoDB for users active in last 7 days
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const users = await User.find({
            totalDebates: { $gt: 0 },
            lastLogin: { $gte: oneWeekAgo }
        })
            .sort({ wins: -1, reputation: -1 })
            .limit(50)
            .select('username displayName avatar tier level reputation wins losses totalDebates');

        const rankedUsers = users.map((user, index) => ({
            rank: index + 1,
            ...user.toObject(),
            winRate: user.totalDebates > 0 ? Math.round((user.wins / user.totalDebates) * 100) : 0,
        }));

        const responseData = {
            success: true,
            leaderboard: rankedUsers,
            period: 'weekly',
        };

        // Step 11: Cache result in Redis for 5 minutes (300 seconds)
        await setCache(cacheKey, responseData, 300);

        // Step 12: Return response
        res.json(responseData);

    } catch (error) {
        console.error('Get weekly leaderboard error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

export default router;
```

---

### 6.4 `server/routes/topicRoutes.js` (Trending & Featured Topics Caching)

```javascript
import express from 'express';
import Topic from '../models/Topic.js';

// Step 1: Import Redis cache wrapper helpers
import { getCache, setCache } from '../config/redis.js';

const router = express.Router();

/**
 * @route   GET /api/topics/trending
 * @desc    Get top 10 trending topics
 * @access  Public
 */
router.get('/trending', async (req, res) => {
    try {
        // Step 2: Define static cache key
        const cacheKey = 'topics:trending';

        // Step 3: Check Redis RAM cache
        const cached = await getCache(cacheKey);
        if (cached) {
            // CACHE HIT → Return immediately (<1ms)
            return res.json(cached);
        }

        // Step 4: CACHE MISS → Fetch trending topics from MongoDB
        const topics = await Topic.getTrending(10);
        const responseData = { success: true, topics };

        // Step 5: Save in Redis RAM with 10-Minute TTL (600 seconds)
        // Trending topics change slowly, so 10 minutes is an optimal cache lifetime
        await setCache(cacheKey, responseData, 600);

        // Step 6: Return response
        res.json(responseData);

    } catch (error) {
        console.error('Get trending error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * @route   GET /api/topics/featured
 * @desc    Get featured topic of the day
 * @access  Public
 */
router.get('/featured', async (req, res) => {
    try {
        // Step 7: Define static cache key
        const cacheKey = 'topics:featured';

        // Step 8: Check Redis RAM cache
        const cached = await getCache(cacheKey);
        if (cached) {
            // CACHE HIT → Return immediately (<1ms)
            return res.json(cached);
        }

        // Step 9: CACHE MISS → Find featured topic document in MongoDB
        const featured = await Topic.findOne({
            isFeatured: true,
            isActive: true,
        }).sort({ featuredAt: -1 });

        const responseData = { success: true, topic: featured };

        // Step 10: Save in Redis RAM with 1-Hour TTL (3600 seconds)
        // Featured topics update only once per day, making 1 hour a safe TTL
        await setCache(cacheKey, responseData, 3600);

        // Step 11: Return response
        res.json(responseData);

    } catch (error) {
        console.error('Get featured error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

export default router;
```

---

## 7. Master Summary Table: All Redis Code in MindClash

| File Path | Function / Route | Redis Command | Key Format | TTL | Purpose |
|---|---|---|---|---|---|
| [`server/config/redis.js`](file:///e:/Projects/Mindclash-main/server/config/redis.js) | `connectRedis()` | `new Redis(URL)` | — | — | Initializes connection to Redis Cloud |
| [`server/config/redis.js`](file:///e:/Projects/Mindclash-main/server/config/redis.js) | `getCache(key)` | `redis.get(key)` | Dynamic | — | Safe read helper (`JSON.parse`) |
| [`server/config/redis.js`](file:///e:/Projects/Mindclash-main/server/config/redis.js) | `setCache(key, val, ttl)` | `redis.set(k, v, 'EX', ttl)` | Dynamic | Custom | Safe write helper (`JSON.stringify`) |
| [`server/config/redis.js`](file:///e:/Projects/Mindclash-main/server/config/redis.js) | `delCache(key)` | `redis.del(key)` | Dynamic | — | Safe purge helper |
| [`server/index.js`](file:///e:/Projects/Mindclash-main/server/index.js) | Server boot | `connectRedis()` | — | — | Connects Redis during startup |
| [`server/routes/leaderboardRoutes.js`](file:///e:/Projects/Mindclash-main/server/routes/leaderboardRoutes.js) | `GET /api/leaderboard/global` | `getCache` / `setCache` | `leaderboard:global:{page}:{limit}` | 300s (5m) | Caches global user rankings |
| [`server/routes/leaderboardRoutes.js`](file:///e:/Projects/Mindclash-main/server/routes/leaderboardRoutes.js) | `GET /api/leaderboard/weekly` | `getCache` / `setCache` | `leaderboard:weekly` | 300s (5m) | Caches weekly active rankings |
| [`server/routes/topicRoutes.js`](file:///e:/Projects/Mindclash-main/server/routes/topicRoutes.js) | `GET /api/topics/trending` | `getCache` / `setCache` | `topics:trending` | 600s (10m) | Caches top 10 trending topics |
| [`server/routes/topicRoutes.js`](file:///e:/Projects/Mindclash-main/server/routes/topicRoutes.js) | `GET /api/topics/featured` | `getCache` / `setCache` | `topics:featured` | 3600s (1h) | Caches topic of the day |

---

## 8. Master Skeleton System Architecture Diagram

This diagram shows how React, Express, Node.js RAM, Redis, MongoDB, and WebSockets interact across all 4 system tiers:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   TIER 1: PRESENTATION LAYER (BROWSER)                                 │
│                                                                                                        │
│   React 18 SPA (Vercel CDN)                                                                            │
│   - AuthContext (JWT stored in localStorage)                                                           │
│   - React Router (/arena, /debate/:id, /leaderboard)                                                   │
│   - Axios (HTTP REST API Client)                                                                       │
│   - Socket.io Client (Real-time duplex connection)                                                     │
└───────────────────────────────────┬───────────────────────────────────┬────────────────────────────────┘
                                    │                                   │
                         HTTP REST  │                                   │ WebSocket (ws://)
                         (Port 5000)│                                   │ (Port 5000)
                                    ▼                                   ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  TIER 2: APPLICATION SERVER (RENDER)                                   │
│                                                                                                        │
│   Node.js + Express Server (server/index.js)                                                           │
│   ├── Global Middleware: express.json({limit:'10kb'}), cors(), helmet(), morgan()                     │
│   ├── REST Router Receptionist: /api/auth, /api/users, /api/leaderboard, /api/topics, etc.             │
│   ├── Route Middleware: protect (JWT validation), optionalAuth                                         │
│   └── Real-Time Hub (server/socket/index.js):                                                          │
│       ├── Handshake Auth: authenticateSocket                                                           │
│       └── In-Memory RAM Maps:                                                                          │
│           ├── matchmakingQueue   (Player pairing in nanoseconds)                                       │
│           ├── activeDebates      (Live debate state caching)                                           │
│           ├── userSockets        (userId -> socketId mapping)                                          │
│           └── pendingDisconnects (Reconnection grace period)                                           │
└───────────────────────────────────┬───────────────────────────────────┬────────────────────────────────┘
                                    │                                   │
                      getCache() /  │                                   │ Mongoose TCP
                      setCache()    │                                   │ Driver
                                    ▼                                   ▼
┌──────────────────────────────────────────────┐     ┌──────────────────────────────────────────────────┐
│          TIER 3: REDIS CLOUD (RAM)           │     │       TIER 4: MONGODB ATLAS (PRIMARY DB)         │
│                                              │     │                                                  │
│   In-Memory Key-Value Storage (<1ms)         │     │   Document Storage (NVMe SSD / Disk)             │
│   - leaderboard:global:1:50  (TTL: 300s)     │     │   - User Collection    (Auth, XP, Reputation)      │
│   - leaderboard:weekly       (TTL: 300s)     │     │   - Debate Collection  (Nested rounds & msgs)    │
│   - topics:trending          (TTL: 600s)     │     │   - Topic Collection   (Categories, difficulty)   │
│   - topics:featured          (TTL: 3600s)    │     │   - Community Collection                             │
└──────────────────────────────────────────────┘     └──────────────────────────────────────────────────┘
```

---

## 9. Interview Q&A Bank

**Q: Walk me through the exact line execution when a user requests `GET /api/leaderboard/global` for the first time vs the second time.**
> **First Request (Cache Miss):**
> 1. Line 16 constructs key `leaderboard:global:1:50`.
> 2. Line 19 calls `getCache()`, executing `redis.get('leaderboard:global:1:50')`.
> 3. Key does not exist in Redis, so `getCache()` returns `null`. `if (cachedData)` evaluates to `false`.
> 4. Lines 25-48 execute the heavy MongoDB `User.find()` query, sort documents, and format `responseData`.
> 5. Line 51 calls `setCache()`, stringifying `responseData` and writing it to Redis RAM with `TTL: 300s`.
> 6. Line 54 returns JSON to client (~150ms total).
>
> **Second Request (Cache Hit within 5 minutes):**
> 1. Line 16 constructs key `leaderboard:global:1:50`.
> 2. Line 19 calls `getCache()`, executing `redis.get('leaderboard:global:1:50')`.
> 3. Key exists in Redis RAM! `getCache()` returns the `JSON.parse()` object.
> 4. Line 20 `if (cachedData)` evaluates to `true`.
> 5. Line 21 returns `res.json(cachedData)` immediately.
> 6. Lines 24-54 are **never reached**. MongoDB is not queried. Response arrives in **<1ms**.

**Q: What happens if your Redis Cloud instance experiences an outage?**
> The application uses a Graceful Degradation pattern. All Redis helper functions wrap commands in `try/catch` blocks and check `if (!redis)`. If Redis is unconfigured or throws a network error, `getCache()` returns `null`, causing Express routes to fall through safely to MongoDB. Users experience normal database response times with zero crashes.

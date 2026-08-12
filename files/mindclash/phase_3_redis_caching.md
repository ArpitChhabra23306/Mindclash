# Phase 3: Redis — Fundamentals, Architecture & Complete Code Breakdown

> **Goal:** After reading this, you will be able to explain every single line of Redis code in MindClash, trace the exact flow of data through memory and disk, defend the trade-offs in system design interviews, and understand the master skeleton architecture from browser to server to Redis to MongoDB.

---

## 1. The Big Picture: All Files & Endpoints Using Redis

Redis operations in MindClash are centralized in a configuration module and consumed by two public REST route controllers:

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
Redis stands for **Re**mote **Di**ctionary **S**erver. It is an open-source, in-memory data structure store used as a database, cache, message broker, and streaming engine.

Unlike traditional databases (like MongoDB or PostgreSQL) that store data on **magnetic/SSD hard drives**, Redis stores **100% of its data directly in RAM (Random Access Memory)**.

### 2.2 Memory & Hardware Speed Hierarchy

To understand why Redis is so fast, we must look at physical computer hardware:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       HARDWARE ACCESS SPEED HIERARCHY                       │
│                                                                             │
│  Node.js RAM (Process Memory): 🧠 CPU Cache / Server RAM                    │
│                                   Latency: <0.001ms (Nanoseconds)           │
│                                   Scope: Single process, local to server    │
│                                                                             │
│  Redis Cloud (RAM Database):   ⚡ Dedicated RAM Chips                       │
│                                   Latency: <1ms (Microseconds)              │
│                                   Scope: Shared across all server nodes     │
│                                                                             │
│  MongoDB Atlas (Primary DB):   📀 Solid State Disk (SSD / NVMe)            │
│                                   Latency: 50ms – 200ms (Milliseconds)      │
│                                   Scope: Permanent disk storage             │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Layer | Physical Medium | Read Latency | Survives Server Restart? | Shared Across Multiple Servers? |
|---|---|---|---|---|
| **Node.js `Map`** | Server Process RAM | `<0.001ms` | ❌ No (Wiped on restart) | ❌ No (Isolated to 1 Node process) |
| **Redis** | Server RAM Chips | `<1ms` | ⚠️ Optional (Persistence available) | ✅ **Yes** (Centralized cache) |
| **MongoDB** | NVMe SSD / Disk | `50ms – 200ms` | ✅ **Yes** (Permanent storage) | ✅ **Yes** (Primary Database) |

---

## 3. Demystifying Locations: Client PC vs Node.js vs Redis Cloud

A critical architectural distinction to understand for interviews:

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
2. **Node.js RAM (Express Server):** Holds local variables, JavaScript `Map` objects (`matchmakingQueue`, `activeDebates`). Access is instantaneous (<0.001ms), but data is lost if the Node process restarts, and data cannot be shared if you spin up Server 2.
3. **Redis Server (Cloud / Infrastructure):** Runs as a independent backend server process. It is **shared across all backend servers and accessible to all users**, while operating at near-RAM speed (<1ms).

---

## 4. Understanding `REDIS_URL`

`REDIS_URL` is the connection string (URI) that tells `ioredis` how to connect to the Redis server over TCP.

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

In MindClash, `process.env.REDIS_URL` is stored inside `server/.env` and excluded from Git via `.gitignore` to prevent credential leaks.

---

## 5. Top 5 Real-World Features of Redis in Production

Redis is not just a cache. It supports 5 major architectural patterns in modern systems:

### 1️⃣ Response Caching (Implemented in MindClash)
Caches expensive DB queries (like global leaderboards) in Redis RAM with a TTL (Time-To-Live). Cuts database read load by ~80%.

### 2️⃣ API Rate Limiting (Spam & Brute-Force Protection)
Tracks request counts per IP within a sliding time window using Redis atomic counters (`INCR` + `EXPIRE`). If IP `192.168.1.1` sends >5 requests to `/api/auth/login` within 60 seconds, HTTP 429 is returned.

### 3️⃣ Session Management (Session Store)
In traditional session-based auth (non-JWT), session cookies store a session ID on the client, and the actual session object `{ userId, role }` is stored in Redis. Any backend node can verify the session instantly.

### 4️⃣ Real-Time Scoreboards via Sorted Sets (`ZADD` / `ZREVRANGE`)
Redis has native data structures like **Sorted Sets**. Scores are automatically kept sorted in O(log N) logarithmic time:
```bash
ZADD leaderboard 1500 "arpit"
ZADD leaderboard 1200 "rahul"
ZREVRANGE leaderboard 0 9 WITHSCORES  # Returns top 10 ranked debaters instantly
```

### 5️⃣ Cross-Server Real-Time Event Syncing (Redis Pub/Sub)
When scaling Socket.io horizontally to 2+ backend server nodes behind a load balancer, Socket.io uses Redis Pub/Sub (`@socket.io/redis-adapter`) to fan out room messages to all server instances.

---

## 6. Complete Codebase Walkthrough: Every Line Explained

Let's dissect every line of Redis code in the MindClash codebase.

---

### 6.1 `server/config/redis.js` — Connection & Core Helpers

This file initializes the `ioredis` instance and exports 3 safe wrapper functions.

```javascript
 1: import Redis from 'ioredis';
 2: 
 3: let redis = null;
 4: 
 5: const connectRedis = () => {
 6:     try {
 7:         if (process.env.REDIS_URL) {
 8:             redis = new Redis(process.env.REDIS_URL, {
 9:                 maxRetriesPerRequest: 3,
10:                 retryDelayOnFailover: 100,
11:                 lazyConnect: true,
12:             });
13: 
14:             redis.on('connect', () => {
15:                 console.log('✅ Redis Connected');
16:             });
17: 
18:             redis.on('error', (err) => {
19:                 console.error('❌ Redis Error:', err.message);
20:             });
21: 
22:             redis.connect().catch(console.error);
23:         } else {
24:             console.log('⚠️ Redis URL not configured, using in-memory fallback');
25:         }
26:     } catch (error) {
27:         console.error('❌ Redis Connection Error:', error.message);
28:     }
29: 
30:     return redis;
31: };
```

#### Line-by-Line Breakdown (Connection):
* **Line 1:** Imports `Redis` from `ioredis`. `ioredis` is the full-featured, performance-focused Node.js client supporting promises, cluster mode, and automatic reconnection.
* **Line 3:** `let redis = null;` — Module-scoped variable. Initialized as `null`. If `REDIS_URL` is omitted from `.env`, it remains `null`, enabling seamless fallback.
* **Line 5-7:** `connectRedis()` checks `if (process.env.REDIS_URL)` before attempting initialization.
* **Line 8-12:** Instantiates `new Redis(...)` with configuration options:
  * `maxRetriesPerRequest: 3`: If a command stalls due to network hiccup, it retries 3 times before rejecting the promise.
  * `retryDelayOnFailover: 100`: Waits 100ms between failover retries.
  * `lazyConnect: true`: Defers establishing the TCP connection until `.connect()` is called explicitly on line 22. This prevents unhandled startup exceptions if the Redis host is temporarily unreachable.
* **Line 14-20:** Sets up event handlers (`connect` and `error`) to print operational status to the terminal.
* **Line 22:** Calls `redis.connect()` asynchronously. `.catch(console.error)` handles connection failures gracefully without crashing Node.js.
* **Line 24:** Logs `⚠️ Redis URL not configured...` if `REDIS_URL` is absent, confirming graceful fallback mode is active.

---

### 6.2 Helper 1: `getCache(key)` — Safe Read

```javascript
36: export const getCache = async (key) => {
37:     if (!redis) return null;
38:     try {
39:         const data = await redis.get(key);
40:         return data ? JSON.parse(data) : null;
41:     } catch (err) {
42:         console.error('Redis getCache error:', err.message);
43:         return null;
44:     }
45: };
```

#### Line-by-Line Breakdown:
* **Line 37:** `if (!redis) return null;` — **Safety Guard 1:** If Redis was never connected, immediately returns `null`. The route controller sees `null` (cache miss) and fetches from MongoDB normally.
* **Line 39:** `const data = await redis.get(key);` — Issues the Redis `GET` command over TCP. Redis searches its RAM hash table for `key`. Returns raw string if found, `null` if missing or expired.
* **Line 40:** `return data ? JSON.parse(data) : null;` — Redis only stores strings/binary. `JSON.parse(data)` deserializes the string back into a JavaScript object (`{ success: true, leaderboard: [...] }`).
* **Line 41-44:** **Safety Guard 2:** If Redis throws a network timeout or connection error, `catch` logs the error and returns `null`. **The user request never fails.**

---

### 6.3 Helper 2: `setCache(key, value, ttlSeconds)` — Safe Write with TTL

```javascript
50: export const setCache = async (key, value, ttlSeconds = 300) => {
51:     if (!redis) return;
52:     try {
53:         await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
54:     } catch (err) {
55:         console.error('Redis setCache error:', err.message);
56:     }
57: };
```

#### Line-by-Line Breakdown:
* **Line 51:** `if (!redis) return;` — Guard clause. If Redis is disabled, silently exits.
* **Line 53:** `await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);`
  * `JSON.stringify(value)`: Converts the JavaScript response object into a string for storage.
  * `'EX'`: Tells Redis to set an explicit **EXpiration time** in seconds.
  * `ttlSeconds`: The Time-To-Live duration (defaults to 300 seconds = 5 minutes). After 300 seconds, Redis automatically purges the key from RAM.
* **Line 54-56:** Wraps write in `try/catch` so a Redis write failure never prevents the HTTP response from reaching the client.

---

### 6.4 Helper 3: `delCache(key)` — Safe Cache Invalidation

```javascript
62: export const delCache = async (key) => {
63:     if (!redis) return;
64:     try {
65:         await redis.del(key);
66:     } catch (err) {
67:         console.error('Redis delCache error:', err.message);
68:     }
69: };
```

#### Line-by-Line Breakdown:
* **Line 65:** Executes `redis.del(key)`. Removes the key from Redis RAM immediately. Used when underlying MongoDB data is updated and the cache must be purged ahead of TTL expiration.

---

### 6.5 `server/index.js` — Boot Hook

```javascript
14: import { connectRedis } from './config/redis.js';
...
56: connectRedis();
```

* **Line 14:** Imports `connectRedis`.
* **Line 56:** Calls `connectRedis()` during main Express boot, connecting to Redis in parallel with MongoDB (`connectDB()`).

---

### 6.6 `server/routes/leaderboardRoutes.js` — Global & Weekly Leaderboard

```javascript
 1: import express from 'express';
 2: import User from '../models/User.js';
 3: import { getCache, setCache } from '../config/redis.js';
 4: 
 5: const router = express.Router();
 6: 
 7: /**
 8:  * @route   GET /api/leaderboard/global
 9:  * @desc    Get global leaderboard
10:  * @access  Public
11:  */
12: router.get('/global', async (req, res) => {
13:     try {
14:         const page = parseInt(req.query.page) || 1;
15:         const limit = parseInt(req.query.limit) || 50;
16:         const cacheKey = `leaderboard:global:${page}:${limit}`;
17: 
18:         // Step 1: Check Redis cache first
19:         const cachedData = await getCache(cacheKey);
20:         if (cachedData) {
21:             return res.json(cachedData);
22:         }
23: 
24:         // Step 2: Cache miss → Query MongoDB
25:         const skip = (page - 1) * limit;
26:         const users = await User.find({ totalDebates: { $gt: 0 } })
27:             .sort({ reputation: -1, wins: -1 })
28:             .skip(skip)
29:             .limit(limit)
30:             .select('username displayName avatar frame tier level reputation xp wins losses totalDebates bestStreak');
31: 
32:         const total = await User.countDocuments({ totalDebates: { $gt: 0 } });
33: 
34:         const rankedUsers = users.map((user, index) => ({
35:             rank: skip + index + 1,
36:             ...user.toObject(),
37:             winRate: user.totalDebates > 0 ? Math.round((user.wins / user.totalDebates) * 100) : 0,
38:         }));
39: 
40:         const responseData = {
41:             success: true,
42:             leaderboard: rankedUsers,
43:             pagination: {
44:                 currentPage: page,
45:                 totalPages: Math.ceil(total / limit),
46:                 totalUsers: total,
47:             },
48:         };
49: 
50:         // Step 3: Save to Redis for 5 minutes (300 seconds)
51:         await setCache(cacheKey, responseData, 300);
52: 
53:         // Step 4: Return response
54:         res.json(responseData);
55:     } catch (error) {
56:         console.error('Get leaderboard error:', error);
57:         res.status(500).json({ success: false, message: 'Server error' });
58:     }
59: });
```

#### Line-by-Line Walkthrough (`/global`):
* **Line 14-15:** Extracts pagination arguments from `req.query`, defaulting to page 1, 50 items per page.
* **Line 16:** Constructs dynamic key `leaderboard:global:1:50`. Namespacing keys with colons (`entity:aspect:id`) is a Redis best practice.
* **Line 19:** `await getCache(cacheKey)` checks Redis RAM.
* **Line 20-22:** **Cache Hit Branch:** If `cachedData` is not null, `res.json(cachedData)` sends the response immediately. Lines 24-52 **never execute**. Response time is **<1ms**.
* **Line 24-48:** **Cache Miss Branch:** Executes MongoDB `User.find()`, sorts by reputation, counts documents, and formats `responseData`.
* **Line 51:** `await setCache(cacheKey, responseData, 300);` — Caches the structured response object in Redis RAM for 300 seconds (5 minutes).
* **Line 54:** Sends fresh response to client.

---

### 6.7 `server/routes/topicRoutes.js` — Trending & Featured Topics

```javascript
41: router.get('/trending', async (req, res) => {
42:     try {
43:         const cacheKey = 'topics:trending';
44:         const cached = await getCache(cacheKey);
45:         if (cached) return res.json(cached);
46: 
47:         const topics = await Topic.getTrending(10);
48:         const responseData = { success: true, topics };
49: 
50:         // Cache for 10 minutes (600s)
51:         await setCache(cacheKey, responseData, 600);
52: 
53:         res.json(responseData);
54:     } catch (error) { ... }
55: });
```

```javascript
65: router.get('/featured', async (req, res) => {
66:     try {
67:         const cacheKey = 'topics:featured';
68:         const cached = await getCache(cacheKey);
69:         if (cached) return res.json(cached);
70: 
71:         const featured = await Topic.findOne({ isFeatured: true, isActive: true }).sort({ featuredAt: -1 });
72:         const responseData = { success: true, topic: featured };
73: 
74:         // Cache for 1 hour (3600s)
75:         await setCache(cacheKey, responseData, 3600);
76: 
77:         res.json(responseData);
78:     } catch (error) { ... }
79: });
```

#### Walkthrough (`/trending` & `/featured`):
* `GET /api/topics/trending`: Uses key `topics:trending` with a **600-second (10-minute) TTL**.
* `GET /api/topics/featured`: Uses key `topics:featured` with a **3600-second (1-hour) TTL** since the featured topic of the day is updated only once every 24 hours.

---

## 7. Graceful Degradation & Resilience Architecture

Every Redis operation is designed so that a database/network error in Redis **never breaks the user experience**:

```
                  ┌───────────────────────────────┐
                  │   Incoming HTTP GET Request   │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │    getCache(key) Execution    │
                  └───────────────┬───────────────┘
                                  │
                 ┌────────────────┴────────────────┐
                 │                                 │
                 ▼                                 ▼
      [ Redis Is Healthy ]               [ Redis Is Down / Error ]
                 │                                 │
        ┌────────┴────────┐                        │
        ▼                 ▼                        │
    Cache HIT        Cache MISS                    │
        │                 │                        │
        │                 └──────────────┐         │
        ▼                                ▼         ▼
Return JSON (<1ms)             Execute MongoDB Query (50-200ms)
                                                 │
                                                 ▼
                                     Return JSON to Client
```

---

## 8. Master Skeleton System Architecture Diagram

This end-to-end skeleton diagram illustrates how React, Express, Node.js Memory, Redis, MongoDB, and WebSockets interact across the entire application:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   TIER 1: PRESENTATION LAYER (BROWSER)                                 │
│                                                                                                        │
│   React 18 SPA (Vercel CDN)                                                                            │
│   - AuthContext (JWT in localStorage)                                                                  │
│   - React Router (/arena, /debate/:id, /leaderboard)                                                   │
│   - Axios (REST API calls)                                                                             │
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
> **First Request (Cache Miss):** Line 16 constructs key `leaderboard:global:1:50`. Line 19 calls `getCache()`, executing `redis.get()`. Key does not exist, so `getCache()` returns `null`. `if (cachedData)` evaluates to `false`. Lines 25-49 execute MongoDB `User.find()`, sort documents, and format `responseData`. Line 52 calls `setCache()`, stringifying `responseData` and writing it to Redis RAM with `TTL: 300s`. Line 54 returns JSON to client (~150ms total).
>
> **Second Request (Cache Hit):** Line 16 constructs key `leaderboard:global:1:50`. Line 19 calls `getCache()`. Key exists in Redis RAM! `getCache()` returns the `JSON.parse()` object. Line 20 `if (cachedData)` evaluates to `true`. Line 21 returns `res.json(cachedData)` immediately. Lines 24-54 are **never reached**. MongoDB is not queried. Response arrives in **<1ms**.

**Q: Why use an in-memory Node.js RAM `Map` for matchmaking instead of Redis Queues?**
> Node.js process RAM access takes nanoseconds (<0.001ms) with zero network overhead. Since MindClash currently runs on a single server instance, process memory is strictly faster. Redis queues or Pub/Sub become relevant when scaling across multiple backend nodes.

**Q: What happens if your Redis Cloud instance experiences an outage?**
> The application uses a Graceful Degradation pattern. All Redis helper functions wrap commands in `try/catch` blocks and check `if (!redis)`. If Redis is unconfigured or throws a network error, `getCache()` returns `null`, causing Express routes to fall through safely to MongoDB. Users experience normal database response times with zero crashes.

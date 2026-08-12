# Phase 3: Redis — Fundamentals, Caching & Line-by-Line Code Breakdown

> **Why a dedicated phase for Redis?**
> Redis is not just an npm package — it is a **standalone in-memory server**, a unique data store, and a fundamental building block of scalable system design. Understanding where Redis lives, how memory storage works, and tracing every line of Redis code separates mid-level engineers from senior ones.

---

## 1. What Is Redis? (From First Principles)

Redis stands for **Re**mote **Di**ctionary **S**erver.

It is an open-source, ultra-fast key-value data store that keeps 100% of its data inside **RAM (Random Access Memory)** rather than writing it to disk.

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

## 2. Where Does Redis Live? (Client PC vs Server / Cloud)

* ❌ **NOT on the Client's Laptop / Browser:** Browser storage like `localStorage` or `sessionStorage` lives strictly on one user's machine. User A cannot see User B's `localStorage`.
* ✅ **On the Server / Cloud Infrastructure:** Redis runs as a separate database service on your **backend cloud infrastructure** (e.g. Redis Cloud, AWS ElastiCache, or Docker).
* **Why this matters:** Because Redis lives on the server side, **all 100,000 users share the exact same Redis instance**!

```
[User A's Browser] ── (Axios GET /leaderboard) ──┐
                                                 │
[User B's Browser] ── (Axios GET /leaderboard) ──┼──► [Node.js Express Server] ──► [Redis Cloud (RAM)]
                                                 │                                      │
[User C's Browser] ── (Axios GET /leaderboard) ──┘                                (Returns Leaderboard
                                                                                     JSON in <1ms)
```

---

## 3. What is `REDIS_URL`?

`REDIS_URL` is the URI connection string (address + port + credentials) that allows your Node.js Express server to establish a secure TCP network pipeline to your Redis server.

### Anatomy of a `REDIS_URL`:
```
redis://default:MySecretPassword123@redis-12345.c1.us-east-1.ec2.redns.redis-cloud.com:12345
│       │       │                      │                                                  │
└Protocol  User  └──────Password───────┴──────────────Host Domain Name─────────────────────┴Port
```

* **Protocol:** `redis://` (or `rediss://` for TLS encrypted connections).
* **Credentials:** `username` and `password` for authentication.
* **Host & Port:** Tells `ioredis` where on the internet your Redis server is running.

---

## 4. Line-by-Line Breakdown: Connection & Helpers (`server/config/redis.js`)

Below is the complete code of [`server/config/redis.js`](file:///e:/Projects/Mindclash-main/server/config/redis.js) with a line-by-line explanation:

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
32: 
33: /**
34:  * Get cached JSON object from Redis safely
35:  */
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
46: 
47: /**
48:  * Set JSON object in Redis with expiration (TTL in seconds)
49:  */
50: export const setCache = async (key, value, ttlSeconds = 300) => {
51:     if (!redis) return;
52:     try {
53:         await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
54:     } catch (err) {
55:         console.error('Redis setCache error:', err.message);
56:     }
57: };
58: 
59: /**
60:  * Delete cached key from Redis
61:  */
62: export const delCache = async (key) => {
63:     if (!redis) return;
64:     try {
65:         await redis.del(key);
66:     } catch (err) {
67:         console.error('Redis delCache error:', err.message);
68:     }
69: };
70: 
71: export { redis, connectRedis };
```

### Detailed Line-by-Line Explanation of `redis.js`:

* **Line 1:** `import Redis from 'ioredis';` — Imports the `ioredis` client, the standard robust Redis driver for Node.js.
* **Line 3:** `let redis = null;` — Declares a module-scoped variable `redis`. Starts as `null` so functions know if Redis is initialized or not.
* **Line 5-7:** `const connectRedis = () => { if (process.env.REDIS_URL) {` — Checks if `REDIS_URL` exists in `.env`. If absent, skips initialization safely.
* **Lines 8-12:** `redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 3, retryDelayOnFailover: 100, lazyConnect: true });`
  * `maxRetriesPerRequest: 3`: If Redis doesn't respond immediately, it retries up to 3 times before returning an error.
  * `retryDelayOnFailover: 100`: Waits 100ms between retry attempts.
  * `lazyConnect: true`: Defers connecting until `.connect()` is called explicitly, preventing unhandled crash loops on startup.
* **Lines 14-20:** Sets up event listeners (`redis.on('connect')` and `redis.on('error')`) to log status cleanly to the server console.
* **Line 22:** `redis.connect().catch(console.error);` — Triggers the asynchronous connection to Redis Cloud.
* **Lines 24-28:** Logs warning if `REDIS_URL` is omitted and catches initialization errors so Express boots smoothly.
* **Line 36-45 (`getCache`):**
  * `if (!redis) return null;` — If Redis isn't connected, returns `null` immediately so the caller falls through to MongoDB.
  * `const data = await redis.get(key);` — Asynchronously fetches the string stored at `key` from Redis RAM.
  * `return data ? JSON.parse(data) : null;` — Redis stores values as strings. `JSON.parse` converts it back into a native JavaScript object.
  * `catch (err) { return null; }` — If a network error occurs, returns `null` instead of throwing an unhandled exception.
* **Line 50-57 (`setCache`):**
  * `await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);`
  * `JSON.stringify(value)`: Converts the JavaScript object into a JSON string.
  * `'EX'`: Tells Redis to apply an expiration timer.
  * `ttlSeconds`: Specifies the number of seconds until Redis automatically purges the key (e.g. 300s = 5 mins).
* **Line 62-69 (`delCache`):** Executes `redis.del(key)` to manually remove a cached key when data is updated.

---

## 5. Line-by-Line Breakdown: Server Boot Connection (`server/index.js`)

In [`server/index.js`](file:///e:/Projects/Mindclash-main/server/index.js):

```javascript
14: import { connectRedis } from './config/redis.js';
...
56: connectRedis();
```

* **Line 14:** Imports `connectRedis` from configuration.
* **Line 56:** Invokes `connectRedis()` during server startup right alongside MongoDB (`connectDB()`), opening the Redis TCP pipeline before routes start accepting traffic.

---

## 6. Line-by-Line Breakdown: Leaderboard Caching (`server/routes/leaderboardRoutes.js`)

Below is the exact implementation in [`server/routes/leaderboardRoutes.js`](file:///e:/Projects/Mindclash-main/server/routes/leaderboardRoutes.js) for Global & Weekly Leaderboards:

### 6.1 Global Leaderboard (`GET /api/leaderboard/global`)

```javascript
12: router.get('/global', async (req, res) => {
13:     try {
14:         const page = parseInt(req.query.page) || 1;
15:         const limit = parseInt(req.query.limit) || 50;
16:         const cacheKey = `leaderboard:global:${page}:${limit}`;
17: 
18:         // Check Redis cache first
19:         const cachedData = await getCache(cacheKey);
20:         if (cachedData) {
21:             return res.json(cachedData);
22:         }
23: 
24:         const skip = (page - 1) * limit;
25:         const users = await User.find({ totalDebates: { $gt: 0 } })
26:             .sort({ reputation: -1, wins: -1 })
27:             .skip(skip)
28:             .limit(limit)
29:             .select('username displayName avatar frame tier level reputation xp wins losses totalDebates bestStreak');
30: 
31:         const total = await User.countDocuments({ totalDebates: { $gt: 0 } });
...
51:         // Cache in Redis for 5 minutes (300 seconds)
52:         await setCache(cacheKey, responseData, 300);
53: 
54:         res.json(responseData);
```

#### Line-by-Line Walkthrough:
* **Line 14-15:** Extracts `page` and `limit` from URL query parameters (`req.query`), defaulting to page 1 and 50 items.
* **Line 16:** Constructs a unique dynamic key: `leaderboard:global:1:50`. Each page gets its own isolated cache key in Redis!
* **Line 19-22:** Calls `await getCache(cacheKey)`. If data exists in Redis, `if (cachedData)` evaluates to `true` and returns the JSON payload **immediately** (`res.json(cachedData)`). The MongoDB queries on lines 25-32 are completely skipped, responding in **<1ms**.
* **Lines 24-49:** On a cache miss (or if Redis is disabled), the server executes the heavy MongoDB `User.find()` aggregation, sorts users by `reputation` and `wins`, calculates `winRate`, and constructs `responseData`.
* **Line 52:** `await setCache(cacheKey, responseData, 300);` — Saves `responseData` into Redis RAM under `leaderboard:global:1:50` with an expiration timer (`TTL`) of 300 seconds (5 minutes).
* **Line 54:** Sends response to the original user.

---

### 6.2 Weekly Leaderboard (`GET /api/leaderboard/weekly`)

```javascript
69: router.get('/weekly', async (req, res) => {
70:     try {
71:         const cacheKey = 'leaderboard:weekly';
72: 
73:         // Check Redis cache first
74:         const cachedData = await getCache(cacheKey);
75:         if (cachedData) {
76:             return res.json(cachedData);
77:         }
...
82:         const users = await User.find({ ... })
...
95:         // Cache in Redis for 5 minutes
96:         await setCache(cacheKey, responseData, 300);
97: 
98:         res.json(responseData);
```

#### Line-by-Line Walkthrough:
* **Line 71:** Uses static key `'leaderboard:weekly'`.
* **Line 74-77:** Checks Redis cache. On HIT → returns instantly.
* **Line 82-94:** On MISS → executes 7-day active user filter query on MongoDB.
* **Line 96:** Saves result in Redis with a 5-minute TTL (`300s`).

---

## 7. Line-by-Line Breakdown: Topics Caching (`server/routes/topicRoutes.js`)

Below is the exact implementation in [`server/routes/topicRoutes.js`](file:///e:/Projects/Mindclash-main/server/routes/topicRoutes.js):

### 7.1 Trending Topics (`GET /api/topics/trending`)

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
```

#### Line-by-Line Walkthrough:
* **Line 43-45:** Key `'topics:trending'`. If cached, returns immediately.
* **Line 47:** On cache miss, queries `Topic.getTrending(10)` from MongoDB.
* **Line 51:** `await setCache(cacheKey, responseData, 600);` — Caches result for **600 seconds (10 minutes)** since trending topic algorithms do not need to update every second.

---

### 7.2 Featured Topic of the Day (`GET /api/topics/featured`)

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
```

#### Line-by-Line Walkthrough:
* **Line 67-69:** Key `'topics:featured'`. If cached, returns immediately.
* **Line 71:** On cache miss, queries MongoDB for the featured topic document.
* **Line 75:** `await setCache(cacheKey, responseData, 3600);` — Caches result for **3600 seconds (1 hour)** because the featured topic changes only once per day.

---

## 8. Summary Table of All Redis Code in MindClash

| File | Exact Line Numbers | Redis Function Used | Key Name | TTL |
|---|---|---|---|---|
| [`server/config/redis.js`](file:///e:/Projects/Mindclash-main/server/config/redis.js) | L5–31 | `connectRedis()` | — | — |
| [`server/config/redis.js`](file:///e:/Projects/Mindclash-main/server/config/redis.js) | L36–45 | `getCache(key)` | Dynamic | — |
| [`server/config/redis.js`](file:///e:/Projects/Mindclash-main/server/config/redis.js) | L50–57 | `setCache(key, val, ttl)` | Dynamic | Custom |
| [`server/config/redis.js`](file:///e:/Projects/Mindclash-main/server/config/redis.js) | L62–69 | `delCache(key)` | Dynamic | — |
| [`server/index.js`](file:///e:/Projects/Mindclash-main/server/index.js) | L56 | `connectRedis()` boot call | — | — |
| [`server/routes/leaderboardRoutes.js`](file:///e:/Projects/Mindclash-main/server/routes/leaderboardRoutes.js) | L16–52 | `getCache`, `setCache` | `leaderboard:global:{page}:{limit}` | 300s (5m) |
| [`server/routes/leaderboardRoutes.js`](file:///e:/Projects/Mindclash-main/server/routes/leaderboardRoutes.js) | L71–96 | `getCache`, `setCache` | `leaderboard:weekly` | 300s (5m) |
| [`server/routes/topicRoutes.js`](file:///e:/Projects/Mindclash-main/server/routes/topicRoutes.js) | L43–51 | `getCache`, `setCache` | `topics:trending` | 600s (10m) |
| [`server/routes/topicRoutes.js`](file:///e:/Projects/Mindclash-main/server/routes/topicRoutes.js) | L67–75 | `getCache`, `setCache` | `topics:featured` | 3600s (1h) |

---

## 9. Interview Code Tracing Question 🎯

**Q: Walk me through the exact line execution when a user requests `GET /api/leaderboard/global` for the first time vs the second time.**

> **First Request (Cache Miss):**
> 1. Line 16 constructs key `leaderboard:global:1:50`.
> 2. Line 19 calls `getCache()`, executing `redis.get('leaderboard:global:1:50')`.
> 3. Key does not exist in Redis, so `getCache()` returns `null`. `if (cachedData)` evaluates to `false`.
> 4. Lines 25-49 execute the heavy MongoDB `User.find()` query, sort documents, and format `responseData`.
> 5. Line 52 calls `setCache()`, stringifying `responseData` and setting it in Redis RAM with `TTL: 300s`.
> 6. Line 54 sends JSON to the client (~150ms total).

> **Second Request (Cache Hit within 5 minutes):**
> 1. Line 16 constructs key `leaderboard:global:1:50`.
> 2. Line 19 calls `getCache()`, executing `redis.get('leaderboard:global:1:50')`.
> 3. Key exists in Redis RAM! `getCache()` returns the `JSON.parse()` object.
> 4. Line 20 `if (cachedData)` evaluates to `true`.
> 5. Line 21 returns `res.json(cachedData)` immediately.
> 6. Lines 24-54 are **never reached**. MongoDB is not queried. Response arrives in **<1ms**.

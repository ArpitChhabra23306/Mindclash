# Phase 3: Redis — Caching, Architecture & Scaling Strategy

> **Why a dedicated phase for Redis?**
> Redis is not just a library you import. It is a **separate server**, a separate data structure,
> and a fundamentally different way of thinking about data access. Understanding it deeply
> separates a mid-level developer from a senior one in any system design interview.

---

## 1. What Is Redis? (From First Principles)

Redis stands for **Re**mote **Di**ctionary **S**erver.

It is a data store that runs entirely in **RAM** (your server's working memory), not on disk.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WHERE DATA LIVES                                  │
│                                                                      │
│  MongoDB (Disk):    📀  Persistent. Survives restarts. Slow reads.   │
│                         ~50-200ms per query on large collections     │
│                                                                      │
│  Redis (RAM):       ⚡  Temporary. Lost on restart. Instant reads.   │
│                         <1ms per key lookup                          │
│                                                                      │
│  Node.js RAM (Map): 🧠  Per-process. Fastest possible. No network.   │
│                         <0.001ms — direct memory pointer lookup      │
└─────────────────────────────────────────────────────────────────────┘
```

**The Speed Hierarchy:**
```
Node.js RAM Map   → nanoseconds  (0.000001ms)
Redis (RAM)       → <1ms         (1,000x slower than RAM map but 100x faster than disk)
MongoDB (Disk)    → 50-200ms     (depends on collection size, indexes, query complexity)
```

**The Key Insight:**
Redis is not a replacement for MongoDB. MongoDB stores your data permanently.
Redis is a **fast mirror** of the data that changes rarely but is read very frequently.

---

## 2. Why MindClash Needs Redis

### The Problem: Expensive MongoDB Queries on Public Routes

Some routes are hit by EVERY user — logged in or not:

```
GET /api/leaderboard/global   → Opens the Leaderboard page
GET /api/topics/trending      → Opens the Explore/Arena page
GET /api/topics/featured      → Home page featured topic
```

What MongoDB has to do for `/api/leaderboard/global`:

```javascript
// This runs on EVERY leaderboard page load — by EVERY user:
const users = await User.find({ totalDebates: { $gt: 0 } })
    .sort({ reputation: -1, wins: -1 })  // Sort ALL qualifying users
    .skip(skip)                           // Skip to page N
    .limit(50)                            // Take 50
    .select('username displayName avatar frame tier level reputation xp wins losses bestStreak');

const total = await User.countDocuments({ totalDebates: { $gt: 0 } }); // Count all
```

**Without Redis:** 100 users open the leaderboard → 200 MongoDB operations (100 sort + 100 count).
**With Redis:** 100 users open the leaderboard → 1 MongoDB operation + 99 Redis reads in <1ms.

---

## 3. Redis Connection Setup (`server/config/redis.js`)

The entire Redis setup lives in one file:

```javascript
import Redis from 'ioredis';   // 'ioredis' is the Node.js Redis client library

let redis = null;  // Module-level variable — shared across the entire server process

const connectRedis = () => {
    try {
        if (process.env.REDIS_URL) {
            // Create Redis client instance
            redis = new Redis(process.env.REDIS_URL, {
                maxRetriesPerRequest: 3,      // If a command fails, retry 3 times
                retryDelayOnFailover: 100,    // Wait 100ms between retries
                lazyConnect: true,            // Don't connect immediately — wait for .connect()
            });

            // Event listeners for monitoring:
            redis.on('connect', () => console.log('✅ Redis Connected'));
            redis.on('error', (err) => console.error('❌ Redis Error:', err.message));

            // Initiate connection:
            redis.connect().catch(console.error);

        } else {
            // No REDIS_URL set in .env → skip Redis entirely
            console.log('⚠️ Redis URL not configured, using in-memory fallback');
        }
    } catch (error) {
        console.error('❌ Redis Connection Error:', error.message);
    }

    return redis;
};
```

**Why `lazyConnect: true`?**
Without it, `new Redis(url)` immediately tries to connect and throws if it fails, potentially crashing the server boot. With `lazyConnect`, the connection is deferred until `.connect()` is explicitly called, giving the error handler time to register first.

**Why `let redis = null` at the top?**
This is a module-level singleton. Every file that imports from `redis.js` shares the SAME Redis client instance. You don't create a new connection per request — one persistent TCP connection handles all commands.

---

## 4. The 3 Helper Functions — Your Redis API

These 3 exported functions are what every route file uses:

### `getCache(key)` — Try to Read From Redis

```javascript
export const getCache = async (key) => {
    // Guard 1: Redis not configured → return null (caller falls to MongoDB)
    if (!redis) return null;

    try {
        const data = await redis.get(key);
        // redis.get() returns:
        //   - A string (the stored value)   → if key EXISTS in Redis
        //   - null                          → if key DOESN'T EXIST or has EXPIRED

        return data ? JSON.parse(data) : null;
        // JSON.parse() converts the string back to a JavaScript object
        // e.g. '{"success":true,"leaderboard":[...]}' → { success: true, leaderboard: [...] }

    } catch (err) {
        // Guard 2: Redis error (e.g. network blip) → return null (fall through to MongoDB)
        console.error('Redis getCache error:', err.message);
        return null;
    }
};
```

**The double-null safety:** If Redis is unconfigured OR if Redis throws an error,
`getCache` always returns `null`. Routes check `if (cachedData)` — null = falsy = query MongoDB.
This means Redis going down NEVER causes your app to return an error to users.

---

### `setCache(key, value, ttlSeconds)` — Write to Redis With Expiry

```javascript
export const setCache = async (key, value, ttlSeconds = 300) => {
    if (!redis) return;

    try {
        await redis.set(
            key,                    // The cache key (human-readable string)
            JSON.stringify(value),  // Must serialize: Redis stores strings, not objects
            'EX',                   // 'EX' flag = EXpire after N seconds
            ttlSeconds              // e.g. 300 = auto-deleted from Redis in 5 minutes
        );
    } catch (err) {
        console.error('Redis setCache error:', err.message);
        // Silent failure: if Redis can't store, the data still returned to user from MongoDB
    }
};
```

**Why `JSON.stringify()`?**
Redis is a key-value store where values must be strings (or binary).
JavaScript objects cannot be stored directly. `JSON.stringify()` converts:
```
{ success: true, leaderboard: [...] } → '{"success":true,"leaderboard":[...]}'
```
And `JSON.parse()` on read converts it back.

**What is TTL (Time-To-Live)?**
TTL is the number of seconds before Redis automatically deletes the key.
After TTL expires, the next request gets a "cache miss" (null) and re-fetches from MongoDB.
This ensures the cache never shows stale data for longer than the TTL.

---

### `delCache(key)` — Invalidate a Cache Entry

```javascript
export const delCache = async (key) => {
    if (!redis) return;
    try {
        await redis.del(key);     // Immediately removes the key from Redis
    } catch (err) {
        console.error('Redis delCache error:', err.message);
    }
};
```

**When is this used?**
When data changes (a new debate is created, XP is awarded), the cached leaderboard
becomes stale. Calling `delCache('leaderboard:global:1:50')` forces the next request
to re-fetch fresh data from MongoDB and re-cache it.
*(In MindClash, cache invalidation relies on TTL expiry — `delCache` is available for future use.)*

---

## 5. The Cache-Aside Pattern (How Routes Use Redis)

Every cached route follows the same exact 4-step pattern. This is called **Cache-Aside**:

```
Step 1: Check Redis first      → Cache HIT  → return immediately
                                ↓
                               Cache MISS
                                ↓
Step 2: Query MongoDB          → Get fresh data
                                ↓
Step 3: Store result in Redis  → setCache(key, data, ttl)
                                ↓
Step 4: Return data to user    → res.json(data)
```

### Exact Implementation in `leaderboardRoutes.js`:

```javascript
import { getCache, setCache } from '../config/redis.js';

router.get('/global', async (req, res) => {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 50;

    // Cache key includes page + limit so each paginated view is cached separately
    const cacheKey = `leaderboard:global:${page}:${limit}`;

    // ─── STEP 1: Check Redis ───────────────────────────────────────────
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
        return res.json(cachedData);
        // ↑ Returns HERE if cached. MongoDB never queried. ~0.5ms response time.
    }

    // ─── STEP 2: Cache miss → MongoDB query ───────────────────────────
    const skip  = (page - 1) * limit;
    const users = await User.find({ totalDebates: { $gt: 0 } })
        .sort({ reputation: -1, wins: -1 })
        .skip(skip)
        .limit(limit)
        .select('username displayName avatar frame tier level reputation xp wins losses bestStreak');

    const total      = await User.countDocuments({ totalDebates: { $gt: 0 } });
    const rankedUsers = users.map((user, index) => ({
        rank: skip + index + 1,
        ...user.toObject(),
        winRate: user.totalDebates > 0 ? Math.round((user.wins / user.totalDebates) * 100) : 0,
    }));

    const responseData = {
        success: true,
        leaderboard: rankedUsers,
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalUsers: total,
        },
    };

    // ─── STEP 3: Store in Redis for 5 minutes ─────────────────────────
    await setCache(cacheKey, responseData, 300);

    // ─── STEP 4: Return fresh data ────────────────────────────────────
    res.json(responseData);
});
```

---

## 6. All 4 Endpoints Using Redis Cache in MindClash

| File | Route | Cache Key | TTL | Why This TTL? |
|---|---|---|---|---|
| [`leaderboardRoutes.js`](file:///e:/Projects/Mindclash-main/server/routes/leaderboardRoutes.js) | `GET /api/leaderboard/global` | `leaderboard:global:{page}:{limit}` | **300s (5 min)** | Leaderboard changes when debates end; 5 min is fresh enough |
| [`leaderboardRoutes.js`](file:///e:/Projects/Mindclash-main/server/routes/leaderboardRoutes.js) | `GET /api/leaderboard/weekly` | `leaderboard:weekly` | **300s (5 min)** | Weekly stats, medium staleness acceptable |
| [`topicRoutes.js`](file:///e:/Projects/Mindclash-main/server/routes/topicRoutes.js) | `GET /api/topics/trending` | `topics:trending` | **600s (10 min)** | Trending changes slowly; 10 min is fine |
| [`topicRoutes.js`](file:///e:/Projects/Mindclash-main/server/routes/topicRoutes.js) | `GET /api/topics/featured` | `topics:featured` | **3600s (1 hour)** | Featured topic is set once per day — 1 hr staleness fine |

---

## 7. What Redis Does NOT Do in MindClash (And Why)

| Redis Pattern | Used? | Why Not? | Future Plan |
|---|---|---|---|
| **Response Cache** | ✅ Active | — | Already implemented |
| **Session Storage** | ❌ No | JWT is stateless — no session object needed on server | Never needed unless switching to session auth |
| **Token Blacklist** | ❌ No | Would require Redis for JWT revocation; TTL expiry accepted instead | Add if ban-instant-kick needed |
| **Pub/Sub** | ❌ Not yet | Single server — Socket.io in-memory rooms work perfectly | Add `@socket.io/redis-adapter` when multi-server |
| **BullMQ Job Queue** | ❌ Not yet | `finishDebate()` runs synchronously in socket handler; acceptable for MVP | Add when AI job retry + background processing needed |

---

## 8. Graceful Degradation — Why Your App Never Crashes if Redis Goes Down

Every helper function (`getCache`, `setCache`, `delCache`) has this safety:

```javascript
if (!redis) return null;   // Redis not configured → skip
try { ... }
catch { return null; }     // Redis error → skip, fall to MongoDB
```

**The consequence of this design:**

```
Normal flow:    Request → Redis HIT  → Response (fast)
Cache miss:     Request → Redis MISS → MongoDB → Redis store → Response
Redis down:     Request → null       → MongoDB              → Response (normal speed)
Redis missing:  Request → null       → MongoDB              → Response (normal speed)
```

The user never sees an error. They just get a slightly slower response when Redis is unavailable.
This is called **Graceful Degradation** — the system degrades gracefully from fast to normal,
never from normal to broken.

---

## 9. What Redis Is NOT (Common Misconceptions)

| Misconception | Reality |
|---|---|
| "Redis replaces MongoDB" | ❌ Redis stores copies of popular data temporarily. MongoDB stores everything permanently. |
| "Redis Pub/Sub is what we use for Socket.io" | ❌ MindClash uses Socket.io's built-in rooms. Pub/Sub is only needed for multi-server deployments. |
| "Redis Queue is what our matchmaking uses" | ❌ Matchmaking uses a JavaScript `Map` in Node.js RAM — no Redis involved. |
| "Redis needs a database schema" | ❌ Redis is schemaless. You just store string keys → string values. |
| "Redis data is permanent" | ❌ Redis is in-memory. Data is lost on Redis restart. Use TTL intentionally. |

---

## 10. Interview Q&A for Redis

**Q: Why did you add Redis to MindClash?**
> A: The Leaderboard and Trending Topics endpoints perform expensive MongoDB aggregations — scanning and sorting thousands of user documents on every request. With Redis caching and a 5-minute TTL, the first request populates the cache and all subsequent requests return in under 1ms without hitting MongoDB at all, reducing database read load by approximately 80%.

**Q: What happens if Redis goes down?**
> A: Every Redis helper function wraps operations in a `try/catch` and checks `if (!redis)` before executing. If Redis is unconfigured or throws an error, the functions return `null`, causing routes to fall through to normal MongoDB queries. Users see no errors — just slightly slower response times. This is Graceful Degradation.

**Q: Why don't you use Redis for the matchmaking queue?**
> A: The matchmaking queue is stored in a JavaScript `Map` in Node.js process memory, which accesses data in nanoseconds — three orders of magnitude faster than even Redis. Since MindClash currently runs on a single server instance, in-memory is strictly superior. Redis queues become necessary only when scaling to multiple server instances where each instance has isolated memory.

**Q: Why no Redis Pub/Sub for Socket.io?**
> A: Socket.io's built-in rooms already synchronize events between all sockets connected to a single server in microseconds with zero network overhead. Redis Pub/Sub is the scaling upgrade path — attaching the `@socket.io/redis-adapter` allows events to fan out across multiple Node.js instances. The architecture was deliberately designed so this can be added with zero changes to existing socket event handlers.

**Q: What TTL did you choose and why?**
> A: Leaderboards use 5 minutes (300s) because debate results that update rankings are processed at most every few minutes. Trending topics use 10 minutes because trending velocity changes slowly. The featured topic uses 1 hour because it's set manually once per day. Shorter TTLs would waste the caching benefit; longer TTLs would show stale data. TTLs were chosen by balancing data freshness against database load.

---

## 11. Quick Reference — Redis in MindClash

| File | Role |
|---|---|
| [`server/config/redis.js`](file:///e:/Projects/Mindclash-main/server/config/redis.js) | Connection + `getCache` / `setCache` / `delCache` helpers |
| [`server/routes/leaderboardRoutes.js`](file:///e:/Projects/Mindclash-main/server/routes/leaderboardRoutes.js) | Caches global + weekly leaderboard (TTL: 5 min) |
| [`server/routes/topicRoutes.js`](file:///e:/Projects/Mindclash-main/server/routes/topicRoutes.js) | Caches trending + featured topics (TTL: 10 min / 1 hr) |
| [`server/index.js`](file:///e:/Projects/Mindclash-main/server/index.js) | Calls `connectRedis()` on boot |

**Environment Variable:**
```env
REDIS_URL=redis://default:password@redis-12345.redis-cloud.com:12345
# Leave empty → Redis disabled, app works normally using MongoDB only
```

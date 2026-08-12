import Redis from 'ioredis';

let redis = null;

const connectRedis = () => {
    try {
        if (process.env.REDIS_URL) {
            redis = new Redis(process.env.REDIS_URL, {
                maxRetriesPerRequest: 3,
                retryDelayOnFailover: 100,
                lazyConnect: true,
            });

            redis.on('connect', () => {
                console.log('✅ Redis Connected');
            });

            redis.on('error', (err) => {
                console.error('❌ Redis Error:', err.message);
            });

            redis.connect().catch(console.error);
        } else {
            console.log('⚠️ Redis URL not configured, using in-memory fallback');
        }
    } catch (error) {
        console.error('❌ Redis Connection Error:', error.message);
    }

    return redis;
};

/**
 * Get cached JSON object from Redis safely
 */
export const getCache = async (key) => {
    if (!redis) return null;
    try {
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        console.error('Redis getCache error:', err.message);
        return null;
    }
};

/**
 * Set JSON object in Redis with expiration (TTL in seconds)
 */
export const setCache = async (key, value, ttlSeconds = 300) => {
    if (!redis) return;
    try {
        await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
        console.error('Redis setCache error:', err.message);
    }
};

/**
 * Delete cached key from Redis
 */
export const delCache = async (key) => {
    if (!redis) return;
    try {
        await redis.del(key);
    } catch (err) {
        console.error('Redis delCache error:', err.message);
    }
};

export { redis, connectRedis };

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

export { redis, connectRedis };

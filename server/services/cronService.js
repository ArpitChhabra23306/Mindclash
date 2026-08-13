import cron from 'node-cron';
import User from '../models/User.js';
import { delCache } from '../config/redis.js';

/**
 * Reset all weekly leaderboard stats across all users
 * and invalidate the Redis cache.
 */
export const resetWeeklyLeaderboard = async () => {
    try {
        console.log('🔄 Executing scheduled Weekly Leaderboard reset...');
        
        const result = await User.updateMany(
            {},
            { $set: { weeklyWins: 0, weeklyDebates: 0 } }
        );

        // Invalidate Redis cache so the next request gets fresh 0-state or fresh weekly matches
        await delCache('leaderboard:weekly');

        console.log(`✅ Weekly Leaderboard reset complete. Updated ${result.modifiedCount} user records.`);
    } catch (error) {
        console.error('❌ Failed to reset weekly leaderboard:', error.message);
    }
};

/**
 * Initialize all scheduled cron jobs and run startup checks
 */
export const initCronJobs = () => {
    // Schedule: Run every Sunday at 00:00:00 (Midnight UTC)
    // Format: second(optional) minute hour day-of-month month day-of-week
    // '0 0 * * 0' = At 00:00 on Sunday
    cron.schedule('0 0 * * 0', async () => {
        console.log('⏰ Sunday Midnight Cron Triggered: Starting weekly leaderboard reset');
        await resetWeeklyLeaderboard();
    });

    console.log('⏰ Cron service initialized (Weekly Leaderboard reset scheduled for Sunday 00:00 UTC)');
};

export default {
    initCronJobs,
    resetWeeklyLeaderboard,
};

import express from 'express';
import User from '../models/User.js';

const router = express.Router();

/**
 * @route   GET /api/leaderboard/global
 * @desc    Get global leaderboard
 * @access  Public
 */
router.get('/global', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const users = await User.find({ totalDebates: { $gt: 0 } })
            .sort({ reputation: -1, wins: -1 })
            .skip(skip)
            .limit(limit)
            .select('username displayName avatar frame tier level reputation xp wins losses totalDebates bestStreak');

        const total = await User.countDocuments({ totalDebates: { $gt: 0 } });

        // Add rank to each user
        const rankedUsers = users.map((user, index) => ({
            rank: skip + index + 1,
            ...user.toObject(),
            winRate: user.totalDebates > 0 ? Math.round((user.wins / user.totalDebates) * 100) : 0,
        }));

        res.json({
            success: true,
            leaderboard: rankedUsers,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalUsers: total,
            },
        });
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
});

/**
 * @route   GET /api/leaderboard/weekly
 * @desc    Get weekly leaderboard
 * @access  Public
 */
router.get('/weekly', async (req, res) => {
    try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        // For now, use the same logic as global but could be enhanced
        // to track weekly stats separately
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

        res.json({
            success: true,
            leaderboard: rankedUsers,
            period: 'weekly',
        });
    } catch (error) {
        console.error('Get weekly leaderboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
});

/**
 * @route   GET /api/leaderboard/category/:category
 * @desc    Get category-specific leaderboard
 * @access  Public
 */
router.get('/category/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const validCategories = ['Politics', 'Technology', 'Sports', 'Philosophy', 'Science', 'Entertainment', 'Economy', 'Social'];

        if (!validCategories.includes(category)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid category',
            });
        }

        // Find users with stats in this category
        const users = await User.find({
            [`categoryStats.${category}.wins`]: { $exists: true }
        })
            .sort({ [`categoryStats.${category}.wins`]: -1 })
            .limit(50)
            .select('username displayName avatar tier categoryStats');

        const rankedUsers = users.map((user, index) => {
            const catStats = user.categoryStats?.get(category) || { wins: 0, losses: 0, avgScore: 0 };
            return {
                rank: index + 1,
                username: user.username,
                displayName: user.displayName,
                avatar: user.avatar,
                tier: user.tier,
                categoryWins: catStats.wins,
                categoryLosses: catStats.losses,
                avgScore: Math.round(catStats.avgScore),
            };
        });

        res.json({
            success: true,
            category,
            leaderboard: rankedUsers,
        });
    } catch (error) {
        console.error('Get category leaderboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
});

/**
 * @route   GET /api/leaderboard/anonymous
 * @desc    Get anonymous debaters leaderboard
 * @access  Public
 */
router.get('/anonymous', async (req, res) => {
    try {
        const users = await User.find({
            preferAnonymous: true,
            totalDebates: { $gt: 0 }
        })
            .sort({ reputation: -1, wins: -1 })
            .limit(50)
            .select('anonymousAlias tier level reputation wins losses totalDebates bestStreak');

        const rankedUsers = users.map((user, index) => ({
            rank: index + 1,
            alias: user.anonymousAlias,
            tier: user.tier,
            level: user.level,
            reputation: user.reputation,
            wins: user.wins,
            losses: user.losses,
            totalDebates: user.totalDebates,
            bestStreak: user.bestStreak,
            winRate: user.totalDebates > 0 ? Math.round((user.wins / user.totalDebates) * 100) : 0,
        }));

        res.json({
            success: true,
            leaderboard: rankedUsers,
        });
    } catch (error) {
        console.error('Get anonymous leaderboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
});

export default router;

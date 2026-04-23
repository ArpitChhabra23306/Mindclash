import express from 'express';
import User from '../models/User.js';
import Debate from '../models/Debate.js';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';
import { mongoIdValidation, paginationValidation } from '../middleware/validation.js';

const router = express.Router();

/**
 * @route   GET /api/users/profile/:username
 * @desc    Get user public profile
 * @access  Public
 */
router.get('/profile/:username', optionalAuth, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username })
            .select('-password -email -blockedUsers -settings');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Check privacy settings
        const isOwnProfile = req.user && req.user._id.toString() === user._id.toString();
        const showStats = user.settings?.privacy?.showStats !== false || isOwnProfile;

        res.json({
            success: true,
            user: {
                id: user._id,
                username: user.username,
                displayName: user.displayName,
                bio: user.bio,
                avatar: user.avatar,
                frame: user.frame,
                tier: user.tier,
                level: user.calculateLevel(),
                ...(showStats && {
                    xp: user.xp,
                    reputation: user.reputation,
                    wins: user.wins,
                    losses: user.losses,
                    totalDebates: user.totalDebates,
                    winRate: user.getWinRate(),
                    bestStreak: user.bestStreak,
                }),
                achievements: user.achievements,
                ownedBadges: user.ownedBadges,
                followersCount: user.followers.length,
                followingCount: user.following.length,
                isFollowing: req.user ? user.followers.includes(req.user._id) : false,
                createdAt: user.createdAt,
            },
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
});

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', protect, async (req, res) => {
    try {
        const { displayName, bio, avatar, frame, preferAnonymous, settings } = req.body;

        const updateData = {};
        if (displayName) updateData.displayName = displayName;
        if (bio !== undefined) updateData.bio = bio;
        if (avatar) updateData.avatar = avatar;
        if (frame) updateData.frame = frame;
        if (preferAnonymous !== undefined) updateData.preferAnonymous = preferAnonymous;
        if (settings) updateData.settings = { ...req.user.settings, ...settings };

        const user = await User.findByIdAndUpdate(
            req.user._id,
            updateData,
            { new: true }
        );

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                displayName: user.displayName,
                bio: user.bio,
                avatar: user.avatar,
                frame: user.frame,
                preferAnonymous: user.preferAnonymous,
                settings: user.settings,
            },
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
});

/**
 * @route   POST /api/users/follow/:id
 * @desc    Follow a user
 * @access  Private
 */
router.post('/follow/:id', protect, mongoIdValidation('id'), async (req, res) => {
    try {
        const targetId = req.params.id;

        if (targetId === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'You cannot follow yourself',
            });
        }

        const targetUser = await User.findById(targetId);
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Check if already following
        if (req.user.following.includes(targetId)) {
            return res.status(400).json({
                success: false,
                message: 'Already following this user',
            });
        }

        // Add to following/followers
        await User.findByIdAndUpdate(req.user._id, {
            $push: { following: targetId },
        });
        await User.findByIdAndUpdate(targetId, {
            $push: { followers: req.user._id },
        });

        res.json({
            success: true,
            message: `Now following ${targetUser.username}`,
        });
    } catch (error) {
        console.error('Follow error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
});

/**
 * @route   DELETE /api/users/follow/:id
 * @desc    Unfollow a user
 * @access  Private
 */
router.delete('/follow/:id', protect, mongoIdValidation('id'), async (req, res) => {
    try {
        const targetId = req.params.id;

        await User.findByIdAndUpdate(req.user._id, {
            $pull: { following: targetId },
        });
        await User.findByIdAndUpdate(targetId, {
            $pull: { followers: req.user._id },
        });

        res.json({
            success: true,
            message: 'Unfollowed successfully',
        });
    } catch (error) {
        console.error('Unfollow error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
});

/**
 * @route   GET /api/users/:id/debates
 * @desc    Get user's debate history
 * @access  Public
 */
router.get('/:id/debates', paginationValidation, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const debates = await Debate.find({
            $or: [
                { 'proTeam.user': req.params.id },
                { 'conTeam.user': req.params.id },
            ],
            status: 'finished',
        })
            .sort({ endedAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('topic type winner proTeam conTeam scores startedAt endedAt');

        const total = await Debate.countDocuments({
            $or: [
                { 'proTeam.user': req.params.id },
                { 'conTeam.user': req.params.id },
            ],
            status: 'finished',
        });

        res.json({
            success: true,
            debates,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalDebates: total,
            },
        });
    } catch (error) {
        console.error('Get debates error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
});

/**
 * @route   GET /api/users/search
 * @desc    Search users
 * @access  Public
 */
router.get('/search', async (req, res) => {
    try {
        const { q, limit = 10 } = req.query;

        if (!q || q.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Search query must be at least 2 characters',
            });
        }

        const users = await User.find({
            $or: [
                { username: { $regex: q, $options: 'i' } },
                { displayName: { $regex: q, $options: 'i' } },
            ],
        })
            .select('username displayName avatar tier level')
            .limit(parseInt(limit));

        res.json({
            success: true,
            users,
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
});

export default router;

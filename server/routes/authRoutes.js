import express from 'express';
import User from '../models/User.js';
import { generateToken, protect } from '../middleware/authMiddleware.js';
import { registerValidation, loginValidation } from '../middleware/validation.js';
import geminiService from '../services/geminiService.js';

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', registerValidation, async (req, res) => {
    try {
        const { email, password, username } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({
            $or: [{ email }, { username }],
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: existingUser.email === email
                    ? 'Email already registered'
                    : 'Username already taken',
            });
        }

        // Generate anonymous alias
        const anonymousAlias = await geminiService.generateAlias();

        // Create user
        const user = await User.create({
            email,
            password,
            username,
            displayName: username,
            anonymousAlias,
            ownedAvatars: ['default_avatar'],
            ownedFrames: ['default_frame'],
            ownedThemes: ['default_theme'],
        });

        // Generate token
        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            message: 'Registration successful!',
            token,
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
                displayName: user.displayName,
                avatar: user.avatar,
                xp: user.xp,
                level: user.level,
                tier: user.tier,
                anonymousAlias: user.anonymousAlias,
            },
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
        });
    }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', loginValidation, async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user with password
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
        }

        // Check password
        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
        }

        if (user.isBanned) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been banned',
                reason: user.banReason,
            });
        }

        // Update last login
        user.lastLogin = new Date();
        user.isOnline = true;
        await user.save();

        // Generate token
        const token = generateToken(user._id);

        res.json({
            success: true,
            message: 'Login successful!',
            token,
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
                displayName: user.displayName,
                avatar: user.avatar,
                frame: user.frame,
                xp: user.xp,
                level: user.level,
                tier: user.tier,
                reputation: user.reputation,
                wins: user.wins,
                losses: user.losses,
                totalDebates: user.totalDebates,
                winStreak: user.winStreak,
                anonymousAlias: user.anonymousAlias,
                preferAnonymous: user.preferAnonymous,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login',
        });
    }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
                displayName: user.displayName,
                bio: user.bio,
                avatar: user.avatar,
                frame: user.frame,
                xp: user.xp,
                level: user.calculateLevel(),
                tier: user.calculateTier(),
                reputation: user.reputation,
                wins: user.wins,
                losses: user.losses,
                draws: user.draws,
                totalDebates: user.totalDebates,
                winStreak: user.winStreak,
                bestStreak: user.bestStreak,
                winRate: user.getWinRate(),
                anonymousAlias: user.anonymousAlias,
                preferAnonymous: user.preferAnonymous,
                ownedAvatars: user.ownedAvatars,
                ownedFrames: user.ownedFrames,
                ownedThemes: user.ownedThemes,
                ownedBadges: user.ownedBadges,
                powerUps: user.powerUps,
                achievements: user.achievements,
                following: user.following.length,
                followers: user.followers.length,
                settings: user.settings,
                createdAt: user.createdAt,
            },
        });
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', protect, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, { isOnline: false });

        res.json({
            success: true,
            message: 'Logged out successfully',
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during logout',
        });
    }
});

export default router;

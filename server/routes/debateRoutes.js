import express from 'express';
import Debate from '../models/Debate.js';
import Topic from '../models/Topic.js';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';
import { mongoIdValidation, paginationValidation } from '../middleware/validation.js';
import geminiService from '../services/geminiService.js';

const router = express.Router();

/**
 * @route   GET /api/debates
 * @desc    Get live and recent debates
 * @access  Public
 */
router.get('/', paginationValidation, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status || 'active';
        const category = req.query.category;

        const query = { status };
        if (category) query['topic.category'] = category;

        const debates = await Debate.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('proTeam.user', 'username avatar tier')
            .populate('conTeam.user', 'username avatar tier')
            .select('-rounds');

        const total = await Debate.countDocuments(query);

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
 * @route   GET /api/debates/live
 * @desc    Get currently live debates
 * @access  Public
 */
router.get('/live', async (req, res) => {
    try {
        const category = req.query.category;
        const query = { status: 'active' };
        if (category) query['topic.category'] = category;

        const debates = await Debate.find(query)
            .sort({ spectatorCount: -1, createdAt: -1 })
            .limit(20)
            .populate('proTeam.user', 'username avatar tier anonymousAlias')
            .populate('conTeam.user', 'username avatar tier anonymousAlias')
            .select('topic type proTeam conTeam scores spectatorCount bettingPool odds currentRound status startedAt');

        res.json({
            success: true,
            debates,
        });
    } catch (error) {
        console.error('Get live debates error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
});

/**
 * @route   GET /api/debates/featured
 * @desc    Get featured debates
 * @access  Public
 */
router.get('/featured', async (req, res) => {
    try {
        const debates = await Debate.find({
            $or: [
                { isFeatured: true, status: 'active' },
                { status: 'active', spectatorCount: { $gte: 10 } },
            ],
        })
            .sort({ spectatorCount: -1 })
            .limit(5)
            .populate('proTeam.user', 'username avatar tier')
            .populate('conTeam.user', 'username avatar tier');

        res.json({
            success: true,
            debates,
        });
    } catch (error) {
        console.error('Get featured error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
});

/**
 * @route   GET /api/debates/:id
 * @desc    Get single debate by ID
 * @access  Public
 */
router.get('/:id', mongoIdValidation('id'), optionalAuth, async (req, res) => {
    try {
        const debate = await Debate.findById(req.params.id)
            .populate('proTeam.user', 'username displayName avatar tier anonymousAlias')
            .populate('conTeam.user', 'username displayName avatar tier anonymousAlias')
            .populate('winner.team', 'username avatar');

        if (!debate) {
            return res.status(404).json({
                success: false,
                message: 'Debate not found',
            });
        }

        // Increment view count
        debate.viewCount += 1;
        await debate.save();

        // Process anonymous participants
        const processedDebate = debate.toObject();

        // Hide real identities if anonymous
        processedDebate.proTeam = processedDebate.proTeam.map(p => ({
            ...p,
            user: p.isAnonymous ? {
                username: p.alias || 'Anonymous',
                avatar: 'anonymous_avatar',
                tier: p.user?.tier
            } : p.user,
        }));

        processedDebate.conTeam = processedDebate.conTeam.map(p => ({
            ...p,
            user: p.isAnonymous ? {
                username: p.alias || 'Anonymous',
                avatar: 'anonymous_avatar',
                tier: p.user?.tier
            } : p.user,
        }));

        res.json({
            success: true,
            debate: processedDebate,
        });
    } catch (error) {
        console.error('Get debate error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
});

/**
 * @route   GET /api/debates/:id/replay
 * @desc    Get debate replay with all rounds and messages
 * @access  Public
 */
router.get('/:id/replay', mongoIdValidation('id'), async (req, res) => {
    try {
        const debate = await Debate.findOne({
            _id: req.params.id,
            status: 'finished',
        })
            .populate('proTeam.user', 'username avatar')
            .populate('conTeam.user', 'username avatar')
            .populate('rounds.messages.sender', 'username avatar');

        if (!debate) {
            return res.status(404).json({
                success: false,
                message: 'Debate not found or not finished',
            });
        }

        res.json({
            success: true,
            replay: {
                topic: debate.topic,
                type: debate.type,
                proTeam: debate.proTeam,
                conTeam: debate.conTeam,
                rounds: debate.rounds,
                scores: debate.scores,
                winner: debate.winner,
                aiSummary: debate.aiSummary,
                highlights: debate.highlights,
                duration: debate.duration,
                startedAt: debate.startedAt,
                endedAt: debate.endedAt,
            },
        });
    } catch (error) {
        console.error('Get replay error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
});

/**
 * @route   POST /api/debates/generate-topic
 * @desc    Generate a new debate topic using AI
 * @access  Private
 */
router.post('/generate-topic', protect, async (req, res) => {
    try {
        const { category, difficulty } = req.body;

        const topic = await geminiService.generateTopic(
            category || 'General',
            difficulty || 'intermediate'
        );

        if (!topic) {
            return res.status(500).json({
                success: false,
                message: 'Failed to generate topic',
            });
        }

        res.json({
            success: true,
            topic,
        });
    } catch (error) {
        console.error('Generate topic error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
});

/**
 * @route   POST /api/debates/assist
 * @desc    Get AI assistance for argument (Whisper Mode)
 * @access  Private
 */
router.post('/assist', protect, async (req, res) => {
    try {
        const { draft, side, topic, opponentArguments } = req.body;

        const assistance = await geminiService.assistArgument(
            draft,
            side,
            topic,
            opponentArguments || []
        );

        res.json({
            success: true,
            assistance,
        });
    } catch (error) {
        console.error('Assist error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
});

export default router;

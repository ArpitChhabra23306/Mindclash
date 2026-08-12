import express from 'express';
import Topic from '../models/Topic.js';
import { protect } from '../middleware/authMiddleware.js';
import openaiService from '../services/openaiService.js';
import { getCache, setCache } from '../config/redis.js';

const router = express.Router();

/**
 * @route   GET /api/topics
 * @desc    Get all topics
 * @access  Public
 */
router.get('/', async (req, res) => {
    try {
        const { category, difficulty, limit = 20 } = req.query;
        const query = { isActive: true };

        if (category) query.category = category;
        if (difficulty) query.difficulty = difficulty;

        const topics = await Topic.find(query)
            .sort({ timesUsed: -1, likes: -1 })
            .limit(parseInt(limit));

        res.json({
            success: true,
            topics,
        });
    } catch (error) {
        console.error('Get topics error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * @route   GET /api/topics/trending
 * @desc    Get trending topics
 * @access  Public
 */
router.get('/trending', async (req, res) => {
    try {
        const cacheKey = 'topics:trending';
        const cached = await getCache(cacheKey);
        if (cached) return res.json(cached);

        const topics = await Topic.getTrending(10);
        const responseData = { success: true, topics };

        // Cache for 10 minutes (600s)
        await setCache(cacheKey, responseData, 600);

        res.json(responseData);
    } catch (error) {
        console.error('Get trending error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * @route   GET /api/topics/featured
 * @desc    Get featured topic of the day
 * @access  Public
 */
router.get('/featured', async (req, res) => {
    try {
        const cacheKey = 'topics:featured';
        const cached = await getCache(cacheKey);
        if (cached) return res.json(cached);

        const featured = await Topic.findOne({
            isFeatured: true,
            isActive: true,
        }).sort({ featuredAt: -1 });

        const responseData = { success: true, topic: featured };

        // Cache for 1 hour (3600s)
        await setCache(cacheKey, responseData, 3600);

        res.json(responseData);
    } catch (error) {
        console.error('Get featured error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * @route   GET /api/topics/random
 * @desc    Get a random topic
 * @access  Public
 */
router.get('/random', async (req, res) => {
    try {
        const { category } = req.query;
        const topic = await Topic.getRandomTopic(category);

        if (!topic) {
            // Generate one with AI if no topics exist
            const generated = await openaiService.generateTopic(category || 'General');
            return res.json({
                success: true,
                topic: {
                    title: generated.title,
                    description: generated.description,
                    category: category || 'General',
                    source: 'ai',
                },
                generated: true,
            });
        }

        res.json({
            success: true,
            topic,
        });
    } catch (error) {
        console.error('Get random topic error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * @route   POST /api/topics/generate
 * @desc    Generate a new topic with AI
 * @access  Private
 */
router.post('/generate', protect, async (req, res) => {
    try {
        const { category, difficulty } = req.body;

        const generated = await openaiService.generateTopic(
            category || 'General',
            difficulty || 'intermediate'
        );

        if (!generated) {
            return res.status(500).json({
                success: false,
                message: 'Failed to generate topic',
            });
        }

        // Save to database
        const topic = await Topic.create({
            title: generated.title,
            description: generated.description,
            category: category || 'General',
            difficulty: difficulty || 'intermediate',
            source: 'ai',
            tags: generated.tags || [],
        });

        res.json({
            success: true,
            topic: {
                ...topic.toObject(),
                proPosition: generated.proPosition,
                conPosition: generated.conPosition,
                keyPoints: generated.keyPoints,
            },
        });
    } catch (error) {
        console.error('Generate topic error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * @route   POST /api/topics/suggest
 * @desc    Submit a user-suggested topic
 * @access  Private
 */
router.post('/suggest', protect, async (req, res) => {
    try {
        const { title, description, category } = req.body;

        if (!title || title.length < 10) {
            return res.status(400).json({
                success: false,
                message: 'Topic title must be at least 10 characters',
            });
        }

        const topic = await Topic.create({
            title,
            description,
            category: category || 'Other',
            source: 'user',
            createdBy: req.user._id,
        });

        res.status(201).json({
            success: true,
            message: 'Topic submitted for review',
            topic,
        });
    } catch (error) {
        console.error('Suggest topic error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * @route   POST /api/topics/:id/like
 * @desc    Like a topic
 * @access  Private
 */
router.post('/:id/like', protect, async (req, res) => {
    try {
        const topic = await Topic.findByIdAndUpdate(
            req.params.id,
            { $inc: { likes: 1 } },
            { new: true }
        );

        if (!topic) {
            return res.status(404).json({
                success: false,
                message: 'Topic not found',
            });
        }

        res.json({
            success: true,
            likes: topic.likes,
        });
    } catch (error) {
        console.error('Like topic error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

export default router;

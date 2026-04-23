import express from 'express';
import Community from '../models/Community.js';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';
import { createCommunityValidation, mongoIdValidation, paginationValidation } from '../middleware/validation.js';

const router = express.Router();

/**
 * @route   GET /api/communities
 * @desc    Get all communities
 * @access  Public
 */
router.get('/', paginationValidation, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const category = req.query.category;
        const search = req.query.search;

        const query = { isActive: true };
        if (category) query.category = category;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
            ];
        }

        const communities = await Community.find(query)
            .sort({ memberCount: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .select('name description category avatar color memberCount totalDebates');

        const total = await Community.countDocuments(query);

        res.json({
            success: true,
            communities,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalCommunities: total,
            },
        });
    } catch (error) {
        console.error('Get communities error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * @route   POST /api/communities
 * @desc    Create a new community
 * @access  Private
 */
router.post('/', protect, createCommunityValidation, async (req, res) => {
    try {
        const { name, description, category, isPrivate } = req.body;

        const existingCommunity = await Community.findOne({ name });
        if (existingCommunity) {
            return res.status(400).json({
                success: false,
                message: 'A community with this name already exists',
            });
        }

        const community = await Community.create({
            name,
            description,
            category: category || 'General',
            owner: req.user._id,
            moderators: [req.user._id],
            members: [{
                user: req.user._id,
                role: 'admin',
                joinedAt: new Date(),
            }],
            memberCount: 1,
            isPrivate: isPrivate || false,
        });

        res.status(201).json({
            success: true,
            message: 'Community created successfully!',
            community,
        });
    } catch (error) {
        console.error('Create community error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * @route   GET /api/communities/:id
 * @desc    Get community by ID
 * @access  Public
 */
router.get('/:id', mongoIdValidation('id'), optionalAuth, async (req, res) => {
    try {
        const community = await Community.findById(req.params.id)
            .populate('owner', 'username avatar')
            .populate('moderators', 'username avatar')
            .populate('members.user', 'username avatar tier');

        if (!community) {
            return res.status(404).json({
                success: false,
                message: 'Community not found',
            });
        }

        const isMember = req.user && community.members.some(
            m => m.user._id.toString() === req.user._id.toString()
        );
        const isOwner = req.user && community.owner._id.toString() === req.user._id.toString();

        res.json({
            success: true,
            community: {
                ...community.toObject(),
                isMember,
                isOwner,
            },
        });
    } catch (error) {
        console.error('Get community error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * @route   POST /api/communities/:id/join
 * @desc    Join a community
 * @access  Private
 */
router.post('/:id/join', protect, mongoIdValidation('id'), async (req, res) => {
    try {
        const community = await Community.findById(req.params.id);

        if (!community) {
            return res.status(404).json({
                success: false,
                message: 'Community not found',
            });
        }

        const isMember = community.members.some(
            m => m.user.toString() === req.user._id.toString()
        );

        if (isMember) {
            return res.status(400).json({
                success: false,
                message: 'Already a member of this community',
            });
        }

        if (community.requiresApproval) {
            community.pendingRequests.push({
                user: req.user._id,
                requestedAt: new Date(),
            });
            await community.save();

            return res.json({
                success: true,
                message: 'Join request submitted',
            });
        }

        community.members.push({
            user: req.user._id,
            role: 'member',
            joinedAt: new Date(),
        });
        community.memberCount += 1;
        await community.save();

        res.json({
            success: true,
            message: `Joined ${community.name} successfully!`,
        });
    } catch (error) {
        console.error('Join community error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * @route   DELETE /api/communities/:id/leave
 * @desc    Leave a community
 * @access  Private
 */
router.delete('/:id/leave', protect, mongoIdValidation('id'), async (req, res) => {
    try {
        const community = await Community.findById(req.params.id);

        if (!community) {
            return res.status(404).json({
                success: false,
                message: 'Community not found',
            });
        }

        if (community.owner.toString() === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Owner cannot leave the community. Transfer ownership first.',
            });
        }

        community.members = community.members.filter(
            m => m.user.toString() !== req.user._id.toString()
        );
        community.moderators = community.moderators.filter(
            m => m.toString() !== req.user._id.toString()
        );
        community.memberCount = Math.max(0, community.memberCount - 1);
        await community.save();

        res.json({
            success: true,
            message: 'Left the community',
        });
    } catch (error) {
        console.error('Leave community error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

export default router;

import express from 'express';
import { MarketplaceItem, Purchase } from '../models/Marketplace.js';
import User from '../models/User.js';
import { protect } from '../middleware/authMiddleware.js';
import { mongoIdValidation, paginationValidation } from '../middleware/validation.js';

const router = express.Router();

/**
 * @route   GET /api/marketplace
 * @desc    Get all marketplace items
 * @access  Public
 */
router.get('/', paginationValidation, async (req, res) => {
    try {
        const { type, rarity, sort = 'price' } = req.query;
        const query = { isAvailable: true };

        if (type) query.type = type;
        if (rarity) query.rarity = rarity;

        const sortOptions = {
            price: { price: 1 },
            '-price': { price: -1 },
            popular: { purchaseCount: -1 },
            newest: { createdAt: -1 },
        };

        const items = await MarketplaceItem.find(query)
            .sort(sortOptions[sort] || { price: 1 });

        res.json({
            success: true,
            items,
        });
    } catch (error) {
        console.error('Get marketplace error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * @route   GET /api/marketplace/featured
 * @desc    Get featured and sale items
 * @access  Public
 */
router.get('/featured', async (req, res) => {
    try {
        const saleItems = await MarketplaceItem.find({
            isAvailable: true,
            isOnSale: true,
        }).limit(10);

        const limitedItems = await MarketplaceItem.find({
            isAvailable: true,
            isLimited: true,
            remainingStock: { $gt: 0 },
        }).limit(5);

        res.json({
            success: true,
            saleItems,
            limitedItems,
        });
    } catch (error) {
        console.error('Get featured error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * @route   POST /api/marketplace/purchase/:id
 * @desc    Purchase an item
 * @access  Private
 */
router.post('/purchase/:id', protect, mongoIdValidation('id'), async (req, res) => {
    try {
        const item = await MarketplaceItem.findById(req.params.id);

        if (!item || !item.isAvailable) {
            return res.status(404).json({
                success: false,
                message: 'Item not found or not available',
            });
        }

        // Check if user already owns this item (for non-consumables)
        if (item.type !== 'powerUp') {
            const inventoryField = {
                avatar: 'ownedAvatars',
                frame: 'ownedFrames',
                theme: 'ownedThemes',
                badge: 'ownedBadges',
            }[item.type];

            if (inventoryField && req.user[inventoryField]?.includes(item.itemId)) {
                return res.status(400).json({
                    success: false,
                    message: 'You already own this item',
                });
            }
        }

        // Check XP balance
        const price = item.isOnSale && item.originalPrice ? item.price : item.price;
        if (req.user.xp < price) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient XP',
                required: price,
                current: req.user.xp,
            });
        }

        // Check stock for limited items
        if (item.isLimited && item.remainingStock <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Item is out of stock',
            });
        }

        // Check requirements
        if (item.requiredLevel && req.user.level < item.requiredLevel) {
            return res.status(400).json({
                success: false,
                message: `Requires level ${item.requiredLevel}`,
            });
        }

        // Process purchase
        const updateUser = { $inc: { xp: -price } };

        if (item.type === 'powerUp') {
            const powerUpField = {
                'extra_time': 'powerUps.extraTime',
                'hint_token': 'powerUps.hintToken',
                'fact_check_boost': 'powerUps.factCheckBoost',
                'shield': 'powerUps.shield',
            }[item.itemId] || `powerUps.${item.itemId}`;

            updateUser.$inc[powerUpField] = 1;
        } else {
            const inventoryField = {
                avatar: 'ownedAvatars',
                frame: 'ownedFrames',
                theme: 'ownedThemes',
                badge: 'ownedBadges',
                alias: 'ownedAliases',
            }[item.type];

            if (inventoryField) {
                updateUser.$push = { [inventoryField]: item.itemId };
            }
        }

        await User.findByIdAndUpdate(req.user._id, updateUser);

        // Update item stats
        const itemUpdate = { $inc: { purchaseCount: 1 } };
        if (item.isLimited) {
            itemUpdate.$inc.remainingStock = -1;
        }
        await MarketplaceItem.findByIdAndUpdate(item._id, itemUpdate);

        // Create purchase record
        await Purchase.create({
            user: req.user._id,
            item: item._id,
            itemType: item.type,
            itemId: item.itemId,
            price,
        });

        res.json({
            success: true,
            message: `Successfully purchased ${item.name}!`,
            newBalance: req.user.xp - price,
            item: {
                type: item.type,
                itemId: item.itemId,
            },
        });
    } catch (error) {
        console.error('Purchase error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * @route   GET /api/marketplace/my-purchases
 * @desc    Get user's purchase history
 * @access  Private
 */
router.get('/my-purchases', protect, async (req, res) => {
    try {
        const purchases = await Purchase.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .populate('item', 'name type rarity previewImage');

        res.json({
            success: true,
            purchases,
        });
    } catch (error) {
        console.error('Get purchases error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

export default router;

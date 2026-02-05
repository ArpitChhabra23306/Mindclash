import mongoose from 'mongoose';

const marketplaceItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
    },

    // Item type
    type: {
        type: String,
        enum: ['avatar', 'frame', 'theme', 'powerUp', 'badge', 'alias', 'effect'],
        required: true,
    },

    // Item identifier (for frontend to use)
    itemId: {
        type: String,
        required: true,
        unique: true,
    },

    // Pricing
    price: {
        type: Number,
        required: true,
        min: 0,
    },
    originalPrice: Number, // For sale items
    isOnSale: {
        type: Boolean,
        default: false,
    },
    saleEndsAt: Date,

    // Rarity
    rarity: {
        type: String,
        enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
        default: 'common',
    },

    // Availability
    isAvailable: {
        type: Boolean,
        default: true,
    },
    isLimited: {
        type: Boolean,
        default: false,
    },
    totalStock: Number,
    remainingStock: Number,

    // Requirements
    requiredLevel: {
        type: Number,
        default: 1,
    },
    requiredTier: String,
    requiredBadge: String,

    // Stats
    purchaseCount: {
        type: Number,
        default: 0,
    },

    // Visual
    previewImage: String,
    previewAnimation: String,

    // Categories/Tags
    tags: [String],

}, { timestamps: true });

// Indexes
marketplaceItemSchema.index({ type: 1, isAvailable: 1, price: 1 });
marketplaceItemSchema.index({ rarity: 1 });
marketplaceItemSchema.index({ isOnSale: 1 });

const MarketplaceItem = mongoose.model('MarketplaceItem', marketplaceItemSchema);

// ============ PURCHASE HISTORY ============

const purchaseSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketplaceItem',
        required: true,
    },
    itemType: String,
    itemId: String,
    price: {
        type: Number,
        required: true,
    },

}, { timestamps: true });

purchaseSchema.index({ user: 1, createdAt: -1 });

const Purchase = mongoose.model('Purchase', purchaseSchema);

export { MarketplaceItem, Purchase };

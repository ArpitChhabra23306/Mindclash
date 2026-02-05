import mongoose from 'mongoose';

const topicSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },

    category: {
        type: String,
        enum: ['Politics', 'Technology', 'Sports', 'Philosophy', 'Science', 'Entertainment', 'Economy', 'Social', 'Other'],
        required: true,
    },

    // Difficulty
    difficulty: {
        type: String,
        enum: ['beginner', 'intermediate', 'expert'],
        default: 'intermediate',
    },

    // Source
    source: {
        type: String,
        enum: ['ai', 'user', 'curated'],
        default: 'curated',
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },

    // Stats
    timesUsed: {
        type: Number,
        default: 0,
    },
    averageScore: {
        type: Number,
        default: 0,
    },

    // Popularity
    likes: {
        type: Number,
        default: 0,
    },

    // Trending
    isTrending: {
        type: Boolean,
        default: false,
    },
    trendingScore: {
        type: Number,
        default: 0,
    },

    // Featured
    isFeatured: {
        type: Boolean,
        default: false,
    },
    featuredAt: Date,

    // Tags
    tags: [String],

    // Status
    isActive: {
        type: Boolean,
        default: true,
    },

}, { timestamps: true });

// Indexes
topicSchema.index({ category: 1, isActive: 1 });
topicSchema.index({ isTrending: 1, trendingScore: -1 });
topicSchema.index({ isFeatured: 1 });
topicSchema.index({ title: 'text', description: 'text', tags: 'text' });

// Static method to get random topic by category
topicSchema.statics.getRandomTopic = async function (category = null) {
    const query = { isActive: true };
    if (category) query.category = category;

    const count = await this.countDocuments(query);
    if (count === 0) return null;

    const random = Math.floor(Math.random() * count);
    return this.findOne(query).skip(random);
};

// Static method to get trending topics
topicSchema.statics.getTrending = async function (limit = 10) {
    return this.find({ isActive: true, isTrending: true })
        .sort({ trendingScore: -1 })
        .limit(limit);
};

const Topic = mongoose.model('Topic', topicSchema);

export default Topic;

import mongoose from 'mongoose';

const communitySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 50,
    },
    description: {
        type: String,
        maxlength: 500,
    },

    // Category focus
    category: {
        type: String,
        enum: ['Politics', 'Technology', 'Sports', 'Philosophy', 'Science', 'Entertainment', 'Economy', 'Social', 'Other', 'General'],
        default: 'General',
    },

    // Appearance
    avatar: {
        type: String,
        default: 'default_community',
    },
    banner: String,
    color: {
        type: String,
        default: '#6366f1',
    },

    // Owner & Moderators
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    moderators: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],

    // Members
    members: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        role: {
            type: String,
            enum: ['member', 'moderator', 'admin'],
            default: 'member',
        },
        joinedAt: {
            type: Date,
            default: Date.now,
        },
    }],
    memberCount: {
        type: Number,
        default: 0,
    },

    // Privacy
    isPrivate: {
        type: Boolean,
        default: false,
    },
    requiresApproval: {
        type: Boolean,
        default: false,
    },
    pendingRequests: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        requestedAt: Date,
        message: String,
    }],

    // Rules
    rules: [{
        title: String,
        description: String,
    }],

    // Stats
    totalDebates: {
        type: Number,
        default: 0,
    },
    weeklyDebates: {
        type: Number,
        default: 0,
    },

    // Tags
    tags: [String],

    // Status
    isActive: {
        type: Boolean,
        default: true,
    },

}, { timestamps: true });

// Indexes
communitySchema.index({ name: 'text', description: 'text' });
communitySchema.index({ category: 1, memberCount: -1 });
communitySchema.index({ 'members.user': 1 });

const Community = mongoose.model('Community', communitySchema);

export default Community;

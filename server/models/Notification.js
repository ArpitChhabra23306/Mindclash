import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },

    type: {
        type: String,
        enum: [
            'match_ready',
            'debate_result',
            'new_follower',
            'challenge_received',
            'xp_earned',
            'level_up',
            'badge_earned',
            'bet_result',
            'daily_bonus',
            'community_invite',
            'dm_received',
            'system'
        ],
        required: true,
    },

    title: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },

    // Related entities
    relatedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    relatedDebate: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Debate',
    },

    // Additional data
    data: {
        type: mongoose.Schema.Types.Mixed,
    },

    // Status
    isRead: {
        type: Boolean,
        default: false,
    },
    readAt: Date,

    // Action URL
    actionUrl: String,

}, { timestamps: true });

// Indexes
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

// TTL - auto delete after 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;

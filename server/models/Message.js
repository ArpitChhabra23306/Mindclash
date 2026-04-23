import mongoose from 'mongoose';

// Chat Message (Spectator chat, DMs, etc.)
const chatMessageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    senderAlias: String, // For anonymous messages
    isAnonymous: {
        type: Boolean,
        default: false,
    },

    content: {
        type: String,
        required: true,
        maxlength: 500,
    },

    // Message type
    type: {
        type: String,
        enum: ['spectator', 'dm', 'community', 'system'],
        default: 'spectator',
    },

    // For spectator chat
    debate: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Debate',
    },

    // For DMs
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    conversationId: String,

    // For community chat
    community: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Community',
    },

    // Moderation
    isDeleted: {
        type: Boolean,
        default: false,
    },
    deletedAt: Date,
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },

    // AI moderation
    aiModeration: {
        isFlagged: { type: Boolean, default: false },
        toxicityScore: Number,
        reason: String,
    },

    // Reactions
    reactions: {
        likes: { type: Number, default: 0 },
        likedBy: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],
    },

    // Read status (for DMs)
    isRead: {
        type: Boolean,
        default: false,
    },
    readAt: Date,

}, { timestamps: true });

// Indexes
chatMessageSchema.index({ debate: 1, createdAt: -1 });
chatMessageSchema.index({ conversationId: 1, createdAt: -1 });
chatMessageSchema.index({ sender: 1, recipient: 1 });
chatMessageSchema.index({ community: 1, createdAt: -1 });

// TTL index for auto-deleting old DMs (7 days)
chatMessageSchema.index(
    { createdAt: 1 },
    {
        expireAfterSeconds: 604800, // 7 days
        partialFilterExpression: { type: 'dm' }
    }
);

const Message = mongoose.model('Message', chatMessageSchema);

export default Message;

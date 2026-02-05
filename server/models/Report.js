import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
    // Reporter
    reporter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },

    // What is being reported
    reportType: {
        type: String,
        enum: ['user', 'message', 'debate', 'community'],
        required: true,
    },

    // References (only one will be used based on reportType)
    reportedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    reportedMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
    },
    reportedDebate: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Debate',
    },
    reportedCommunity: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Community',
    },

    // Report details
    reason: {
        type: String,
        enum: [
            'harassment',
            'hate_speech',
            'spam',
            'misinformation',
            'inappropriate_content',
            'cheating',
            'impersonation',
            'other'
        ],
        required: true,
    },
    description: {
        type: String,
        maxlength: 1000,
    },
    evidence: [String], // URLs to screenshots or logs

    // Status
    status: {
        type: String,
        enum: ['pending', 'reviewing', 'resolved', 'dismissed'],
        default: 'pending',
    },

    // Resolution
    resolution: {
        action: {
            type: String,
            enum: ['no_action', 'warning', 'content_removed', 'temp_ban', 'perm_ban'],
        },
        note: String,
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        resolvedAt: Date,
    },

    // AI pre-review
    aiReview: {
        recommendation: String,
        confidence: Number,
        toxicityAnalysis: {
            score: Number,
            categories: [String],
        },
    },

}, { timestamps: true });

// Indexes
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reportedUser: 1 });
reportSchema.index({ reporter: 1 });

const Report = mongoose.model('Report', reportSchema);

export default Report;

import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    content: {
        type: String,
        required: true,
        maxlength: 2000,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },

    // AI Analysis
    aiScore: {
        logic: { type: Number, min: 0, max: 100 },
        evidence: { type: Number, min: 0, max: 100 },
        persuasion: { type: Number, min: 0, max: 100 },
        clarity: { type: Number, min: 0, max: 100 },
        overall: { type: Number, min: 0, max: 100 },
    },

    // Fact checking
    factCheck: {
        checked: { type: Boolean, default: false },
        claims: [{
            text: String,
            isAccurate: Boolean,
            accuracy: Number,
            source: String,
        }],
    },

    // Moderation
    moderation: {
        isFlagged: { type: Boolean, default: false },
        reason: String,
        toxicityScore: Number,
    },
});

const roundSchema = new mongoose.Schema({
    roundNumber: {
        type: Number,
        required: true,
    },
    type: {
        type: String,
        enum: ['opening', 'rebuttal', 'counter', 'closing'],
        required: true,
    },
    duration: {
        type: Number, // seconds
        default: 120,
    },
    messages: [messageSchema],
    startedAt: Date,
    endedAt: Date,
});

const debateSchema = new mongoose.Schema({
    // Debate Type
    type: {
        type: String,
        enum: ['1v1', '2v2', '3v3', 'battleRoyale'],
        default: '1v1',
    },

    // Topic
    topic: {
        title: {
            type: String,
            required: true,
        },
        description: String,
        category: {
            type: String,
            enum: ['Politics', 'Technology', 'Sports', 'Philosophy', 'Science', 'Entertainment', 'Economy', 'Social', 'Other'],
            default: 'Other',
        },
    },

    // Participants
    proTeam: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        isAnonymous: {
            type: Boolean,
            default: false,
        },
        alias: String,
        role: {
            type: String,
            enum: ['lead', 'support', 'closer'],
            default: 'lead',
        },
    }],

    conTeam: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        isAnonymous: {
            type: Boolean,
            default: false,
        },
        alias: String,
        role: {
            type: String,
            enum: ['lead', 'support', 'closer'],
            default: 'lead',
        },
    }],

    // For Battle Royale
    participants: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        isAnonymous: Boolean,
        alias: String,
        isEliminated: { type: Boolean, default: false },
        eliminatedAt: Date,
        ranking: Number,
        totalScore: { type: Number, default: 0 },
    }],

    // Rounds
    rounds: [roundSchema],
    currentRound: {
        type: Number,
        default: 0,
    },

    // Current Turn (whose turn it is)
    currentTurn: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    currentSide: {
        type: String,
        enum: ['pro', 'con', null],
        default: null,
    },
    turnEndsAt: Date,

    // Scoring
    scores: {
        pro: {
            total: { type: Number, default: 0 },
            logic: { type: Number, default: 0 },
            evidence: { type: Number, default: 0 },
            persuasion: { type: Number, default: 0 },
            rebuttal: { type: Number, default: 0 },
            clarity: { type: Number, default: 0 },
        },
        con: {
            total: { type: Number, default: 0 },
            logic: { type: Number, default: 0 },
            evidence: { type: Number, default: 0 },
            persuasion: { type: Number, default: 0 },
            rebuttal: { type: Number, default: 0 },
            clarity: { type: Number, default: 0 },
        },
    },

    // Result
    winner: {
        side: {
            type: String,
            enum: ['pro', 'con', 'draw', null],
            default: null,
        },
        team: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],
        score: Number,
        margin: Number,
    },
    loserScore: Number,

    // AI Analysis
    aiSummary: {
        keyPoints: {
            pro: [String],
            con: [String],
        },
        decisionReasoning: String,
        strengthsWeaknesses: {
            pro: {
                strengths: [String],
                weaknesses: [String],
            },
            con: {
                strengths: [String],
                weaknesses: [String],
            },
        },
    },

    // Spectators
    spectators: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        joinedAt: Date,
    }],
    spectatorCount: {
        type: Number,
        default: 0,
    },

    // Reactions (from spectators)
    reactions: {
        fire: { type: Number, default: 0 },
        clap: { type: Number, default: 0 },
        hundred: { type: Number, default: 0 },
        thinking: { type: Number, default: 0 },
        shock: { type: Number, default: 0 },
    },

    // Betting
    bettingPool: {
        total: { type: Number, default: 0 },
        pro: { type: Number, default: 0 },
        con: { type: Number, default: 0 },
    },
    bettingOpen: {
        type: Boolean,
        default: true,
    },
    odds: {
        pro: { type: Number, default: 1.0 },
        con: { type: Number, default: 1.0 },
    },

    // Status
    status: {
        type: String,
        enum: ['waiting', 'starting', 'active', 'paused', 'finished', 'cancelled'],
        default: 'waiting',
    },

    // Timestamps
    scheduledAt: Date,
    startedAt: Date,
    endedAt: Date,

    // Metadata
    isRanked: {
        type: Boolean,
        default: true,
    },
    isFeatured: {
        type: Boolean,
        default: false,
    },
    viewCount: {
        type: Number,
        default: 0,
    },

    // Highlights
    highlights: [{
        roundNumber: Number,
        messageIndex: Number,
        reason: String,
        timestamp: Date,
    }],

}, { timestamps: true });

// Indexes
debateSchema.index({ status: 1 });
debateSchema.index({ 'topic.category': 1 });
debateSchema.index({ createdAt: -1 });
debateSchema.index({ 'proTeam.user': 1 });
debateSchema.index({ 'conTeam.user': 1 });
debateSchema.index({ isFeatured: 1, status: 1 });

// Virtual for debate duration
debateSchema.virtual('duration').get(function () {
    if (this.startedAt && this.endedAt) {
        return Math.floor((this.endedAt - this.startedAt) / 1000);
    }
    return null;
});

// Method to calculate odds
debateSchema.methods.calculateOdds = function () {
    const total = this.bettingPool.pro + this.bettingPool.con;
    if (total === 0) return { pro: 2.0, con: 2.0 };

    const proOdds = total / (this.bettingPool.pro || 1);
    const conOdds = total / (this.bettingPool.con || 1);

    return {
        pro: Math.round(proOdds * 100) / 100,
        con: Math.round(conOdds * 100) / 100,
    };
};

const Debate = mongoose.model('Debate', debateSchema);

export default Debate;

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    // Authentication
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        minlength: 6,
        select: false,
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true,
    },

    // Profile
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 20,
    },
    displayName: {
        type: String,
        trim: true,
    },
    avatar: {
        type: String,
        default: 'default_avatar',
    },
    frame: {
        type: String,
        default: 'default_frame',
    },
    bio: {
        type: String,
        maxlength: 300,
        default: '',
    },

    // Anonymous System
    anonymousAlias: {
        type: String,
        unique: true,
        sparse: true,
    },
    preferAnonymous: {
        type: Boolean,
        default: false,
    },

    // Stats
    xp: {
        type: Number,
        default: 0,
    },
    level: {
        type: Number,
        default: 1,
    },
    reputation: {
        type: Number,
        default: 0,
    },
    tier: {
        type: String,
        enum: ['Novice', 'Debater', 'Skilled', 'Expert', 'Master', 'Grandmaster', 'Legend'],
        default: 'Novice',
    },

    // Debate Stats
    totalDebates: {
        type: Number,
        default: 0,
    },
    wins: {
        type: Number,
        default: 0,
    },
    losses: {
        type: Number,
        default: 0,
    },
    draws: {
        type: Number,
        default: 0,
    },
    winStreak: {
        type: Number,
        default: 0,
    },
    bestStreak: {
        type: Number,
        default: 0,
    },

    // Category Stats
    categoryStats: {
        type: Map,
        of: {
            wins: { type: Number, default: 0 },
            losses: { type: Number, default: 0 },
            avgScore: { type: Number, default: 0 },
        },
        default: {},
    },

    // Inventory
    ownedAvatars: [{
        type: String,
    }],
    ownedFrames: [{
        type: String,
    }],
    ownedThemes: [{
        type: String,
    }],
    ownedBadges: [{
        type: String,
    }],
    powerUps: {
        extraTime: { type: Number, default: 0 },
        hintToken: { type: Number, default: 0 },
        factCheckBoost: { type: Number, default: 0 },
        shield: { type: Number, default: 0 },
    },

    // Social
    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    followers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    blockedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],

    // Achievements & Badges
    achievements: [{
        name: String,
        description: String,
        earnedAt: Date,
        icon: String,
    }],

    // Settings
    settings: {
        notifications: {
            matchReady: { type: Boolean, default: true },
            debateResult: { type: Boolean, default: true },
            newFollower: { type: Boolean, default: true },
            challengeReceived: { type: Boolean, default: true },
        },
        privacy: {
            showOnlineStatus: { type: Boolean, default: true },
            allowDMs: { type: Boolean, default: true },
            showStats: { type: Boolean, default: true },
        },
        theme: {
            type: String,
            default: 'dark',
        },
    },

    // Activity
    isOnline: {
        type: Boolean,
        default: false,
    },
    lastLogin: {
        type: Date,
        default: Date.now,
    },
    lastLoginStreak: {
        type: Number,
        default: 0,
    },

    // Account Status
    isVerified: {
        type: Boolean,
        default: false,
    },
    isBanned: {
        type: Boolean,
        default: false,
    },
    banReason: String,
    banExpiresAt: Date,
    warnings: {
        type: Number,
        default: 0,
    },

}, { timestamps: true });

// Indexes for performance
userSchema.index({ xp: -1 });
userSchema.index({ reputation: -1 });
userSchema.index({ 'categoryStats.wins': -1 });
userSchema.index({ username: 'text', displayName: 'text' });

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Calculate tier based on reputation
userSchema.methods.calculateTier = function () {
    const rep = this.reputation;
    if (rep >= 10000) return 'Legend';
    if (rep >= 5000) return 'Grandmaster';
    if (rep >= 2500) return 'Master';
    if (rep >= 1000) return 'Expert';
    if (rep >= 500) return 'Skilled';
    if (rep >= 100) return 'Debater';
    return 'Novice';
};

// Calculate level based on XP
userSchema.methods.calculateLevel = function () {
    return Math.floor(Math.sqrt(this.xp / 100)) + 1;
};

// Get win rate
userSchema.methods.getWinRate = function () {
    if (this.totalDebates === 0) return 0;
    return Math.round((this.wins / this.totalDebates) * 100);
};

// Generate anonymous alias
userSchema.statics.generateAnonymousAlias = function () {
    const adjectives = ['Shadow', 'Silent', 'Swift', 'Clever', 'Bold', 'Wise', 'Quick', 'Sharp', 'Keen', 'Bright'];
    const nouns = ['Thinker', 'Debater', 'Scholar', 'Ninja', 'Master', 'Sage', 'Mind', 'Voice', 'Logic', 'Reason'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 1000);
    return `${adj}${noun}_${num}`;
};

const User = mongoose.model('User', userSchema);

export default User;

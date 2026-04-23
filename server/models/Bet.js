import mongoose from 'mongoose';

const betSchema = new mongoose.Schema({
    // References
    debate: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Debate',
        required: true,
    },
    bettor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },

    // Bet Details
    predictedWinner: {
        type: String,
        enum: ['pro', 'con'],
        required: true,
    },
    amount: {
        type: Number,
        required: true,
        min: 10, // Minimum bet
        max: 10000, // Maximum bet
    },

    // Odds at time of bet
    oddsAtBet: {
        type: Number,
        required: true,
    },

    // Result
    result: {
        type: String,
        enum: ['pending', 'won', 'lost', 'refunded'],
        default: 'pending',
    },
    payout: {
        type: Number,
        default: 0,
    },
    profit: {
        type: Number,
        default: 0,
    },

    // Timestamps
    placedAt: {
        type: Date,
        default: Date.now,
    },
    settledAt: Date,

}, { timestamps: true });

// Indexes
betSchema.index({ debate: 1, bettor: 1 });
betSchema.index({ bettor: 1, result: 1 });
betSchema.index({ placedAt: -1 });

// Calculate potential payout
betSchema.methods.getPotentialPayout = function () {
    return Math.round(this.amount * this.oddsAtBet);
};

// Static method to get user's betting stats
betSchema.statics.getUserBettingStats = async function (userId) {
    const stats = await this.aggregate([
        { $match: { bettor: new mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: null,
                totalBets: { $sum: 1 },
                totalWagered: { $sum: '$amount' },
                totalWon: {
                    $sum: {
                        $cond: [{ $eq: ['$result', 'won'] }, 1, 0]
                    }
                },
                totalLost: {
                    $sum: {
                        $cond: [{ $eq: ['$result', 'lost'] }, 1, 0]
                    }
                },
                totalProfit: { $sum: '$profit' },
                totalPayout: { $sum: '$payout' },
            }
        }
    ]);

    if (stats.length === 0) {
        return {
            totalBets: 0,
            totalWagered: 0,
            totalWon: 0,
            totalLost: 0,
            totalProfit: 0,
            winRate: 0,
        };
    }

    const data = stats[0];
    data.winRate = data.totalBets > 0
        ? Math.round((data.totalWon / data.totalBets) * 100)
        : 0;

    return data;
};

const Bet = mongoose.model('Bet', betSchema);

export default Bet;

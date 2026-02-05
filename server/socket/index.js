import User from '../models/User.js';
import Debate from '../models/Debate.js';
import Bet from '../models/Bet.js';
import Message from '../models/Message.js';
import jwt from 'jsonwebtoken';
import geminiService from '../services/geminiService.js';

// Store active matchmaking queue and debates
const matchmakingQueue = new Map();
const activeDebates = new Map();
const userSockets = new Map();

// Debate configuration
const MESSAGES_PER_SIDE_TO_END = 5; // End debate after 5 messages from each side

/**
 * Authenticate socket connection
 */
const authenticateSocket = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;

        if (!token) {
            return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return next(new Error('User not found'));
        }

        socket.user = user;
        next();
    } catch (error) {
        next(new Error('Invalid token'));
    }
};

/**
 * Initialize Socket.io handlers
 */
export const initializeSocket = (io) => {
    // Apply authentication middleware
    io.use(authenticateSocket);

    io.on('connection', (socket) => {
        console.log(`🔌 User connected: ${socket.user.username}`);

        // Track user socket
        userSockets.set(socket.user._id.toString(), socket.id);

        // Update user online status
        User.findByIdAndUpdate(socket.user._id, { isOnline: true }).exec();

        // ==================== MATCHMAKING ====================

        socket.on('join_queue', async (data) => {
            try {
                const { type = '1v1', category, isAnonymous = false } = data;
                console.log(`🎯 User ${socket.user.username} joining queue:`, { type, category, isAnonymous });

                const queueEntry = {
                    socketId: socket.id,
                    userId: socket.user._id.toString(),
                    username: socket.user.username,
                    tier: socket.user.tier,
                    reputation: socket.user.reputation,
                    isAnonymous,
                    category,
                    type,
                    joinedAt: Date.now(),
                };

                const queueKey = `${type}-${category || 'any'}`;
                if (!matchmakingQueue.has(queueKey)) {
                    matchmakingQueue.set(queueKey, []);
                }
                matchmakingQueue.get(queueKey).push(queueEntry);

                socket.emit('queue_joined', {
                    position: matchmakingQueue.get(queueKey).length,
                    type,
                    category,
                });

                await tryMatchmaking(io, queueKey, type);
            } catch (error) {
                console.error('Join queue error:', error);
                socket.emit('error', { message: 'Failed to join queue' });
            }
        });

        socket.on('leave_queue', (data) => {
            const { type = '1v1', category } = data;
            const queueKey = `${type}-${category || 'any'}`;

            if (matchmakingQueue.has(queueKey)) {
                const queue = matchmakingQueue.get(queueKey);
                const index = queue.findIndex(e => e.socketId === socket.id);
                if (index > -1) {
                    queue.splice(index, 1);
                }
            }

            socket.emit('queue_left');
        });

        // ==================== DEBATE ROOM ====================

        socket.on('join_debate', async (data) => {
            try {
                const { debateId } = data;
                const debate = await Debate.findById(debateId)
                    .populate('proTeam.user', 'username avatar')
                    .populate('conTeam.user', 'username avatar');

                if (!debate) {
                    return socket.emit('error', { message: 'Debate not found' });
                }

                socket.join(`debate:${debateId}`);
                socket.debateId = debateId;

                const isProTeam = debate.proTeam.some(p => p.user._id.toString() === socket.user._id.toString());
                const isConTeam = debate.conTeam.some(p => p.user._id.toString() === socket.user._id.toString());
                const isParticipant = isProTeam || isConTeam;

                socket.emit('debate_joined', {
                    debate,
                    role: isParticipant ? (isProTeam ? 'pro' : 'con') : 'spectator',
                });

                if (!isParticipant) {
                    await Debate.findByIdAndUpdate(debateId, {
                        $inc: { spectatorCount: 1 },
                        $push: { spectators: { user: socket.user._id, joinedAt: new Date() } },
                    });

                    io.to(`debate:${debateId}`).emit('spectator_joined', {
                        spectatorCount: debate.spectatorCount + 1,
                    });
                }
            } catch (error) {
                console.error('Join debate error:', error);
                socket.emit('error', { message: 'Failed to join debate' });
            }
        });

        /**
         * Submit argument - NO real-time scoring, just save and broadcast
         */
        socket.on('submit_argument', async (data) => {
            try {
                const { debateId, content } = data;

                const debate = await Debate.findById(debateId);

                if (!debate) {
                    return socket.emit('error', { message: 'Debate not found' });
                }

                if (debate.status === 'finished') {
                    return socket.emit('error', { message: 'Debate has already ended' });
                }

                if (debate.status !== 'active') {
                    return socket.emit('error', { message: 'Debate not active' });
                }

                const isProTeam = debate.proTeam.some(p => p.user.toString() === socket.user._id.toString());
                const isConTeam = debate.conTeam.some(p => p.user.toString() === socket.user._id.toString());

                if (!isProTeam && !isConTeam) {
                    return socket.emit('error', { message: 'You are not a participant' });
                }

                const side = isProTeam ? 'pro' : 'con';

                if (debate.currentSide !== side) {
                    return socket.emit('error', { message: 'Not your turn' });
                }

                // Count existing messages
                let proMessageCount = 0;
                let conMessageCount = 0;

                for (const round of debate.rounds) {
                    for (const msg of round.messages) {
                        const msgSide = debate.proTeam.some(p => p.user.toString() === msg.sender.toString()) ? 'pro' : 'con';
                        if (msgSide === 'pro') proMessageCount++;
                        else conMessageCount++;
                    }
                }

                console.log(`📊 Message counts - PRO: ${proMessageCount}, CON: ${conMessageCount}`);

                // Simple content check (no AI moderation to save API calls)
                if (content.length < 5) {
                    return socket.emit('argument_rejected', {
                        reason: 'Argument too short. Please write at least 5 characters.',
                    });
                }

                if (content.length > 2000) {
                    return socket.emit('argument_rejected', {
                        reason: 'Argument too long. Maximum 2000 characters.',
                    });
                }

                // Create message - NO AI scoring
                const message = {
                    sender: socket.user._id,
                    content,
                    timestamp: new Date(),
                };

                // Add to current round
                const currentRoundIndex = Math.min(debate.currentRound, debate.rounds.length - 1);
                const currentRound = debate.rounds[currentRoundIndex];

                if (!currentRound) {
                    return socket.emit('error', { message: 'Debate round error' });
                }

                currentRound.messages.push(message);

                // Update message count
                if (side === 'pro') proMessageCount++;
                else conMessageCount++;

                // Switch turns
                debate.currentSide = side === 'pro' ? 'con' : 'pro';
                debate.turnEndsAt = new Date(Date.now() + 120000);

                await debate.save();

                // Broadcast argument (no scores)
                io.to(`debate:${debateId}`).emit('argument_submitted', {
                    message: {
                        ...message,
                        senderName: socket.user.username,
                    },
                    side,
                    nextTurn: debate.currentSide,
                    turnEndsAt: debate.turnEndsAt,
                    messageCount: { pro: proMessageCount, con: conMessageCount },
                });

                console.log(`📝 Argument submitted. PRO: ${proMessageCount}/${MESSAGES_PER_SIDE_TO_END}, CON: ${conMessageCount}/${MESSAGES_PER_SIDE_TO_END}`);

                // Check if debate should end
                if (proMessageCount >= MESSAGES_PER_SIDE_TO_END && conMessageCount >= MESSAGES_PER_SIDE_TO_END) {
                    console.log('🏁 Both sides submitted 5 messages. Ending debate and ranking...');
                    await finishDebate(io, debate);
                } else {
                    // Advance round if both submitted in current round
                    const roundProMsgs = currentRound.messages.filter(m =>
                        debate.proTeam.some(p => p.user.toString() === m.sender.toString())
                    ).length;
                    const roundConMsgs = currentRound.messages.filter(m =>
                        debate.conTeam.some(p => p.user.toString() === m.sender.toString())
                    ).length;

                    if (roundProMsgs >= 1 && roundConMsgs >= 1 && debate.currentRound < debate.rounds.length - 1) {
                        debate.currentRound += 1;
                        await debate.save();

                        io.to(`debate:${debateId}`).emit('round_changed', {
                            roundNumber: debate.currentRound + 1,
                            roundType: debate.rounds[debate.currentRound]?.type || 'debate',
                            duration: 120,
                            side: debate.currentSide,
                        });
                    }
                }
            } catch (error) {
                console.error('Submit argument error:', error);
                socket.emit('error', { message: 'Failed to submit argument' });
            }
        });

        // ==================== SPECTATOR FEATURES ====================

        socket.on('spectator_chat', async (data) => {
            try {
                const { debateId, message, username } = data;
                io.to(`debate:${debateId}`).emit('spectator_message', {
                    username: username || socket.user.username,
                    message,
                    timestamp: new Date(),
                });
            } catch (error) {
                console.error('Spectator chat error:', error);
            }
        });

        socket.on('reaction', async (data) => {
            try {
                const { debateId, emoji } = data;
                io.to(`debate:${debateId}`).emit('reaction', { emoji });
            } catch (error) {
                console.error('Reaction error:', error);
            }
        });

        socket.on('place_bet', async (data) => {
            try {
                const { debateId, side, amount } = data;

                if (!['pro', 'con'].includes(side)) {
                    return socket.emit('bet_error', { message: 'Invalid prediction' });
                }

                if (amount < 10 || amount > 10000) {
                    return socket.emit('bet_error', { message: 'Bet amount must be 10-10000 XP' });
                }

                const debate = await Debate.findById(debateId);
                if (!debate || !debate.bettingOpen) {
                    return socket.emit('bet_error', { message: 'Betting is closed' });
                }

                if (socket.user.xp < amount) {
                    return socket.emit('bet_error', { message: 'Insufficient XP' });
                }

                await User.findByIdAndUpdate(socket.user._id, { $inc: { xp: -amount } });

                await Debate.findByIdAndUpdate(debateId, {
                    $inc: {
                        'bettingPool.total': amount,
                        [`bettingPool.${side}`]: amount,
                    },
                });

                const updatedDebate = await Debate.findById(debateId);

                socket.emit('bet_placed', { side, amount, newBalance: socket.user.xp - amount });
                io.to(`debate:${debateId}`).emit('betting_update', { pool: updatedDebate.bettingPool });
            } catch (error) {
                console.error('Place bet error:', error);
                socket.emit('bet_error', { message: 'Failed to place bet' });
            }
        });

        socket.on('leave_debate', async (data) => {
            const { debateId } = data;
            socket.leave(`debate:${debateId}`);
            socket.debateId = null;
        });

        socket.on('disconnect', async () => {
            console.log(`❌ User disconnected: ${socket.user.username}`);
            userSockets.delete(socket.user._id.toString());
            await User.findByIdAndUpdate(socket.user._id, { isOnline: false });

            if (socket.debateId) {
                await Debate.findByIdAndUpdate(socket.debateId, {
                    $inc: { spectatorCount: -1 },
                    $pull: { spectators: { user: socket.user._id } },
                });
            }

            for (const [key, queue] of matchmakingQueue) {
                const index = queue.findIndex(e => e.socketId === socket.id);
                if (index > -1) queue.splice(index, 1);
            }
        });
    });
};

/**
 * Try to match players in queue
 */
async function tryMatchmaking(io, queueKey, type) {
    const queue = matchmakingQueue.get(queueKey);

    if (!queue) return;

    const requiredPlayers = type === '1v1' ? 2 : type === '2v2' ? 4 : type === '3v3' ? 6 : 4;

    console.log(`📋 Queue "${queueKey}" has ${queue.length}/${requiredPlayers} players`);

    if (queue.length >= requiredPlayers) {
        console.log(`✅ Creating match...`);

        const players = queue.splice(0, requiredPlayers);
        const debate = await createDebate(players, type);
        console.log(`🏆 Debate created: ${debate._id}`);

        players.forEach((player, index) => {
            const playerSocket = io.sockets.sockets.get(player.socketId);
            if (playerSocket) {
                playerSocket.emit('match_found', {
                    debateId: debate._id,
                    side: index < requiredPlayers / 2 ? 'pro' : 'con',
                    topic: debate.topic,
                    opponent: players.find((p, i) =>
                        (index < requiredPlayers / 2) !== (i < requiredPlayers / 2)
                    )?.username,
                });
            }
        });
    }
}

/**
 * Create a new debate with fallback topic
 */
async function createDebate(players, type) {
    // Use static topics to avoid API calls
    const topics = [
        { title: 'Should social media be regulated by governments?', description: 'Debate the role of government in controlling social media platforms.', category: 'Technology' },
        { title: 'Is remote work better than office work?', description: 'Compare productivity and work-life balance in remote vs office settings.', category: 'Social' },
        { title: 'Should college education be free?', description: 'Discuss the pros and cons of free higher education.', category: 'Economy' },
        { title: 'Is AI a threat to human jobs?', description: 'Debate whether artificial intelligence will replace human workers.', category: 'Technology' },
        { title: 'Should voting be mandatory?', description: 'Discuss whether all citizens should be required to vote.', category: 'Politics' },
        { title: 'Is climate change the biggest threat to humanity?', description: 'Debate the urgency and severity of climate change.', category: 'Science' },
        { title: 'Should smartphones be banned in schools?', description: 'Discuss the impact of phones on student learning.', category: 'Social' },
        { title: 'Is space exploration worth the cost?', description: 'Debate funding priorities between space and Earth problems.', category: 'Science' },
    ];

    const topicData = topics[Math.floor(Math.random() * topics.length)];

    const halfPoint = players.length / 2;
    const proTeam = players.slice(0, halfPoint).map(p => ({
        user: p.userId,
        isAnonymous: p.isAnonymous,
        alias: p.isAnonymous ? `Anonymous_${Math.random().toString(36).substr(2, 5)}` : null,
        role: 'lead',
    }));
    const conTeam = players.slice(halfPoint).map(p => ({
        user: p.userId,
        isAnonymous: p.isAnonymous,
        alias: p.isAnonymous ? `Anonymous_${Math.random().toString(36).substr(2, 5)}` : null,
        role: 'lead',
    }));

    const debate = await Debate.create({
        type,
        topic: {
            title: topicData.title,
            description: topicData.description,
            category: topicData.category,
        },
        proTeam,
        conTeam,
        rounds: [
            { roundNumber: 1, type: 'opening', duration: 120, messages: [] },
            { roundNumber: 2, type: 'rebuttal', duration: 90, messages: [] },
            { roundNumber: 3, type: 'counter', duration: 60, messages: [] },
            { roundNumber: 4, type: 'closing', duration: 60, messages: [] },
        ],
        currentRound: 0,
        currentSide: 'pro',
        status: 'active',
        startedAt: new Date(),
        turnEndsAt: new Date(Date.now() + 120000),
    });

    activeDebates.set(debate._id.toString(), debate);
    return debate;
}

/**
 * Finish debate - AI ranks ALL arguments at once and declares winner
 */
async function finishDebate(io, debate) {
    console.log('🏁 finishDebate called for:', debate._id);

    if (debate.status === 'finished') {
        console.log('⚠️ Already finished');
        return;
    }

    debate.bettingOpen = false;
    debate.status = 'finished';
    debate.endedAt = new Date();

    // Collect all messages
    const allMessages = debate.rounds.flatMap(r => r.messages);
    const proMessages = allMessages.filter(m =>
        debate.proTeam.some(p => p.user.toString() === m.sender.toString())
    );
    const conMessages = allMessages.filter(m =>
        debate.conTeam.some(p => p.user.toString() === m.sender.toString())
    );

    console.log(`📊 Total messages - PRO: ${proMessages.length}, CON: ${conMessages.length}`);

    // Prepare arguments for AI ranking
    const proArgs = proMessages.map(m => m.content).join('\n\n---\n\n');
    const conArgs = conMessages.map(m => m.content).join('\n\n---\n\n');

    let winnerSide = 'draw';
    let proScore = 50;
    let conScore = 50;
    let reasoning = 'Both sides presented their arguments.';

    // Single AI call to rank all arguments and determine winner (with retry)
    let aiSuccess = false;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            console.log(`🤖 AI ranking attempt ${attempt}...`);
            const result = await geminiService.rankDebate(debate.topic.title, proArgs, conArgs);

            if (result) {
                winnerSide = result.winner || 'draw';
                proScore = result.proScore || 50;
                conScore = result.conScore || 50;
                reasoning = result.reasoning || reasoning;
                aiSuccess = true;
                console.log(`🏆 AI Result: ${winnerSide} wins (PRO: ${proScore}, CON: ${conScore})`);
                break;
            }
        } catch (err) {
            console.error(`AI ranking attempt ${attempt} failed:`, err.message);

            // Check if it's a rate limit error and wait
            if (err.status === 429 && attempt === 1) {
                console.log('⏳ Rate limited, waiting 35 seconds to retry...');
                await new Promise(resolve => setTimeout(resolve, 35000));
            }
        }
    }

    // Smart fallback if AI failed
    if (!aiSuccess) {
        console.log('📊 Using smart fallback scoring...');

        // Analyze arguments without AI
        const analyzeArgs = (args) => {
            const words = args.split(/\s+/).filter(w => w.length > 0);
            const sentences = args.split(/[.!?]+/).filter(s => s.trim().length > 0);
            const uniqueWords = new Set(words.map(w => w.toLowerCase()));
            const avgSentenceLength = words.length / Math.max(sentences.length, 1);

            // Score based on:
            // - Word count (more = more effort)
            // - Unique words (vocabulary diversity)
            // - Average sentence length (clarity - not too short, not too long)
            const wordScore = Math.min(words.length / 10, 30); // max 30 points
            const diversityScore = Math.min(uniqueWords.size / 5, 25); // max 25 points
            const clarityScore = avgSentenceLength >= 8 && avgSentenceLength <= 25 ? 20 : 10; // 10-20 points
            const lengthBonus = args.length > 200 ? 10 : args.length > 100 ? 5 : 0; // 0-10 points

            return wordScore + diversityScore + clarityScore + lengthBonus;
        };

        const proFallbackScore = analyzeArgs(proArgs);
        const conFallbackScore = analyzeArgs(conArgs);

        console.log(`📊 Fallback scores - PRO: ${proFallbackScore.toFixed(1)}, CON: ${conFallbackScore.toFixed(1)}`);

        // Normalize to 0-100 scale
        const total = proFallbackScore + conFallbackScore;
        if (total > 0) {
            proScore = Math.round((proFallbackScore / total) * 100);
            conScore = 100 - proScore;
        }

        // Determine winner (need at least 5% margin to avoid draw)
        const diff = proScore - conScore;
        if (diff >= 5) {
            winnerSide = 'pro';
            reasoning = 'PRO presented more detailed and diverse arguments.';
        } else if (diff <= -5) {
            winnerSide = 'con';
            reasoning = 'CON presented more detailed and diverse arguments.';
        } else {
            winnerSide = 'draw';
            reasoning = 'Both sides presented equally strong arguments.';
        }

        console.log(`🏆 Fallback Result: ${winnerSide} wins (PRO: ${proScore}, CON: ${conScore})`);
    }

    const margin = Math.abs(proScore - conScore);

    debate.scores = {
        pro: { total: proScore },
        con: { total: conScore },
    };

    debate.winner = {
        side: winnerSide,
        team: winnerSide === 'pro' ? debate.proTeam.map(p => p.user) :
            winnerSide === 'con' ? debate.conTeam.map(p => p.user) : [],
        score: winnerSide === 'pro' ? proScore : conScore,
        margin: margin,
    };
    debate.loserScore = winnerSide === 'pro' ? conScore : proScore;
    debate.aiSummary = { decisionReasoning: reasoning };

    await debate.save();

    // Update user stats
    const xpWin = 100;
    const xpLose = 25;
    const xpDraw = 50;

    if (winnerSide !== 'draw') {
        const winningTeam = winnerSide === 'pro' ? debate.proTeam : debate.conTeam;
        const losingTeam = winnerSide === 'pro' ? debate.conTeam : debate.proTeam;

        for (const player of winningTeam) {
            await User.findByIdAndUpdate(player.user, {
                $inc: { xp: xpWin, reputation: 10, wins: 1, totalDebates: 1, winStreak: 1 },
            });
        }

        for (const player of losingTeam) {
            await User.findByIdAndUpdate(player.user, {
                $inc: { xp: xpLose, losses: 1, totalDebates: 1 },
                $set: { winStreak: 0 },
            });
        }
    } else {
        for (const player of [...debate.proTeam, ...debate.conTeam]) {
            await User.findByIdAndUpdate(player.user, {
                $inc: { xp: xpDraw, draws: 1, totalDebates: 1 },
            });
        }
    }

    // Settle bets
    try {
        await settleBets(debate, winnerSide);
    } catch (err) {
        console.error('Bet settlement error:', err.message);
    }

    // Broadcast result to ALL
    const resultPayload = {
        debateId: debate._id,
        winner: winnerSide,
        finalScores: { pro: proScore, con: conScore },
        margin: margin,
        reasoning: reasoning,
        xpRewards: { winner: xpWin, loser: xpLose, draw: xpDraw },
        proTeam: debate.proTeam,
        conTeam: debate.conTeam,
    };

    console.log('📢 Broadcasting debate_ended:', resultPayload);
    io.to(`debate:${debate._id}`).emit('debate_ended', resultPayload);

    activeDebates.delete(debate._id.toString());
}

/**
 * Settle bets
 */
async function settleBets(debate, winner) {
    const bets = await Bet.find({ debate: debate._id, result: 'pending' });

    for (const bet of bets) {
        if (bet.predictedWinner === winner) {
            const payout = Math.round(bet.amount * (bet.oddsAtBet || 2));
            bet.result = 'won';
            bet.payout = payout;
            bet.profit = payout - bet.amount;
            bet.settledAt = new Date();
            await bet.save();
            await User.findByIdAndUpdate(bet.bettor, { $inc: { xp: payout } });
        } else if (winner === 'draw') {
            bet.result = 'refunded';
            bet.payout = bet.amount;
            bet.profit = 0;
            bet.settledAt = new Date();
            await bet.save();
            await User.findByIdAndUpdate(bet.bettor, { $inc: { xp: bet.amount } });
        } else {
            bet.result = 'lost';
            bet.payout = 0;
            bet.profit = -bet.amount;
            bet.settledAt = new Date();
            await bet.save();
        }
    }
}

export default { initializeSocket };

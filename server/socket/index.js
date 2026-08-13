import User from '../models/User.js';
import Debate from '../models/Debate.js';
import Bet from '../models/Bet.js';
import jwt from 'jsonwebtoken';
import openaiService from '../services/openaiService.js';

// ─── In-memory state ────────────────────────────────────────────────────────
const matchmakingQueue = new Map(); // queueKey → [entry]
const activeDebates    = new Map(); // debateId → debate doc
const userSockets      = new Map(); // userId   → socketId
const pendingDisconnects = new Map(); // userId → timeoutId

// How many total messages each SIDE must submit — varies by debate type
const getMessagesPerSide = (type) => (type === '1v1' ? 5 : 6);

// ─── Socket auth middleware ──────────────────────────────────────────────────
const authenticateSocket = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        if (!token) return next(new Error('Authentication required'));

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user    = await User.findById(decoded.id).select('-password');
        if (!user) return next(new Error('User not found'));

        socket.user = user;
        next();
    } catch {
        next(new Error('Invalid token'));
    }
};

// ─── Main initializer ────────────────────────────────────────────────────────
export const initializeSocket = (io) => {
    io.use(authenticateSocket);

    io.on('connection', (socket) => {
        console.log(`🔌 Connected: ${socket.user.username}`);
        userSockets.set(socket.user._id.toString(), socket.id);
        User.findByIdAndUpdate(socket.user._id, { isOnline: true }).exec();

        // ─── MATCHMAKING ────────────────────────────────────────────────────

        socket.on('join_queue', async (data) => {
            try {
                const { type = '1v1', category, isAnonymous = false } = data;
                const uid = socket.user._id.toString();

                // Deduplicate: if user is already in ANY queue, remove them first
                for (const [, q] of matchmakingQueue) {
                    const idx = q.findIndex(e => e.userId === uid);
                    if (idx > -1) q.splice(idx, 1);
                }

                // Generate alias for anonymous users (local, no AI call)
                const alias = isAnonymous
                    ? await openaiService.generateAlias()
                    : null;

                const entry = {
                    socketId:  socket.id,
                    userId:    uid,
                    username:  socket.user.username,
                    tier:      socket.user.tier,
                    reputation:socket.user.reputation,
                    isAnonymous,
                    alias,
                    category,
                    type,
                    joinedAt:  Date.now(),
                };

                const queueKey = `${type}-${category || 'any'}`;
                if (!matchmakingQueue.has(queueKey)) matchmakingQueue.set(queueKey, []);
                matchmakingQueue.get(queueKey).push(entry);

                socket.emit('queue_joined', {
                    position: matchmakingQueue.get(queueKey).length,
                    type,
                    category,
                    alias,
                });

                await tryMatchmaking(io, queueKey, type);
            } catch (error) {
                console.error('join_queue error:', error);
                socket.emit('error', { message: 'Failed to join queue' });
            }
        });

        socket.on('leave_queue', (data) => {
            const { type = '1v1', category } = data || {};
            const uid = socket.user._id.toString();

            if (type && type !== '1v1' || category) {
                // Specific queue
                const queueKey = `${type}-${category || 'any'}`;
                const queue = matchmakingQueue.get(queueKey);
                if (queue) {
                    const i = queue.findIndex(e => e.userId === uid);
                    if (i > -1) queue.splice(i, 1);
                }
            } else {
                // Remove from ALL queues
                for (const [, q] of matchmakingQueue) {
                    const i = q.findIndex(e => e.userId === uid);
                    if (i > -1) q.splice(i, 1);
                }
            }
            socket.emit('queue_left');
        });

        // ─── DEBATE ROOM ─────────────────────────────────────────────────────

        socket.on('join_debate', async (data) => {
            try {
                const { debateId } = data;
                const debate = await Debate.findById(debateId)
                    .populate('proTeam.user', 'username avatar tier')
                    .populate('conTeam.user', 'username avatar tier');

                if (!debate) return socket.emit('error', { message: 'Debate not found' });

                socket.join(`debate:${debateId}`);
                socket.debateId = debateId;

                const uid = socket.user._id.toString();

                const isProTeam = debate.proTeam.some(p => p.user._id.toString() === uid);
                const isConTeam = debate.conTeam.some(p => p.user._id.toString() === uid);
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
                console.error('join_debate error:', error);
                socket.emit('error', { message: 'Failed to join debate' });
            }
        });

        // ─── SUBMIT ARGUMENT ─────────────────────────────────────────────────
        socket.on('submit_argument', async (data) => {
            try {
                const { debateId, content } = data;
                const debate = await Debate.findById(debateId);

                if (!debate) return socket.emit('error', { message: 'Debate not found' });
                if (debate.status === 'finished') return socket.emit('error', { message: 'Debate already ended' });
                if (debate.status !== 'active') return socket.emit('error', { message: 'Debate not active' });

                const uid = socket.user._id.toString();
                const isProTeam = debate.proTeam.some(p => p.user.toString() === uid);
                const isConTeam = debate.conTeam.some(p => p.user.toString() === uid);

                if (!isProTeam && !isConTeam)
                    return socket.emit('error', { message: 'You are not a participant' });

                const side = isProTeam ? 'pro' : 'con';

                // ── Turn enforcement ──────────────────────────────────────────
                // For team debates: track whose turn among team members
                if (debate.currentSide !== side)
                    return socket.emit('error', { message: 'Not your turn' });

                if (debate.currentTurn && debate.currentTurn.toString() !== uid)
                    return socket.emit('error', { message: 'Not your turn yet! Waiting for teammate.' });

                // For multi-player teams: check if this specific player already spoke in the CURRENT round
                const currentRoundIndex = Math.min(debate.currentRound, debate.rounds.length - 1);
                const currentRound = debate.rounds[currentRoundIndex];
                if (!currentRound) return socket.emit('error', { message: 'Round error' });

                const team = side === 'pro' ? debate.proTeam : debate.conTeam;
                if (team.length > 1) {
                    const alreadySpoke = currentRound.messages.some(
                        m => m.sender.toString() === uid
                    );
                    if (alreadySpoke)
                        return socket.emit('error', { message: 'You already spoke this round' });
                }

                // ── Content validation ────────────────────────────────────────
                const trimmed = content.trim();
                if (trimmed.length < 5)
                    return socket.emit('argument_rejected', { reason: 'Argument too short (min 5 chars).' });
                if (trimmed.length > 2000)
                    return socket.emit('argument_rejected', { reason: 'Argument too long (max 2000 chars).' });

                // ── Save message ──────────────────────────────────────────────
                const message = {
                    sender:    socket.user._id,
                    content:   trimmed,
                    timestamp: new Date(),
                };
                currentRound.messages.push(message);

                // ── Count per-side totals across ALL rounds ───────────────────
                let proTotal = 0, conTotal = 0;
                for (const round of debate.rounds) {
                    for (const msg of round.messages) {
                        const msgSide = debate.proTeam.some(p => p.user.toString() === msg.sender.toString()) ? 'pro' : 'con';
                        if (msgSide === 'pro') proTotal++;
                        else conTotal++;
                    }
                }

                // ── Check if round should advance ─────────────────────────────
                const roundProCount = currentRound.messages.filter(m =>
                    debate.proTeam.some(p => p.user.toString() === m.sender.toString())
                ).length;
                const roundConCount = currentRound.messages.filter(m =>
                    debate.conTeam.some(p => p.user.toString() === m.sender.toString())
                ).length;

                const perTeamSize = Math.max(debate.proTeam.length, 1);
                let roundAdvanced = false;
                if (roundProCount >= perTeamSize && roundConCount >= perTeamSize
                    && debate.currentRound < debate.rounds.length - 1) {
                    debate.currentRound += 1;
                    roundAdvanced = true;
                }

                // ── Switch turns ──────────────────────────────────────────────
                debate.currentSide = side === 'pro' ? 'con' : 'pro';
                debate.turnEndsAt  = new Date(Date.now() + 120000); // 2 min

                const nextTeam = debate.currentSide === 'pro' ? debate.proTeam : debate.conTeam;
                if (nextTeam.length > 0) {
                    if (roundAdvanced) {
                        debate.currentTurn = nextTeam[0].user;
                    } else {
                        const activeRound = debate.rounds[debate.currentRound];
                        const nextTeamMsgsThisRound = activeRound.messages.filter(m =>
                            nextTeam.some(p => p.user.toString() === m.sender.toString())
                        ).length;
                        debate.currentTurn = nextTeam[nextTeamMsgsThisRound % nextTeam.length].user;
                    }
                }

                await debate.save();

                // Broadcast the argument (no per-message AI — saved for batch)
                const msgPayload = {
                    message: {
                        _id:        currentRound.messages[currentRound.messages.length - 1]._id,
                        sender:     socket.user._id,
                        senderName: socket.user.username,
                        content:    trimmed,
                        timestamp:  message.timestamp,
                    },
                    side,
                    nextTurn:   debate.currentSide,
                    nextTurnUser: debate.currentTurn,
                    turnEndsAt: debate.turnEndsAt,
                    messageCount: { pro: proTotal, con: conTotal },
                    total: getMessagesPerSide(debate.type),
                };
                io.to(`debate:${debateId}`).emit('argument_submitted', msgPayload);

                const msgsNeeded = getMessagesPerSide(debate.type);
                console.log(`📝 [${side.toUpperCase()}] ${proTotal}/${msgsNeeded} | CON ${conTotal}/${msgsNeeded}`);

                // ── Check if debate should end ────────────────────────────────
                if (proTotal >= msgsNeeded && conTotal >= msgsNeeded) {
                    console.log('🏁 Both sides done. Running batch AI analysis...');
                    // Reload full debate so we have all messages
                    const freshDebate = await Debate.findById(debateId);
                    await finishDebate(io, freshDebate);
                } else if (roundAdvanced) {
                    io.to(`debate:${debateId}`).emit('round_changed', {
                        roundNumber: debate.currentRound + 1,
                        roundType:   debate.rounds[debate.currentRound]?.type || 'debate',
                        side:        debate.currentSide,
                        nextTurnUser: debate.currentTurn,
                    });
                }
            } catch (error) {
                console.error('submit_argument error:', error);
                socket.emit('error', { message: 'Failed to submit argument' });
            }
        });

        // ─── SPECTATOR CHAT ──────────────────────────────────────────────────
        socket.on('spectator_chat', (data) => {
            try {
                const { debateId, message, isAnonymous } = data;
                const senderName = isAnonymous ? 'Anonymous' : socket.user.username;
                // Basic length check
                if (!message || message.trim().length < 1) return;
                io.to(`debate:${debateId}`).emit('spectator_message', {
                    username:  senderName,
                    message:   message.trim().slice(0, 300),
                    timestamp: new Date(),
                });
            } catch (error) {
                console.error('spectator_chat error:', error);
            }
        });

        // ─── REACTIONS ───────────────────────────────────────────────────────
        socket.on('reaction', (data) => {
            try {
                const { debateId, emoji } = data;
                const allowed = ['🔥', '👏', '💯', '🤔', '😱', '💀'];
                if (!allowed.includes(emoji)) return;
                io.to(`debate:${debateId}`).emit('reaction', { emoji, username: socket.user.username });
            } catch (error) {
                console.error('reaction error:', error);
            }
        });

        // ─── BETTING ─────────────────────────────────────────────────────────
        socket.on('place_bet', async (data) => {
            try {
                const { debateId, side, amount } = data;

                if (!['pro', 'con'].includes(side))
                    return socket.emit('bet_error', { message: 'Invalid side' });

                const amt = parseInt(amount);
                if (isNaN(amt) || amt < 10 || amt > 10000)
                    return socket.emit('bet_error', { message: 'Bet amount must be 10–10,000 XP' });

                const debate = await Debate.findById(debateId);
                if (!debate?.bettingOpen)
                    return socket.emit('bet_error', { message: 'Betting is closed' });

                // Reload user for fresh XP
                const freshUser = await User.findById(socket.user._id);
                if (freshUser.xp < amt)
                    return socket.emit('bet_error', { message: 'Insufficient XP' });




                await User.findByIdAndUpdate(socket.user._id, { $inc: { xp: -amt } });
                const updatedDebate = await Debate.findByIdAndUpdate(debateId, {
                    $inc: { 'bettingPool.total': amt, [`bettingPool.${side}`]: amt },
                }, { new: true });

                // Recalculate live odds
                const odds = updatedDebate.calculateOdds();
                await Debate.findByIdAndUpdate(debateId, { odds });

                socket.emit('bet_placed', { side, amount: amt, newBalance: freshUser.xp - amt });
                io.to(`debate:${debateId}`).emit('betting_update', {
                    pool: updatedDebate.bettingPool,
                    odds,
                });
            } catch (error) {
                console.error('place_bet error:', error);
                socket.emit('bet_error', { message: 'Failed to place bet' });
            }
        });

        // ─── FORFEIT ─────────────────────────────────────────────────────────
        socket.on('forfeit', async (data) => {
            try {
                const { debateId } = data;
                const debate = await Debate.findById(debateId);
                if (!debate || debate.status !== 'active') return;

                const uid = socket.user._id.toString();
                const isProTeam = debate.proTeam.some(p => p.user.toString() === uid);
                const isConTeam = debate.conTeam.some(p => p.user.toString() === uid);
                if (!isProTeam && !isConTeam) return;

                const forfeitSide = isProTeam ? 'pro' : 'con';
                const winnerSide  = forfeitSide === 'pro' ? 'con' : 'pro';

                debate.status    = 'finished';
                debate.endedAt   = new Date();
                debate.bettingOpen = false;
                debate.winner    = {
                    side: winnerSide,
                    team: winnerSide === 'pro' ? debate.proTeam.map(p => p.user) : debate.conTeam.map(p => p.user),
                    score: 100,
                    margin: 100,
                };
                debate.scores    = { pro: { total: forfeitSide === 'pro' ? 0 : 100 }, con: { total: forfeitSide === 'con' ? 0 : 100 } };
                debate.aiSummary = { decisionReasoning: `${forfeitSide.toUpperCase()} side forfeited.` };
                await debate.save();

                await settleBets(debate, winnerSide);
                await distributeXP(debate, winnerSide, 80, 10, 0);

                io.to(`debate:${debateId}`).emit('debate_ended', {
                    debateId:   debate._id,
                    winner:     winnerSide,
                    finalScores:{ pro: debate.scores.pro.total, con: debate.scores.con.total },
                    reasoning:  `${socket.user.username} forfeited the debate.`,
                    forfeit:    true,
                });
            } catch (error) {
                console.error('forfeit error:', error);
            }
        });

        // ─── LEAVE ───────────────────────────────────────────────────────────
        socket.on('leave_debate', (data) => {
            const { debateId } = data;
            socket.leave(`debate:${debateId}`);
            // Don't trigger disconnect handler here — this fires on React
            // cleanup and tab navigation. Only true socket disconnect (browser
            // close / hard refresh) should end the match.
            socket.debateId = null;
        });

        // ─── DISCONNECT ──────────────────────────────────────────────────────
        socket.on('disconnect', async () => {
            console.log(`❌ Disconnected: ${socket.user.username}`);
            userSockets.delete(socket.user._id.toString());
            await User.findByIdAndUpdate(socket.user._id, { isOnline: false });

            if (socket.debateId) {
                const debateId = socket.debateId;
                await Debate.findByIdAndUpdate(debateId, {
                    $inc:  { spectatorCount: -1 },
                    $pull: { spectators: { user: socket.user._id } },
                });
            }

            // Remove from ALL queues by userId (safe across reconnects)
            const uid = socket.user._id.toString();
            for (const [, queue] of matchmakingQueue) {
                const i = queue.findIndex(e => e.userId === uid);
                if (i > -1) queue.splice(i, 1);
            }
        });
    });
};

// ─────────────────────────────────────────────────────────────────────────────
// MATCHMAKING
// ─────────────────────────────────────────────────────────────────────────────
async function tryMatchmaking(io, queueKey, type) {
    const queue = matchmakingQueue.get(queueKey);
    if (!queue) return;

    const required = type === '1v1' ? 2 : type === '2v2' ? 4 : type === '3v3' ? 6 : 2;
    console.log(`📋 Queue "${queueKey}": ${queue.length}/${required}`);

    if (queue.length >= required) {
        const players = queue.splice(0, required);
        const debate  = await createDebate(players, type);
        console.log(`🏆 Match created: ${debate._id}`);

        players.forEach((player, index) => {
            // Always look up the CURRENT socket from userSockets (updated on every connect)
            // The queue entry's socketId may be stale if the user reconnected
            const currentSocketId = userSockets.get(player.userId) || player.socketId;
            const playerSocket = io.sockets.sockets.get(currentSocketId);
            if (playerSocket) {
                const side = index < required / 2 ? 'pro' : 'con';
                const opponent = players.find((_, i) =>
                    (index < required / 2) !== (i < required / 2)
                );
                playerSocket.emit('match_found', {
                    debateId: debate._id,
                    side,
                    topic:    debate.topic,
                    opponent: opponent?.isAnonymous ? opponent.alias : opponent?.username,
                    alias:    player.isAnonymous ? player.alias : null,
                });
                console.log(`✅ match_found sent to ${player.username} (${currentSocketId})`);
            } else {
                console.warn(`⚠️  match_found FAILED for ${player.username} — socket ${currentSocketId} not found`);
            }
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE DEBATE
// ─────────────────────────────────────────────────────────────────────────────
async function createDebate(players, type) {
    const FALLBACK_TOPICS = [
        { title: 'Should social media be regulated by governments?', description: 'Debate the role of government in controlling social media.', category: 'Technology' },
        { title: 'Is remote work better than office work?', description: 'Compare productivity in remote vs office settings.', category: 'Social' },
        { title: 'Should college education be free?', description: 'Pros and cons of free higher education.', category: 'Economy' },
        { title: 'Is AI a threat to human jobs?', description: 'Will AI replace human workers?', category: 'Technology' },
        { title: 'Should voting be mandatory?', description: 'Civic duty vs personal choice.', category: 'Politics' },
        { title: 'Is climate change the biggest threat to humanity?', description: 'The urgency of climate action.', category: 'Science' },
        { title: 'Should smartphones be banned in schools?', description: 'The impact of phones on student learning.', category: 'Social' },
    ];

    let topicData;
    try {
        topicData = await openaiService.generateTopic();
    } catch (err) {
        topicData = FALLBACK_TOPICS[Math.floor(Math.random() * FALLBACK_TOPICS.length)];
    }

    const half    = players.length / 2;
    const proTeam = players.slice(0, half).map(p => ({
        user: p.userId, isAnonymous: p.isAnonymous, alias: p.alias || null, role: 'lead',
    }));
    const conTeam = players.slice(half).map(p => ({
        user: p.userId, isAnonymous: p.isAnonymous, alias: p.alias || null, role: 'lead',
    }));

    // 1v1 uses 5 rounds (1 message/player/round = 5 messages total)
    // 2v2 uses 3 rounds (2 messages/team/round = 6 messages total)
    const is1v1 = type === '1v1';
    const rounds = is1v1
        ? [
            { roundNumber: 1, type: 'opening',  duration: 120, messages: [] },
            { roundNumber: 2, type: 'rebuttal', duration: 90,  messages: [] },
            { roundNumber: 3, type: 'counter',  duration: 60,  messages: [] },
            { roundNumber: 4, type: 'rebuttal', duration: 60,  messages: [] },
            { roundNumber: 5, type: 'closing',  duration: 60,  messages: [] },
        ]
        : [
            { roundNumber: 1, type: 'opening',  duration: 120, messages: [] },
            { roundNumber: 2, type: 'rebuttal', duration: 90,  messages: [] },
            { roundNumber: 3, type: 'closing',  duration: 60,  messages: [] },
        ];

    const validCategories = ['Politics', 'Technology', 'Sports', 'Philosophy', 'Science', 'Entertainment', 'Economy', 'Social', 'General', 'Other'];
    const finalCategory = validCategories.includes(topicData.category) ? topicData.category : 'Other';

    const debate = await Debate.create({
        type,
        topic: { title: topicData.title, description: topicData.description, category: finalCategory },
        proTeam,
        conTeam,
        rounds,
        currentRound: 0,
        currentSide:  'pro',
        currentTurn:  proTeam.length > 0 ? proTeam[0].user : null,
        status:       'active',
        startedAt:    new Date(),
        turnEndsAt:   new Date(Date.now() + 120000),
    });

    activeDebates.set(debate._id.toString(), debate);
    return debate;
}

// ─────────────────────────────────────────────────────────────────────────────
// FINISH DEBATE — single batched AI call
// ─────────────────────────────────────────────────────────────────────────────
async function finishDebate(io, debate) {
    if (debate.status === 'finished') return;

    debate.bettingOpen = false;
    debate.status      = 'finished';
    debate.endedAt     = new Date();

    // Gather all messages per side
    const allMessages  = debate.rounds.flatMap(r => r.messages);
    const proMessages  = allMessages.filter(m =>
        debate.proTeam.some(p => p.user.toString() === m.sender.toString())
    );
    const conMessages  = allMessages.filter(m =>
        debate.conTeam.some(p => p.user.toString() === m.sender.toString())
    );

    console.log(`🤖 Sending ${proMessages.length + conMessages.length} messages to OpenAI for batch analysis...`);

    // Single AI call — covers scoring, fact-checking, moderation, feedback
    let analysis = null;
    if (proMessages.length > 0 || conMessages.length > 0) {
        try {
            analysis = await openaiService.analyzeDebateBatch(
                debate.topic.title,
                proMessages.map((m, i) => ({ index: i + 1, content: m.content })),
                conMessages.map((m, i) => ({ index: i + 1, content: m.content }))
            );
        } catch (err) {
            console.error('Batch AI failed:', err.message);
        }
    }

    // If AI failed, use heuristic fallback
    if (!analysis) {
        console.log('📊 AI unavailable — using smart heuristic fallback...');
        analysis = openaiService.smartFallbackScore(
            proMessages.map(m => ({ content: m.content })),
            conMessages.map(m => ({ content: m.content }))
        );
    }

    const { winner: winnerSide, proScore, conScore, reasoning, feedback, factChecks, moderationFlags, highlights } = analysis;

    // Apply moderation flags retroactively (add warning to users)
    if (moderationFlags?.length > 0) {
        for (const flag of moderationFlags) {
            if (flag.severity === 'high') {
                const team = flag.side === 'pro' ? debate.proTeam : debate.conTeam;
                for (const p of team) {
                    await User.findByIdAndUpdate(p.user, { $inc: { warnings: 1 } });
                    console.log(`⚠️ Moderation warning issued to ${p.user} (${flag.severity})`);
                }
            }
        }
    }

    // Save scores and result to DB
    debate.scores = {
        pro: { total: proScore },
        con: { total: conScore },
    };
    debate.winner = {
        side:   winnerSide,
        team:   winnerSide === 'pro' ? debate.proTeam.map(p => p.user) :
                winnerSide === 'con' ? debate.conTeam.map(p => p.user) : [],
        score:  winnerSide === 'pro' ? proScore : conScore,
        margin: Math.abs(proScore - conScore),
    };
    debate.loserScore = winnerSide === 'pro' ? conScore : proScore;
    debate.aiSummary = {
        decisionReasoning:  reasoning,
        strengthsWeaknesses: feedback
            ? {
                pro: { strengths: feedback.pro?.strengths || [], weaknesses: feedback.pro?.weaknesses || [] },
                con: { strengths: feedback.con?.strengths || [], weaknesses: feedback.con?.weaknesses || [] },
            }
            : { pro: { strengths: [], weaknesses: [] }, con: { strengths: [], weaknesses: [] } },
        keyPoints: {
            pro: highlights?.slice(0, 2) || [],
            con: [],
        },
        factChecks: factChecks || [],
        moderationFlags: moderationFlags || [],
    };

    await debate.save();

    // Distribute XP
    await distributeXP(debate, winnerSide, 100, 25, 50);

    // Settle bets
    try { await settleBets(debate, winnerSide); } catch (e) {
        console.error('Bet settlement error:', e.message);
    }

    // Update category stats
    await updateCategoryStats(debate, winnerSide);

    const resultPayload = {
        debateId:     debate._id,
        winner:       winnerSide,
        finalScores:  { pro: proScore, con: conScore },
        margin:       Math.abs(proScore - conScore),
        reasoning,
        feedback:     feedback || null,
        factChecks:   factChecks || [],
        moderationFlags: moderationFlags || [],
        highlights:   highlights || [],
        xpRewards:    { winner: 100, loser: 25, draw: 50 },
    };

    console.log(`📢 Broadcasting debate_ended for ${debate._id}. Winner: ${winnerSide}`);
    io.to(`debate:${debate._id}`).emit('debate_ended', resultPayload);
    activeDebates.delete(debate._id.toString());
}

// ─────────────────────────────────────────────────────────────────────────────
// XP DISTRIBUTION
// ─────────────────────────────────────────────────────────────────────────────
async function distributeXP(debate, winnerSide, xpWin, xpLose, xpDraw) {
    if (winnerSide !== 'draw') {
        const winners = winnerSide === 'pro' ? debate.proTeam : debate.conTeam;
        const losers  = winnerSide === 'pro' ? debate.conTeam : debate.proTeam;

        for (const p of winners) {
            await User.findByIdAndUpdate(p.user, {
                $inc: { xp: xpWin, reputation: 10, wins: 1, weeklyWins: 1, totalDebates: 1, weeklyDebates: 1, winStreak: 1 },
            });
        }
        for (const p of losers) {
            await User.findByIdAndUpdate(p.user, {
                $inc: { xp: xpLose, losses: 1, totalDebates: 1, weeklyDebates: 1 },
                $set: { winStreak: 0 },
            });
        }
    } else {
        for (const p of [...debate.proTeam, ...debate.conTeam]) {
            await User.findByIdAndUpdate(p.user, {
                $inc: { xp: xpDraw, draws: 1, totalDebates: 1, weeklyDebates: 1 },
            });
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// BET SETTLEMENT
// ─────────────────────────────────────────────────────────────────────────────
async function settleBets(debate, winner) {
    const bets = await Bet.find({ debate: debate._id, result: 'pending' });
    for (const bet of bets) {
        if (winner === 'draw') {
            bet.result = 'refunded'; bet.payout = bet.amount; bet.profit = 0;
        } else if (bet.predictedWinner === winner) {
            const payout = Math.round(bet.amount * (bet.oddsAtBet || 2));
            bet.result = 'won'; bet.payout = payout; bet.profit = payout - bet.amount;
            await User.findByIdAndUpdate(bet.bettor, { $inc: { xp: payout } });
        } else {
            bet.result = 'lost'; bet.payout = 0; bet.profit = -bet.amount;
        }
        bet.settledAt = new Date();
        await bet.save();

        if (winner === 'draw') {
            await User.findByIdAndUpdate(bet.bettor, { $inc: { xp: bet.amount } });
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY STATS UPDATE
// ─────────────────────────────────────────────────────────────────────────────
async function updateCategoryStats(debate, winnerSide) {
    const category = debate.topic.category;
    if (!category) return;

    const updateSide = async (team, isWinner) => {
        for (const p of team) {
            const key = `categoryStats.${category}`;
            await User.findByIdAndUpdate(p.user, {
                $inc: { [`${key}.wins`]: isWinner ? 1 : 0, [`${key}.losses`]: isWinner ? 0 : 1 },
            });
        }
    };

    if (winnerSide !== 'draw') {
        const winners = winnerSide === 'pro' ? debate.proTeam : debate.conTeam;
        const losers  = winnerSide === 'pro' ? debate.conTeam : debate.proTeam;
        await updateSide(winners, true);
        await updateSide(losers, false);
    }
}

export default { initializeSocket };

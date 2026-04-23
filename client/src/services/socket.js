import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;
let currentToken = null;

export const connectSocket = (token) => {
    // If already connected with the SAME token, reuse
    if (socket?.connected && currentToken === token) {
        return socket;
    }

    // Disconnect old socket if switching accounts
    if (socket) {
        socket.disconnect();
        socket = null;
    }

    currentToken = token;

    socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
        console.log('🔌 Socket connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error.message);
    });

    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    currentToken = null;
};

export const getSocket = () => socket;

// Matchmaking
export const joinQueue = (data) => {
    socket?.emit('join_queue', data);
};

export const leaveQueue = (data) => {
    socket?.emit('leave_queue', data);
};

// Debate
export const joinDebate = (debateId) => {
    socket?.emit('join_debate', { debateId });
};

export const submitArgument = (debateId, content) => {
    socket?.emit('submit_argument', { debateId, content });
};

export const requestAssist = (debateId, draft) => {
    socket?.emit('request_assist', { debateId, draft });
};

// Spectator
export const sendSpectatorMessage = (debateId, content, isAnonymous = false) => {
    socket?.emit('spectator_message', { debateId, content, isAnonymous });
};

export const sendReaction = (debateId, type) => {
    socket?.emit('reaction', { debateId, type });
};

// Betting
export const placeBet = (debateId, predictedWinner, amount) => {
    socket?.emit('place_bet', { debateId, predictedWinner, amount });
};

export default {
    connectSocket,
    disconnectSocket,
    getSocket,
    joinQueue,
    leaveQueue,
    joinDebate,
    submitArgument,
    requestAssist,
    sendSpectatorMessage,
    sendReaction,
    placeBet,
};

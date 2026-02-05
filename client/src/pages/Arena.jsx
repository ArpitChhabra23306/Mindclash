import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { joinQueue, leaveQueue, getSocket } from '../services/socket';
import { debateAPI } from '../services/api';
import {
    Swords, Users, Crown, Eye, Shield, Timer,
    Play, Square, Sparkles, Zap, Target, Flame
} from 'lucide-react';

const Arena = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [tab, setTab] = useState('play');
    const [matchType, setMatchType] = useState('1v1');
    const [anonymous, setAnonymous] = useState(false);
    const [inQueue, setInQueue] = useState(false);
    const [queueTime, setQueueTime] = useState(0);
    const [liveDebates, setLiveDebates] = useState([]);
    const [loading, setLoading] = useState(false);

    const matchTypes = [
        {
            type: '1v1',
            title: '1v1 Duel',
            desc: 'Classic head-to-head debate',
            icon: <Swords size={28} />,
            color: '#6366f1'
        },
        {
            type: '2v2',
            title: '2v2 Team',
            desc: 'Team up with a partner',
            icon: <Users size={28} />,
            color: '#8b5cf6'
        },
        {
            type: 'battleRoyale',
            title: 'Battle Royale',
            desc: 'Last debater standing!',
            icon: <Crown size={28} />,
            color: '#f59e0b'
        },
    ];

    useEffect(() => {
        const socket = getSocket();
        if (socket) {
            socket.on('match_found', (data) => {
                setInQueue(false);
                navigate(`/debate/${data.debateId}`);
            });
            socket.on('queue_update', (data) => {
                console.log('Queue update:', data);
            });
        }
        return () => {
            if (socket) {
                socket.off('match_found');
                socket.off('queue_update');
            }
        };
    }, [navigate]);

    useEffect(() => {
        let timer;
        if (inQueue) {
            timer = setInterval(() => setQueueTime(t => t + 1), 1000);
        }
        return () => clearInterval(timer);
    }, [inQueue]);

    useEffect(() => {
        if (tab === 'spectate') {
            fetchLiveDebates();
        }
    }, [tab]);

    const fetchLiveDebates = async () => {
        setLoading(true);
        try {
            const res = await debateAPI.getLive();
            setLiveDebates(res.data?.debates || []);
        } catch (err) {
            console.error('Error fetching debates:', err);
        }
        setLoading(false);
    };

    const handleFindMatch = () => {
        setInQueue(true);
        setQueueTime(0);
        console.log('🎮 Joining queue:', { type: matchType, isAnonymous: anonymous });
        joinQueue({
            type: matchType,
            isAnonymous: anonymous,
        });
    };

    const handleCancelQueue = () => {
        setInQueue(false);
        leaveQueue();
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <Swords size={28} style={{ color: '#6366f1' }} />
                    <span className="text-gradient">Debate Arena</span>
                </h1>
                <p style={{ color: '#737373', fontSize: '14px' }}>
                    Choose your battle mode and show your skills!
                </p>
            </div>

            {/* Tab Switcher */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button
                    onClick={() => setTab('play')}
                    style={{
                        padding: '12px 28px',
                        borderRadius: '50px',
                        fontWeight: '600',
                        fontSize: '15px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        border: tab === 'play' ? 'none' : '1px solid #e5e5e5',
                        background: tab === 'play' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#fff',
                        color: tab === 'play' ? '#fff' : '#525252',
                        boxShadow: tab === 'play' ? '0 4px 12px rgba(99,102,241,0.3)' : 'none',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <Swords size={18} />
                    Play
                </button>
                <button
                    onClick={() => setTab('spectate')}
                    style={{
                        padding: '12px 28px',
                        borderRadius: '50px',
                        fontWeight: '600',
                        fontSize: '15px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        border: tab === 'spectate' ? 'none' : '1px solid #e5e5e5',
                        background: tab === 'spectate' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#fff',
                        color: tab === 'spectate' ? '#fff' : '#525252',
                        boxShadow: tab === 'spectate' ? '0 4px 12px rgba(99,102,241,0.3)' : 'none',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <Eye size={18} />
                    Spectate
                </button>
            </div>

            {tab === 'play' ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
                >
                    {/* Match Types */}
                    <div className="grid-3">
                        {matchTypes.map((match) => (
                            <motion.div
                                key={match.type}
                                onClick={() => !inQueue && setMatchType(match.type)}
                                style={{
                                    background: '#fff',
                                    border: matchType === match.type ? `2px solid ${match.color}` : '1px solid #e5e5e5',
                                    borderRadius: '18px',
                                    padding: '28px',
                                    textAlign: 'center',
                                    cursor: inQueue ? 'not-allowed' : 'pointer',
                                    opacity: inQueue ? 0.5 : 1,
                                    boxShadow: matchType === match.type ? `0 4px 20px ${match.color}20` : 'var(--shadow-sm)',
                                    transition: 'all 0.2s ease'
                                }}
                                whileHover={!inQueue ? { scale: 1.02 } : {}}
                                whileTap={!inQueue ? { scale: 0.98 } : {}}
                            >
                                <div style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '14px',
                                    background: `${match.color}15`,
                                    color: match.color,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 16px'
                                }}>
                                    {match.icon}
                                </div>
                                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#171717', marginBottom: '6px' }}>
                                    {match.title}
                                </h3>
                                <p style={{ fontSize: '13px', color: '#737373' }}>{match.desc}</p>
                            </motion.div>
                        ))}
                    </div>

                    {/* Options */}
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h3 style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            marginBottom: '16px',
                            color: '#171717',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <Shield size={18} style={{ color: '#8b5cf6' }} />
                            Match Options
                        </h3>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '16px',
                            background: '#fafafa',
                            borderRadius: '14px',
                            border: '1px solid #e5e5e5'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <div style={{
                                    width: '44px',
                                    height: '44px',
                                    borderRadius: '12px',
                                    background: '#f5f3ff',
                                    color: '#8b5cf6',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Shield size={20} />
                                </div>
                                <div>
                                    <p style={{ fontWeight: '600', color: '#171717', fontSize: '14px' }}>Anonymous Mode</p>
                                    <p style={{ fontSize: '12px', color: '#737373' }}>
                                        Debate as: <span style={{ fontWeight: '500', color: '#8b5cf6' }}>
                                            {user?.anonymousAlias || 'WiseThinker_' + Math.floor(Math.random() * 1000)}
                                        </span>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => !inQueue && setAnonymous(!anonymous)}
                                disabled={inQueue}
                                className={`toggle ${anonymous ? 'active' : ''}`}
                                style={{ opacity: inQueue ? 0.5 : 1 }}
                            />
                        </div>
                    </div>

                    {/* Queue / Find Match */}
                    <div style={{ textAlign: 'center' }}>
                        <AnimatePresence mode="wait">
                            {inQueue ? (
                                <motion.div
                                    key="queue"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    style={{ display: 'inline-block' }}
                                >
                                    <div className="glass-card" style={{ padding: '32px' }}>
                                        <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                                        <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px', color: '#171717' }}>
                                            Finding Match...
                                        </h3>
                                        <p className="text-gradient" style={{ fontSize: '32px', fontWeight: '700', marginBottom: '16px' }}>
                                            {formatTime(queueTime)}
                                        </p>
                                        <p style={{ color: '#737373', marginBottom: '20px', fontSize: '14px' }}>
                                            Searching for worthy opponents 🔍
                                        </p>
                                        <button onClick={handleCancelQueue} className="btn-secondary">
                                            <Square size={16} />
                                            Cancel
                                        </button>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.button
                                    key="find"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    onClick={handleFindMatch}
                                    className="btn-primary"
                                    style={{ fontSize: '18px', padding: '18px 48px' }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <Swords size={22} />
                                    Find Match
                                    <Flame size={22} />
                                </motion.button>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            ) : (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h2 style={{
                            fontSize: '18px',
                            fontWeight: '600',
                            color: '#171717',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <span style={{
                                width: '8px',
                                height: '8px',
                                background: '#ef4444',
                                borderRadius: '50%'
                            }}></span>
                            Live Debates
                        </h2>
                        <button onClick={fetchLiveDebates} className="btn-secondary" style={{ fontSize: '13px', padding: '8px 16px' }}>
                            Refresh
                        </button>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                            <div className="spinner"></div>
                        </div>
                    ) : liveDebates.length > 0 ? (
                        <div className="grid-2">
                            {liveDebates.map((debate, i) => (
                                <motion.div
                                    key={debate._id || i}
                                    className="glass-card"
                                    style={{ cursor: 'pointer' }}
                                    whileHover={{ scale: 1.01 }}
                                    onClick={() => navigate(`/debate/${debate._id}`)}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                        <span className="live-indicator">LIVE</span>
                                        <span style={{ fontSize: '13px', color: '#737373' }}>
                                            <Eye size={14} style={{ display: 'inline', marginRight: '4px' }} />
                                            {debate.spectatorCount || 0} watching
                                        </span>
                                    </div>
                                    <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#171717', marginBottom: '12px' }}>
                                        {debate.topic?.title || 'Debate in Progress'}
                                    </h3>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span className="badge badge-primary">{debate.type}</span>
                                        <button className="btn-primary" style={{ fontSize: '13px', padding: '8px 16px' }}>
                                            Watch →
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
                            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>🎬</div>
                            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#171717', marginBottom: '8px' }}>
                                No Live Debates
                            </h3>
                            <p style={{ color: '#737373', marginBottom: '20px', fontSize: '14px' }}>
                                Start a debate to be the first one live!
                            </p>
                            <button onClick={() => setTab('play')} className="btn-primary">
                                <Play size={16} />
                                Start Debating
                            </button>
                        </div>
                    )}
                </motion.div>
            )}
        </div>
    );
};

export default Arena;

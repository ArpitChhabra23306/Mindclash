import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { debateAPI, topicAPI } from '../services/api';
import {
    Swords, Eye, Trophy, Flame, Users, Target,
    Zap, Star, Sparkles, TrendingUp, Play, Crown
} from 'lucide-react';

const Dashboard = () => {
    const { user } = useAuth();
    const [liveDebates, setLiveDebates] = useState([]);
    const [trendingTopics, setTrendingTopics] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [debatesRes, topicsRes] = await Promise.all([
                    debateAPI.getLive().catch(() => ({ data: { debates: [] } })),
                    topicAPI.getTrending().catch(() => ({ data: { topics: [] } })),
                ]);
                setLiveDebates(debatesRes.data?.debates || []);
                setTrendingTopics(topicsRes.data?.topics || []);
            } catch (err) {
                console.error('Error fetching data:', err);
            }
            setLoading(false);
        };
        fetchData();
    }, []);

    const stats = [
        { label: 'Total Debates', value: user?.totalDebates || 0, icon: <Swords size={20} />, color: '#6366f1' },
        { label: 'Wins', value: user?.wins || 0, icon: <Trophy size={20} />, color: '#10b981' },
        { label: 'Win Rate', value: `${user?.totalDebates > 0 ? Math.round((user.wins / user.totalDebates) * 100) : 0}%`, icon: <TrendingUp size={20} />, color: '#3b82f6' },
        { label: 'Current XP', value: user?.xp || 0, icon: <Zap size={20} />, color: '#f59e0b' },
    ];

    const quickActions = [
        {
            title: 'Quick Match',
            desc: 'Jump into a 1v1 debate!',
            icon: <Swords size={24} />,
            color: '#6366f1',
            link: '/arena'
        },
        {
            title: 'Spectate',
            desc: 'Watch live debates',
            icon: <Eye size={24} />,
            color: '#3b82f6',
            link: '/arena?tab=spectate'
        },
        {
            title: 'Leaderboard',
            desc: 'Check the rankings',
            icon: <Trophy size={24} />,
            color: '#f59e0b',
            link: '/leaderboard'
        },
    ];

    const getTierConfig = (tier) => {
        const configs = {
            'Novice': { emoji: '🌱', color: '#737373' },
            'Debater': { emoji: '💚', color: '#10b981' },
            'Skilled': { emoji: '⭐', color: '#f59e0b' },
            'Expert': { emoji: '🔥', color: '#f97316' },
            'Master': { emoji: '💎', color: '#ef4444' },
            'Grandmaster': { emoji: '👑', color: '#8b5cf6' },
            'Legend': { emoji: '🌟', color: '#6366f1' },
        };
        return configs[tier] || configs['Novice'];
    };

    const tierConfig = getTierConfig(user?.tier);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Welcome Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card"
                style={{ padding: '24px' }}
            >
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px'
                }}>
                    <div>
                        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#171717', marginBottom: '8px' }}>
                            Hey, <span className="text-gradient">{user?.username}</span>! 👋
                        </h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <span style={{
                                padding: '6px 14px',
                                borderRadius: '50px',
                                fontWeight: '600',
                                background: '#f5f5f5',
                                color: tierConfig.color,
                                border: '1px solid #e5e5e5',
                                fontSize: '14px'
                            }}>
                                {tierConfig.emoji} {user?.tier || 'Novice'}
                            </span>
                            <span style={{ color: '#737373', fontSize: '14px' }}>
                                Level {user?.level || 1}
                            </span>
                        </div>
                    </div>
                    <Link to="/arena">
                        <motion.button
                            className="btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <Flame size={18} />
                            Start Debating!
                        </motion.button>
                    </Link>
                </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid-4">
                {stats.map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="stat-card"
                    >
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            background: `${stat.color}15`,
                            color: stat.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 12px'
                        }}>
                            {stat.icon}
                        </div>
                        <div className="stat-value" style={{ color: stat.color }}>{stat.value}</div>
                        <div className="stat-label">{stat.label}</div>
                    </motion.div>
                ))}
            </div>

            {/* Quick Actions */}
            <div>
                <h2 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    marginBottom: '16px',
                    color: '#171717',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <Sparkles size={18} style={{ color: '#f59e0b' }} />
                    Quick Actions
                </h2>
                <div className="grid-3">
                    {quickActions.map((action, i) => (
                        <Link key={i} to={action.link} style={{ textDecoration: 'none' }}>
                            <motion.div
                                className="action-card"
                                whileHover={{ scale: 1.02, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '12px',
                                    background: `${action.color}15`,
                                    color: action.color,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {action.icon}
                                </div>
                                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#171717' }}>{action.title}</h3>
                                <p style={{ fontSize: '13px', color: '#737373' }}>{action.desc}</p>
                            </motion.div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Live Debates & Trending */}
            <div className="grid-2">
                {/* Live Debates */}
                <div className="glass-card">
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '16px'
                    }}>
                        <h2 style={{
                            fontSize: '16px',
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
                                borderRadius: '50%',
                                animation: 'pulse-live 2s ease-in-out infinite'
                            }}></span>
                            Live Debates
                        </h2>
                        <Link to="/arena?tab=spectate" style={{
                            color: '#6366f1',
                            fontSize: '13px',
                            fontWeight: '500',
                            textDecoration: 'none'
                        }}>
                            View All →
                        </Link>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
                            <div className="spinner"></div>
                        </div>
                    ) : liveDebates.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {liveDebates.slice(0, 3).map((debate, i) => (
                                <Link key={i} to={`/debate/${debate._id}`} style={{ textDecoration: 'none' }}>
                                    <motion.div
                                        style={{
                                            padding: '14px',
                                            borderRadius: '12px',
                                            background: '#fafafa',
                                            border: '1px solid #e5e5e5',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between'
                                        }}
                                        whileHover={{ x: 4, borderColor: '#d4d4d4' }}
                                    >
                                        <div>
                                            <p style={{ fontWeight: '500', color: '#171717', fontSize: '14px' }}>
                                                {debate.topic?.title || 'Live Debate'}
                                            </p>
                                            <p style={{ fontSize: '12px', color: '#737373' }}>
                                                {debate.type} • {debate.spectatorCount || 0} watching
                                            </p>
                                        </div>
                                        <span className="live-indicator">LIVE</span>
                                    </motion.div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state" style={{ padding: '32px' }}>
                            <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.5 }}>🎮</div>
                            <p style={{ fontSize: '14px', color: '#737373', marginBottom: '16px' }}>No live debates right now</p>
                            <Link to="/arena" className="btn-primary" style={{ fontSize: '13px', padding: '10px 16px' }}>
                                <Play size={14} />
                                Start One
                            </Link>
                        </div>
                    )}
                </div>

                {/* Trending Topics */}
                <div className="glass-card">
                    <div style={{ marginBottom: '16px' }}>
                        <h2 style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#171717',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <Flame size={16} style={{ color: '#f59e0b' }} />
                            Trending Topics
                        </h2>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
                            <div className="spinner"></div>
                        </div>
                    ) : trendingTopics.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {trendingTopics.slice(0, 5).map((topic, i) => (
                                <motion.div
                                    key={i}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '12px',
                                        background: '#fafafa',
                                        border: '1px solid #e5e5e5'
                                    }}
                                    whileHover={{ x: 4 }}
                                >
                                    <p style={{ fontWeight: '500', color: '#171717', fontSize: '14px' }}>{topic.title}</p>
                                    <p style={{ fontSize: '12px', color: '#737373' }}>
                                        {topic.category} • {topic.debateCount || 0} debates
                                    </p>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state" style={{ padding: '32px' }}>
                            <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.5 }}>💭</div>
                            <p style={{ fontSize: '14px', color: '#737373' }}>No trending topics yet</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

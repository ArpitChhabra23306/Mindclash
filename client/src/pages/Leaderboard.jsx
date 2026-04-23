import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { leaderboardAPI } from '../services/api';
import { Trophy, Crown, Medal, TrendingUp, Users, Flame, Star, Zap } from 'lucide-react';

const Leaderboard = () => {
    const [tab, setTab] = useState('global');
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLeaderboard();
    }, [tab]);

    const fetchLeaderboard = async () => {
        setLoading(true);
        try {
            let res;
            if (tab === 'global') {
                res = await leaderboardAPI.getGlobal();
            } else if (tab === 'weekly') {
                res = await leaderboardAPI.getWeekly();
            } else {
                res = await leaderboardAPI.getAnonymous();
            }
            setLeaderboard(res.data?.leaderboard || []);
        } catch (err) {
            console.error('Error fetching leaderboard:', err);
            setLeaderboard([]);
        }
        setLoading(false);
    };

    const tabs = [
        { id: 'global', label: 'All Time', icon: <Trophy size={16} /> },
        { id: 'weekly', label: 'This Week', icon: <TrendingUp size={16} /> },
        { id: 'anonymous', label: 'Anonymous', icon: <Users size={16} /> },
    ];

    const getRankStyle = (rank) => {
        if (rank === 1) return { bg: 'linear-gradient(135deg, #fcd34d, #fbbf24)', color: '#92400e' };
        if (rank === 2) return { bg: 'linear-gradient(135deg, #e5e7eb, #d1d5db)', color: '#374151' };
        if (rank === 3) return { bg: 'linear-gradient(135deg, #fed7aa, #fdba74)', color: '#9a3412' };
        return { bg: '#f5f5f5', color: '#737373' };
    };

    const getRankEmoji = (rank) => {
        if (rank === 1) return '👑';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return rank;
    };

    const getTierConfig = (tier) => {
        const configs = {
            'Novice': { emoji: '🌱', color: '#737373' },
            'Debater': { emoji: '💚', color: '#10b981' },
            'Skilled': { emoji: '⭐', color: '#f59e0b' },
            'Expert': { emoji: '🔥', color: '#f97316' },
            'Master': { emoji: '💎', color: '#ef4444' },
            'Grandmaster': { emoji: '👑', color: '#8b5cf6' },
            'Legend': { emoji: '🌟', color: '#6366f1' }
        };
        return configs[tier] || configs['Novice'];
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <Trophy size={28} style={{ color: '#f59e0b' }} />
                    <span className="text-gradient">Leaderboard</span>
                </h1>
                <p style={{ color: '#737373', fontSize: '14px' }}>
                    The greatest debaters in the arena!
                </p>
            </div>

            {/* Tab Switcher */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '50px',
                            fontWeight: '500',
                            fontSize: '14px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            border: tab === t.id ? 'none' : '1px solid #e5e5e5',
                            background: tab === t.id ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#fff',
                            color: tab === t.id ? '#fff' : '#525252',
                            boxShadow: tab === t.id ? '0 4px 12px rgba(99,102,241,0.3)' : 'none',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {t.icon}
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Leaderboard */}
            <div className="glass-card" style={{ padding: '24px' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                        <div className="spinner"></div>
                    </div>
                ) : leaderboard.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {leaderboard.map((user, i) => {
                            const rank = i + 1;
                            const isTop3 = rank <= 3;
                            const rankStyle = getRankStyle(rank);
                            const tierConfig = getTierConfig(user.tier);

                            return (
                                <motion.div
                                    key={user._id || i}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    style={{
                                        background: isTop3 ? '#fffbeb' : '#fff',
                                        border: isTop3 ? '1px solid #fcd34d' : '1px solid #e5e5e5',
                                        borderRadius: '14px',
                                        padding: '16px 20px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '16px'
                                    }}
                                >
                                    {/* Rank */}
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '10px',
                                        background: rankStyle.bg,
                                        color: rankStyle.color,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: '700',
                                        fontSize: isTop3 ? '16px' : '14px'
                                    }}>
                                        {isTop3 ? getRankEmoji(rank) : rank}
                                    </div>

                                    {/* User Info */}
                                    <div style={{ flex: 1 }}>
                                        <Link
                                            to={`/profile/${user.username}`}
                                            style={{
                                                fontWeight: '600',
                                                fontSize: '15px',
                                                color: '#171717',
                                                textDecoration: 'none'
                                            }}
                                        >
                                            {user.username || user.anonymousAlias}
                                        </Link>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#737373' }}>
                                            <span style={{ color: tierConfig.color }}>
                                                {tierConfig.emoji} {user.tier}
                                            </span>
                                            <span>•</span>
                                            <span>{user.wins || 0}W - {user.losses || 0}L</span>
                                        </div>
                                    </div>

                                    {/* XP */}
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Zap size={18} style={{ color: '#f59e0b' }} />
                                            <span className="text-gradient" style={{ fontSize: '18px', fontWeight: '700' }}>
                                                {(user.xp || user.reputation || 0).toLocaleString()}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#a3a3a3' }}>
                                            {tab === 'anonymous' ? 'Rep' : 'XP'}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{ padding: '48px', textAlign: 'center' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>🏆</div>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#171717', marginBottom: '8px' }}>
                            No Rankings Yet
                        </h3>
                        <p style={{ color: '#737373', marginBottom: '20px', fontSize: '14px' }}>
                            Be the first to climb the ranks!
                        </p>
                        <Link to="/arena" className="btn-primary">
                            <Flame size={16} />
                            Start Debating
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Leaderboard;

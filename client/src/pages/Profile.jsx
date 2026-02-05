import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../services/api';
import {
    Trophy, Award, Users, Swords, Target, TrendingUp,
    Calendar, Star, Zap, Crown, Heart, UserPlus, UserMinus
} from 'lucide-react';

const Profile = () => {
    const { username } = useParams();
    const { user: currentUser } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isFollowing, setIsFollowing] = useState(false);

    const isOwnProfile = currentUser?.username === username;

    useEffect(() => {
        fetchProfile();
    }, [username]);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const res = await userAPI.getProfile(username);
            setProfile(res.data?.user);
            setIsFollowing(res.data?.isFollowing || false);
        } catch (err) {
            console.error('Error fetching profile:', err);
            setProfile({
                username,
                tier: 'Expert',
                level: 15,
                xp: 4500,
                reputation: 1200,
                totalDebates: 47,
                wins: 32,
                losses: 12,
                draws: 3,
                winStreak: 5,
                bestStreak: 8,
                followers: 128,
                following: 45,
                achievements: [
                    { name: 'First Win', icon: '🏆', description: 'Win your first debate' },
                    { name: 'Hot Streak', icon: '🔥', description: 'Win 5 debates in a row' },
                    { name: 'Fact Master', icon: '📊', description: 'Get 10 facts verified' },
                ],
                bio: 'Love debating about tech, philosophy, and current events! Always up for a challenge 🎮',
                joinedAt: '2024-01-15T00:00:00Z',
            });
        }
        setLoading(false);
    };

    const handleFollow = async () => {
        try {
            if (isFollowing) {
                await userAPI.unfollow(username);
            } else {
                await userAPI.follow(username);
            }
            setIsFollowing(!isFollowing);
        } catch (err) {
            console.error('Error following user:', err);
        }
    };

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

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>👤</div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#171717', marginBottom: '8px' }}>
                    User Not Found
                </h3>
                <p style={{ color: '#737373', fontSize: '14px' }}>
                    This user doesn't exist
                </p>
            </div>
        );
    }

    const tierConfig = getTierConfig(profile.tier);
    const winRate = profile.totalDebates > 0
        ? Math.round((profile.wins / profile.totalDebates) * 100)
        : 0;

    const stats = [
        { label: 'Total Debates', value: profile.totalDebates, icon: <Swords size={20} />, color: '#6366f1' },
        { label: 'Wins', value: profile.wins, icon: <Trophy size={20} />, color: '#10b981' },
        { label: 'Win Rate', value: `${winRate}%`, icon: <TrendingUp size={20} />, color: '#3b82f6' },
        { label: 'Best Streak', value: profile.bestStreak, icon: <Target size={20} />, color: '#f59e0b' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Profile Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card"
                style={{ padding: '32px' }}
            >
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '24px',
                    alignItems: 'center'
                }}>
                    {/* Avatar */}
                    <div style={{ position: 'relative' }}>
                        <div style={{
                            width: '100px',
                            height: '100px',
                            borderRadius: '24px',
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '48px',
                            boxShadow: '0 8px 20px rgba(99,102,241,0.3)'
                        }}>
                            {tierConfig.emoji}
                        </div>
                        <div style={{
                            position: 'absolute',
                            bottom: '-8px',
                            right: '-8px',
                            padding: '4px 12px',
                            borderRadius: '50px',
                            background: '#fff',
                            border: '1px solid #e5e5e5',
                            fontWeight: '600',
                            fontSize: '12px',
                            color: '#171717'
                        }}>
                            Lv.{profile.level}
                        </div>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1 }}>
                        <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#171717', marginBottom: '8px' }}>
                            {profile.username}
                        </h1>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <span style={{
                                padding: '6px 14px',
                                borderRadius: '50px',
                                fontWeight: '600',
                                fontSize: '13px',
                                background: '#f5f5f5',
                                color: tierConfig.color,
                                border: '1px solid #e5e5e5'
                            }}>
                                {tierConfig.emoji} {profile.tier}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#737373', fontSize: '13px' }}>
                                <Calendar size={14} />
                                Joined {new Date(profile.joinedAt).toLocaleDateString()}
                            </span>
                        </div>
                        {profile.bio && (
                            <p style={{ color: '#737373', fontSize: '14px', marginBottom: '16px' }}>{profile.bio}</p>
                        )}

                        {/* Social Stats */}
                        <div style={{ display: 'flex', gap: '24px' }}>
                            <div>
                                <p className="text-gradient" style={{ fontSize: '20px', fontWeight: '700' }}>
                                    {profile.followers || 0}
                                </p>
                                <p style={{ fontSize: '12px', color: '#737373' }}>Followers</p>
                            </div>
                            <div>
                                <p className="text-gradient" style={{ fontSize: '20px', fontWeight: '700' }}>
                                    {profile.following || 0}
                                </p>
                                <p style={{ fontSize: '12px', color: '#737373' }}>Following</p>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    {!isOwnProfile && (
                        <motion.button
                            onClick={handleFollow}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '12px 24px',
                                borderRadius: '50px',
                                fontWeight: '600',
                                fontSize: '14px',
                                cursor: 'pointer',
                                border: isFollowing ? '1px solid #e5e5e5' : 'none',
                                background: isFollowing ? '#fff' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: isFollowing ? '#525252' : '#fff',
                                transition: 'all 0.2s ease'
                            }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            {isFollowing ? (
                                <>
                                    <UserMinus size={16} />
                                    Unfollow
                                </>
                            ) : (
                                <>
                                    <UserPlus size={16} />
                                    Follow
                                </>
                            )}
                        </motion.button>
                    )}
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

            {/* XP & Reputation */}
            <div className="grid-2">
                <div className="glass-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                            width: '52px',
                            height: '52px',
                            borderRadius: '14px',
                            background: '#fffbeb',
                            color: '#f59e0b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Zap size={24} />
                        </div>
                        <div>
                            <p style={{ fontSize: '12px', color: '#737373', fontWeight: '500' }}>Experience Points</p>
                            <p className="text-gradient" style={{ fontSize: '24px', fontWeight: '700' }}>
                                {(profile.xp || 0).toLocaleString()} XP
                            </p>
                        </div>
                    </div>
                </div>
                <div className="glass-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                            width: '52px',
                            height: '52px',
                            borderRadius: '14px',
                            background: '#f5f3ff',
                            color: '#8b5cf6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Star size={24} />
                        </div>
                        <div>
                            <p style={{ fontSize: '12px', color: '#737373', fontWeight: '500' }}>Reputation</p>
                            <p className="text-gradient" style={{ fontSize: '24px', fontWeight: '700' }}>
                                {(profile.reputation || 0).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Achievements */}
            {profile.achievements && profile.achievements.length > 0 && (
                <div className="glass-card" style={{ padding: '24px' }}>
                    <h2 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        marginBottom: '16px',
                        color: '#171717',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <Award size={18} style={{ color: '#f59e0b' }} />
                        Achievements
                    </h2>
                    <div className="grid-3">
                        {profile.achievements.map((achievement, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.1 }}
                                style={{
                                    padding: '20px',
                                    borderRadius: '16px',
                                    background: '#fffbeb',
                                    border: '1px solid #fcd34d'
                                }}
                            >
                                <div style={{ fontSize: '32px', marginBottom: '8px' }}>{achievement.icon}</div>
                                <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#171717', marginBottom: '4px' }}>
                                    {achievement.name}
                                </h3>
                                <p style={{ fontSize: '12px', color: '#737373' }}>{achievement.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;

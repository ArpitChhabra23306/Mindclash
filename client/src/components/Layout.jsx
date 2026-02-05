import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
    Home, Swords, Trophy, ShoppingBag, User, Menu, X, LogOut,
    Zap
} from 'lucide-react';

const Layout = () => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const navItems = [
        { path: '/dashboard', label: 'Home', icon: Home },
        { path: '/arena', label: 'Arena', icon: Swords },
        { path: '/leaderboard', label: 'Rankings', icon: Trophy },
        { path: '/marketplace', label: 'Shop', icon: ShoppingBag },
    ];

    const isActive = (path) => location.pathname === path;

    const getTierColor = (tier) => {
        const colors = {
            'Novice': '#737373',
            'Debater': '#10b981',
            'Skilled': '#f59e0b',
            'Expert': '#f97316',
            'Master': '#ef4444',
            'Grandmaster': '#8b5cf6',
            'Legend': '#6366f1'
        };
        return colors[tier] || '#737373';
    };

    return (
        <div style={{ minHeight: '100vh', background: '#fafafa' }}>
            {/* Header */}
            <header style={{
                background: '#fff',
                borderBottom: '1px solid #e5e5e5',
                padding: '12px 24px',
                position: 'sticky',
                top: 0,
                zIndex: 100
            }}>
                <div style={{
                    maxWidth: '1200px',
                    margin: '0 auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                        {/* Logo */}
                        <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '10px',
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <span style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>DV</span>
                            </div>
                            <span style={{ fontSize: '18px', fontWeight: '700', color: '#171717' }}>DebateVerse</span>
                        </Link>

                        {/* Desktop Nav */}
                        <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }} className="hidden-mobile">
                            {navItems.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 14px',
                                        borderRadius: '10px',
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        textDecoration: 'none',
                                        background: isActive(item.path) ? '#f5f5f5' : 'transparent',
                                        color: isActive(item.path) ? '#171717' : '#737373',
                                        border: isActive(item.path) ? '1px solid #e5e5e5' : '1px solid transparent',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <item.icon style={{ width: '16px', height: '16px' }} />
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                    </div>

                    {/* Right Side */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* XP Display */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            borderRadius: '50px',
                            background: '#fffbeb',
                            border: '1px solid #fcd34d',
                            fontWeight: '600',
                            fontSize: '14px',
                            color: '#f59e0b'
                        }}>
                            <Zap style={{ width: '16px', height: '16px' }} />
                            <span>{user?.xp?.toLocaleString() || 0}</span>
                        </div>

                        {/* User Menu */}
                        <Link
                            to={`/profile/${user?.username}`}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 14px',
                                borderRadius: '12px',
                                background: '#fff',
                                border: '1px solid #e5e5e5',
                                textDecoration: 'none',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                fontWeight: '600',
                                fontSize: '13px'
                            }}>
                                {user?.username?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div className="hidden-mobile">
                                <span style={{ display: 'block', fontWeight: '500', color: '#171717', fontSize: '14px' }}>
                                    {user?.username}
                                </span>
                                <span style={{ display: 'block', fontSize: '11px', color: getTierColor(user?.tier) }}>
                                    {user?.tier || 'Novice'}
                                </span>
                            </div>
                        </Link>

                        {/* Logout */}
                        <button
                            onClick={logout}
                            style={{
                                padding: '8px',
                                borderRadius: '8px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#a3a3a3',
                                transition: 'all 0.2s ease'
                            }}
                            title="Logout"
                        >
                            <LogOut style={{ width: '18px', height: '18px' }} />
                        </button>

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="hidden-desktop"
                            style={{
                                padding: '8px',
                                borderRadius: '8px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            {mobileMenuOpen ?
                                <X style={{ width: '20px', height: '20px' }} /> :
                                <Menu style={{ width: '20px', height: '20px' }} />
                            }
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Menu */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="hidden-desktop"
                        style={{
                            background: '#fff',
                            borderBottom: '1px solid #e5e5e5',
                            padding: '16px 24px'
                        }}
                    >
                        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {navItems.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setMobileMenuOpen(false)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '12px 16px',
                                        borderRadius: '10px',
                                        fontSize: '15px',
                                        fontWeight: '500',
                                        textDecoration: 'none',
                                        background: isActive(item.path) ? '#f5f5f5' : 'transparent',
                                        color: isActive(item.path) ? '#171717' : '#737373'
                                    }}
                                >
                                    <item.icon style={{ width: '18px', height: '18px' }} />
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content - CENTERED */}
            <main style={{
                width: '100%',
                maxWidth: '1200px',
                marginLeft: 'auto',
                marginRight: 'auto',
                padding: '24px'
            }}>
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;

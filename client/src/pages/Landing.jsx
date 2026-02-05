import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Swords, Users, Trophy, Sparkles, Eye, Brain,
    Zap, Shield, Crown, ArrowRight, ChevronRight
} from 'lucide-react';

const Landing = () => {
    const features = [
        {
            icon: <Swords className="w-6 h-6" />,
            title: 'Real-Time Battles',
            description: '1v1, 2v2, and Battle Royale modes with live AI scoring',
            iconBg: 'bg-rose-50 text-rose-500'
        },
        {
            icon: <Shield className="w-6 h-6" />,
            title: 'Anonymous Mode',
            description: 'Debate freely with AI-generated secret identities',
            iconBg: 'bg-violet-50 text-violet-500'
        },
        {
            icon: <Brain className="w-6 h-6" />,
            title: 'AI-Powered',
            description: 'Gemini AI moderates, fact-checks, and scores every argument',
            iconBg: 'bg-sky-50 text-sky-500'
        },
        {
            icon: <Eye className="w-6 h-6" />,
            title: 'Spectate & Bet',
            description: 'Watch live debates and bet XP on your favorite debaters',
            iconBg: 'bg-amber-50 text-amber-500'
        },
        {
            icon: <Users className="w-6 h-6" />,
            title: 'Communities',
            description: 'Join topic-based groups and compete in tournaments',
            iconBg: 'bg-emerald-50 text-emerald-500'
        },
        {
            icon: <Trophy className="w-6 h-6" />,
            title: 'Climb the Ranks',
            description: 'From Novice to Legend - prove your debate skills',
            iconBg: 'bg-indigo-50 text-indigo-500'
        },
    ];

    const stats = [
        { value: '10K+', label: 'Debaters' },
        { value: '50K+', label: 'Debates' },
        { value: '1M+', label: 'Arguments' },
        { value: '99%', label: 'Fun Level' },
    ];

    const steps = [
        { step: 1, title: 'Join Arena', desc: 'Pick 1v1, 2v2, or Battle Royale' },
        { step: 2, title: 'Get Matched', desc: 'Find opponents at your skill level' },
        { step: 3, title: 'Debate!', desc: 'AI scores your arguments live' },
        { step: 4, title: 'Win XP', desc: 'Climb ranks and flex your skills' },
    ];

    return (
        <div style={{ minHeight: '100vh', background: '#fff' }}>
            {/* Navbar */}
            <nav className="navbar" style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'white' }}>DV</span>
                    </div>
                    <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#171717' }}>DebateVerse</span>
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Link to="/login" className="btn-secondary" style={{ fontSize: '14px', padding: '10px 20px' }}>
                        Login
                    </Link>
                    <Link to="/register" className="btn-primary" style={{ fontSize: '14px', padding: '10px 20px' }}>
                        Get Started
                        <ArrowRight style={{ width: '16px', height: '16px' }} />
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <section style={{ padding: '80px 24px', background: '#fff' }}>
                <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        {/* Badge */}
                        <div className="badge badge-primary" style={{ marginBottom: '24px' }}>
                            <Sparkles style={{ width: '14px', height: '14px' }} />
                            The Ultimate Debate Arena
                        </div>

                        {/* Main Heading */}
                        <h1 style={{
                            fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
                            fontWeight: '700',
                            color: '#171717',
                            marginBottom: '16px',
                            lineHeight: '1.2'
                        }}>
                            Welcome to
                            <span className="text-gradient" style={{ display: 'block', marginTop: '8px' }}>DebateVerse</span>
                        </h1>

                        <p style={{
                            fontSize: '18px',
                            color: '#737373',
                            maxWidth: '600px',
                            margin: '0 auto 40px',
                            lineHeight: '1.7'
                        }}>
                            Challenge opponents anonymously, let AI score your arguments in real-time,
                            bet XP on winners, and climb the global leaderboard.
                        </p>

                        {/* CTA Buttons */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px', marginBottom: '60px' }}>
                            <Link to="/register">
                                <motion.button
                                    className="btn-primary"
                                    style={{ fontSize: '16px', padding: '14px 32px' }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    Enter the Arena
                                    <Zap style={{ width: '18px', height: '18px' }} />
                                </motion.button>
                            </Link>
                            <Link to="/leaderboard">
                                <motion.button
                                    className="btn-secondary"
                                    style={{ fontSize: '16px', padding: '14px 32px' }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <Crown style={{ width: '18px', height: '18px', color: '#f59e0b' }} />
                                    View Leaderboard
                                </motion.button>
                            </Link>
                        </div>
                    </motion.div>

                    {/* Stats */}
                    <motion.div
                        className="grid-4"
                        style={{ maxWidth: '700px', margin: '0 auto' }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        {stats.map((stat, i) => (
                            <div key={i} className="stat-card">
                                <div className="stat-value">{stat.value}</div>
                                <div className="stat-label">{stat.label}</div>
                            </div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* Features Section */}
            <section style={{ padding: '80px 24px', background: '#fafafa' }}>
                <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                    <motion.div
                        style={{ textAlign: 'center', marginBottom: '56px' }}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.25rem)', fontWeight: '700', color: '#171717', marginBottom: '12px' }}>
                            Why <span className="text-gradient">DebateVerse</span>?
                        </h2>
                        <p style={{ fontSize: '16px', color: '#737373', maxWidth: '500px', margin: '0 auto' }}>
                            The most advanced AI-powered debate platform on the internet
                        </p>
                    </motion.div>

                    <div className="grid-3">
                        {features.map((feature, i) => (
                            <motion.div
                                key={i}
                                className="feature-card"
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <div className={`feature-icon ${feature.iconBg}`}>
                                    {feature.icon}
                                </div>
                                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#171717', marginBottom: '8px' }}>
                                    {feature.title}
                                </h3>
                                <p style={{ fontSize: '14px', color: '#737373', lineHeight: '1.6' }}>
                                    {feature.description}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section style={{ padding: '80px 24px', background: '#fff' }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
                    <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.25rem)', fontWeight: '700', color: '#171717', marginBottom: '56px' }}>
                        How It Works
                    </h2>

                    <div className="grid-4">
                        {steps.map((item, i) => (
                            <motion.div
                                key={i}
                                className="glass-card"
                                style={{ textAlign: 'center', position: 'relative' }}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    color: 'white',
                                    fontWeight: '700',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 16px',
                                    fontSize: '14px'
                                }}>
                                    {item.step}
                                </div>
                                <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#171717', marginBottom: '8px' }}>{item.title}</h3>
                                <p style={{ fontSize: '13px', color: '#737373' }}>{item.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section style={{ padding: '80px 24px', background: '#fafafa' }}>
                <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                    <motion.div
                        style={{
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            borderRadius: '20px',
                            padding: 'clamp(40px, 5vw, 60px)',
                            textAlign: 'center',
                            color: 'white'
                        }}
                        initial={{ opacity: 0, scale: 0.98 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                    >
                        <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: '700', marginBottom: '12px' }}>
                            Ready to Debate?
                        </h2>
                        <p style={{ fontSize: '16px', marginBottom: '28px', opacity: 0.9 }}>
                            Join thousands of debaters and prove your skills
                        </p>
                        <Link to="/register">
                            <motion.button
                                style={{
                                    background: 'white',
                                    color: '#171717',
                                    padding: '14px 32px',
                                    borderRadius: '12px',
                                    fontWeight: '600',
                                    fontSize: '15px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                Create Free Account
                                <ArrowRight style={{ width: '18px', height: '18px' }} />
                            </motion.button>
                        </Link>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <footer style={{
                padding: '24px',
                textAlign: 'center',
                color: '#a3a3a3',
                borderTop: '1px solid #e5e5e5',
                background: '#fff',
                fontSize: '14px'
            }}>
                <p>Made with ❤️ by DebateVerse Team • © 2024</p>
            </footer>
        </div>
    );
};

export default Landing;

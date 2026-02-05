import { motion } from 'framer-motion';

const Loader = () => {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-cyan-50">
            <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="text-center"
            >
                {/* Logo */}
                <motion.div
                    className="w-24 h-24 rounded-3xl bg-gradient-candy flex items-center justify-center mx-auto mb-6 shadow-xl"
                    animate={{
                        rotate: [0, 5, -5, 0],
                        scale: [1, 1.1, 1]
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                >
                    <span className="text-4xl font-bold text-white">DV</span>
                </motion.div>

                {/* Title */}
                <h1 className="text-3xl font-black text-gradient mb-4">
                    DebateVerse
                </h1>

                {/* Loading dots */}
                <div className="flex justify-center gap-2">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            className="w-4 h-4 rounded-full bg-gradient-candy"
                            animate={{
                                y: [0, -15, 0],
                                scale: [1, 1.2, 1]
                            }}
                            transition={{
                                duration: 0.6,
                                repeat: Infinity,
                                delay: i * 0.15
                            }}
                        />
                    ))}
                </div>

                <p className="mt-6 text-[var(--text-muted)] font-semibold">
                    Loading the arena... 🎮
                </p>
            </motion.div>
        </div>
    );
};

export default Loader;

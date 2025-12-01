import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface ShootingStarIntroProps {
    onComplete: () => void;
    targetRect?: DOMRect | null;
}

export const ShootingStarIntro: React.FC<ShootingStarIntroProps> = ({ onComplete, targetRect }) => {
    const [heroStarFinished, setHeroStarFinished] = useState(false);
    const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
    const [backgroundStars, setBackgroundStars] = useState<{ id: number; x: number; y: number; scale: number; duration: number; delay: number }[]>([]);

    // Initialize window size and background stars
    useEffect(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        setWindowSize({ width, height });

        // Generate background stars
        const starCount = 40;
        const stars = [];
        for (let i = 0; i < starCount; i++) {
            stars.push({
                id: i,
                // Start from top-right area, extending outside screen
                x: Math.random() * width * 1.5,
                y: Math.random() * height * 0.5 - height * 0.5,
                scale: Math.random() * 0.5 + 0.2, // Smaller than hero star
                duration: Math.random() * 2 + 1.5,
                delay: Math.random() * 2,
            });
        }
        setBackgroundStars(stars);
    }, []);

    // Calculate Bezier Path for Hero Star
    const targetX = targetRect ? targetRect.left + targetRect.width / 2 : (windowSize.width - 50);
    const targetY = targetRect ? targetRect.top + targetRect.height / 2 : (windowSize.height - 50);

    const startX = windowSize.width + 100;
    const startY = -100;

    const controlX = windowSize.width * 0.2;
    const controlY = windowSize.height * 0.4;

    const pathPoints = [];
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * controlX + t * t * targetX;
        const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * controlY + t * t * targetY;
        pathPoints.push({ x, y });
    }

    const xValues = pathPoints.map(p => p.x);
    const yValues = pathPoints.map(p => p.y);

    if (windowSize.width === 0) return null;

    return (
        <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden bg-black/60 backdrop-blur-[1px] transition-colors duration-1000">

            {/* Background Falling Stars (Same Icon) */}
            {backgroundStars.map((star) => (
                <motion.div
                    key={star.id}
                    initial={{ x: star.x, y: star.y, opacity: 0 }}
                    animate={{
                        x: star.x - windowSize.width, // Move diagonal down-left
                        y: star.y + windowSize.width, // Assume 45 degree angle
                        opacity: [0, 1, 1, 0]
                    }}
                    transition={{
                        duration: star.duration,
                        delay: star.delay,
                        ease: "linear",
                        repeat: Infinity,
                        repeatDelay: Math.random() * 2
                    }}
                    className="absolute text-blue-200"
                >
                    <Sparkles
                        style={{ transform: `scale(${star.scale})` }}
                        className="w-12 h-12 drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]"
                        fill="white"
                        fillOpacity={0.3}
                    />
                </motion.div>
            ))}

            {/* Hero Star */}
            <motion.div
                initial={{ x: startX, y: startY, scale: 0.5, opacity: 0, rotate: 0 }}
                animate={{
                    x: xValues,
                    y: yValues,
                    scale: [0.5, 1.2, 1], // Reduced scale
                    opacity: [0, 1, 1, 1],
                    rotate: [0, -45, -90, -360]
                }}
                transition={{
                    duration: 3.5,
                    ease: "easeInOut",
                    times: [0, 0.2, 0.8, 1]
                }}
                onAnimationComplete={() => {
                    setHeroStarFinished(true);
                    onComplete();
                }}
                className="absolute z-50 flex items-center justify-center"
                style={{ marginLeft: '-24px', marginTop: '-24px' }} // Center 48px (w-12) icon
            >
                {/* The Star Icon - Simplified */}
                <div className="relative">
                    {/* Subtle Glow only */}
                    <div className="absolute inset-0 bg-blue-400 rounded-full blur-md opacity-40" />

                    <Sparkles
                        className="w-12 h-12 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                        strokeWidth={1.5}
                        fill="white"
                        fillOpacity={0.2}
                    />
                </div>
            </motion.div>

            {/* Final Explosion */}
            <AnimatePresence>
                {heroStarFinished && (
                    <motion.div
                        className="absolute"
                        style={{ left: targetX, top: targetY }}
                        initial={{ scale: 0, opacity: 1 }}
                        animate={{ scale: 4, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                    >
                        <div className="w-20 h-20 -ml-10 -mt-10 rounded-full bg-white blur-xl opacity-80" />
                        <div className="w-40 h-40 -ml-20 -mt-20 rounded-full border-4 border-blue-300 blur-lg opacity-60" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

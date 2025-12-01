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
    // Animation State
    const [phase, setPhase] = useState<'flying' | 'arrived' | 'finished'>('flying');

    // Explosion Particles
    const [explosionParticles, setExplosionParticles] = useState<{ id: number, angle: number, speed: number, scale: number, color: string }[]>([]);

    // Initialize window size and background stars
    useEffect(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        setWindowSize({ width, height });

        // Generate background stars
        const starCount = 200; // User requested high density
        const stars = [];
        for (let i = 0; i < starCount; i++) {
            stars.push({
                id: i,
                // Spread stars more widely
                x: Math.random() * width * 2.5 - width * 0.5,
                y: Math.random() * height * 1.5 - height * 0.5,
                scale: Math.random() * 0.5 + 0.2,
                duration: Math.random() * 3 + 2, // Slower, more varied speed
                delay: Math.random() * 2,
            });
        }
        setBackgroundStars(stars);

        // Prepare explosion particles
        const particles = [];
        for (let i = 0; i < 20; i++) {
            particles.push({
                id: i,
                angle: (i / 20) * 360,
                speed: Math.random() * 50 + 50,
                scale: Math.random() * 0.5 + 0.5,
                color: Math.random() > 0.5 ? '#FBBF24' : '#FFFFFF' // Yellow and White mix
            });
        }
        setExplosionParticles(particles);
    }, []);

    // Calculate Bezier Path for Hero Star
    // Button is fixed at bottom-6 right-6 (24px + 24px). Size is w-14 h-14 (56px).
    // Center is 24px + 28px = 52px from edges.
    const targetX = windowSize.width - 52;
    const targetY = windowSize.height - 52;

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
        <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">

            {/* Background Falling Stars (Yellow) */}
            {backgroundStars.map((star) => (
                <motion.div
                    key={star.id}
                    initial={{ x: star.x, y: star.y, opacity: 0 }}
                    animate={{
                        x: star.x - windowSize.width,
                        y: star.y + windowSize.width,
                        opacity: [0, 1, 1, 0]
                    }}
                    transition={{
                        duration: star.duration,
                        delay: star.delay,
                        ease: "linear",
                        repeat: Infinity,
                        repeatDelay: Math.random() * 2
                    }}
                    className="absolute text-yellow-300"
                >
                    <Sparkles
                        style={{ transform: `scale(${star.scale})` }}
                        className="w-12 h-12 drop-shadow-[0_0_5px_rgba(253,224,71,0.5)]"
                        fill="currentColor"
                        fillOpacity={0.3}
                    />
                </motion.div>
            ))}

            {/* Hero Star Container */}
            <motion.div
                initial={{ x: startX, y: startY, scale: 0.5, opacity: 0, rotate: 0 }}
                animate={phase === 'flying' ? {
                    x: xValues,
                    y: yValues,
                    scale: [0.5, 3, 2], // Fly as a larger star (2x)
                    opacity: [0, 1, 1, 1],
                    rotate: [0, -45, -90, -360],
                } : {
                    x: targetX,
                    y: targetY,
                    scale: 1, // Land as 1x (w-6) to match button
                    opacity: 1,
                    rotate: -360
                }}
                transition={phase === 'flying' ? {
                    duration: 2.5,
                    ease: "circOut",
                    times: [0, 0.2, 0.8, 1]
                } : { duration: 0.5, ease: "backOut" }} // Smooth landing scale
                onAnimationComplete={() => {
                    if (phase === 'flying') {
                        setPhase('arrived');
                        // Trigger completion after transformation
                        setTimeout(() => {
                            setHeroStarFinished(true);
                            setTimeout(onComplete, 600);
                        }, 600);
                    }
                }}
                className="absolute z-50 flex items-center justify-center"
                style={{ marginLeft: '-12px', marginTop: '-12px' }} // Center 24px (w-6) icon
            >
                <div className="relative flex items-center justify-center">
                    {/* High-End Trail Effect (Only during flight) */}
                    {phase === 'flying' && (
                        <motion.div
                            className="absolute right-0 w-40 h-1 bg-gradient-to-l from-yellow-300/0 via-yellow-300/50 to-white/80 blur-sm rounded-full origin-right"
                            style={{ transform: 'translateX(-5px) rotate(10deg)' }}
                            animate={{ opacity: [0, 1, 0], scaleX: [0.5, 1.5, 0.5] }}
                            transition={{ duration: 2.5, times: [0, 0.5, 1] }}
                        />
                    )}

                    {/* Blue Circle Background - Expands from center upon arrival */}
                    <motion.div
                        className="absolute bg-blue-600 rounded-full shadow-[0_0_30px_rgba(37,99,235,0.6)] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                        initial={{ width: 0, height: 0, opacity: 0 }}
                        animate={phase === 'arrived' ? { width: 56, height: 56, opacity: 1 } : { width: 0, height: 0, opacity: 0 }}
                        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                    />

                    {/* Shockwave Ring */}
                    {phase === 'arrived' && (
                        <motion.div
                            className="absolute border-2 border-blue-400 rounded-full left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                            initial={{ width: 0, height: 0, opacity: 1 }}
                            animate={{ width: 100, height: 100, opacity: 0 }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                        />
                    )}

                    {/* The Star Icon */}
                    <motion.div
                        className="relative z-10"
                        animate={phase === 'arrived' ? { color: '#FFFFFF', scale: 1 } : { color: '#FBBF24', scale: 1 }}
                        transition={{ duration: 0.4 }}
                    >
                        {/* Multi-layer Glow - Subtle transition */}
                        <motion.div
                            className="absolute inset-0 rounded-full blur-md opacity-60"
                            animate={phase === 'arrived' ? { backgroundColor: '#3B82F6', opacity: 0.4 } : { backgroundColor: '#FBBF24', opacity: 0.6 }}
                            transition={{ duration: 0.4 }}
                        />
                        <motion.div
                            className="absolute inset-0 rounded-full blur-xl opacity-40"
                            animate={phase === 'arrived' ? { backgroundColor: '#60A5FA', scale: 1.5 } : { backgroundColor: '#FCD34D', scale: 1.2 }}
                            transition={{ duration: 0.3 }}
                        />

                        <Sparkles
                            className="w-6 h-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.9)]"
                        // Removed strokeWidth={1.5} to use default (2)
                        // Removed fill and fillOpacity to match outline style
                        />
                    </motion.div>
                </div>
            </motion.div>

            {/* Particle Explosion on Arrival */}
            {phase === 'arrived' && explosionParticles.map((p) => (
                <motion.div
                    key={p.id}
                    className="absolute rounded-full"
                    style={{
                        left: targetX,
                        top: targetY,
                        width: 4,
                        height: 4,
                        backgroundColor: p.color,
                    }}
                    initial={{ x: 0, y: 0, opacity: 1, scale: p.scale }}
                    animate={{
                        x: Math.cos(p.angle * Math.PI / 180) * p.speed,
                        y: Math.sin(p.angle * Math.PI / 180) * p.speed,
                        opacity: 0
                    }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                />
            ))}

            {/* Final Flash */}
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

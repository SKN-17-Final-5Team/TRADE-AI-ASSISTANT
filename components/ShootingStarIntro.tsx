import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface ShootingStarIntroProps {
    onComplete: () => void;
    targetRect?: DOMRect | null;
}

export const ShootingStarIntro: React.FC<ShootingStarIntroProps> = ({ onComplete, targetRect }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [heroStarFinished, setHeroStarFinished] = useState(false);
    const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

    // Initialize window size
    useEffect(() => {
        setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    }, []);

    // Particle system for background shooting stars
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles: { x: number; y: number; length: number; speed: number; opacity: number }[] = [];
        const particleCount = 200; // Increased count

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * canvas.width + canvas.width / 2,
                y: Math.random() * canvas.height - canvas.height / 2,
                length: Math.random() * 100 + 50,
                speed: Math.random() * 20 + 5,
                opacity: Math.random() * 0.8 + 0.2,
            });
        }

        let animationFrameId: number;

        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.lineWidth = 3;

            particles.forEach((p) => {
                ctx.beginPath();
                const gradient = ctx.createLinearGradient(p.x, p.y, p.x - p.length, p.y + p.length);
                gradient.addColorStop(0, `rgba(200, 230, 255, ${p.opacity})`);
                gradient.addColorStop(0.5, `rgba(100, 180, 255, ${p.opacity * 0.8})`);
                gradient.addColorStop(1, 'rgba(50, 100, 255, 0)');
                ctx.strokeStyle = gradient;

                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x - p.length, p.y + p.length);
                ctx.stroke();

                p.x -= p.speed;
                p.y += p.speed;

                if (p.x < -200 || p.y > canvas.height + 200) {
                    p.x = Math.random() * canvas.width + canvas.width / 2;
                    p.y = Math.random() * canvas.height - canvas.height / 2;
                }
            });

            animationFrameId = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    // Calculate Bezier Path
    const targetX = targetRect ? targetRect.left + targetRect.width / 2 : (windowSize.width - 50);
    const targetY = targetRect ? targetRect.top + targetRect.height / 2 : (windowSize.height - 50);

    // Start from top-right
    const startX = windowSize.width + 100;
    const startY = -100;

    // Control point for curve (pulling towards center-left to create an arc)
    const controlX = windowSize.width * 0.2;
    const controlY = windowSize.height * 0.4;

    // Generate path points
    const pathPoints = [];
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        // Quadratic Bezier curve formula
        const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * controlX + t * t * targetX;
        const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * controlY + t * t * targetY;
        pathPoints.push({ x, y });
    }

    const xValues = pathPoints.map(p => p.x);
    const yValues = pathPoints.map(p => p.y);

    if (windowSize.width === 0) return null; // Wait for hydration

    return (
        <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden bg-black/70 backdrop-blur-[2px] transition-colors duration-1000">
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

            {/* Hero Star */}
            <motion.div
                initial={{ x: startX, y: startY, scale: 0.5, opacity: 0, rotate: 0 }}
                animate={{
                    x: xValues,
                    y: yValues,
                    scale: [0.5, 3, 3, 1], // Grow large then shrink at end
                    opacity: [0, 1, 1, 1],
                    rotate: [0, -45, -90, -360] // Rotate as it flies
                }}
                transition={{
                    duration: 3.5, // Slower animation
                    ease: "easeInOut",
                    times: [0, 0.2, 0.8, 1]
                }}
                onAnimationComplete={() => {
                    setHeroStarFinished(true);
                    onComplete();
                }}
                className="absolute z-50 flex items-center justify-center"
                style={{ marginLeft: '-48px', marginTop: '-48px' }} // Center 96px (w-24) icon
            >
                {/* The Star Icon */}
                <div className="relative">
                    {/* Outer Glow */}
                    <div className="absolute inset-0 bg-blue-500 rounded-full blur-[30px] opacity-60 animate-pulse" />
                    <div className="absolute inset-0 bg-white rounded-full blur-[10px] opacity-80" />

                    {/* The Icon - Scaled up significantly */}
                    <Sparkles
                        className="w-24 h-24 text-white drop-shadow-[0_0_20px_rgba(255,255,255,1)]"
                        strokeWidth={1.5}
                        fill="white" // Fill the star to make it solid
                        fillOpacity={0.2}
                    />
                </div>

                {/* Long Trail */}
                <motion.div
                    className="absolute top-1/2 left-1/2 w-[400px] h-32 bg-gradient-to-l from-transparent via-blue-400/40 to-white/60 -translate-y-1/2 -translate-x-full origin-right blur-xl"
                    style={{
                        transformOrigin: 'right center',
                        zIndex: -1,
                        clipPath: 'polygon(0 40%, 100% 45%, 100% 55%, 0 60%)' // Tapered trail
                    }}
                />
            </motion.div>

            {/* Final Explosion */}
            <AnimatePresence>
                {heroStarFinished && (
                    <motion.div
                        className="absolute"
                        style={{ left: targetX, top: targetY }}
                        initial={{ scale: 0, opacity: 1 }}
                        animate={{ scale: 8, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    >
                        <div className="w-40 h-40 -ml-20 -mt-20 rounded-full bg-white blur-2xl opacity-90" />
                        <div className="w-80 h-80 -ml-40 -mt-40 rounded-full border-[16px] border-blue-400 blur-2xl opacity-70" />
                        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                            <Sparkles className="w-32 h-32 text-white animate-ping opacity-50" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

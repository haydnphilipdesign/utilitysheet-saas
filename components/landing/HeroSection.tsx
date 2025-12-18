'use client';

import Link from 'next/link';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useRef } from 'react';

function Hero3DCard() {
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseXSpring = useSpring(x);
    const mouseYSpring = useSpring(y);

    const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["17.5deg", "-17.5deg"]);
    const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-17.5deg", "17.5deg"]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const xPct = mouseX / width - 0.5;
        const yPct = mouseY / height - 0.5;
        x.set(xPct);
        y.set(yPct);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <motion.div
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
                rotateY,
                rotateX,
                transformStyle: "preserve-3d",
            }}
            className="relative w-full max-w-4xl mx-auto aspect-video rounded-xl bg-zinc-900/50 border border-zinc-800 backdrop-blur-sm shadow-2xl shadow-emerald-500/10 flex items-center justify-center"
        >
            <div
                style={{ transform: "translateZ(75px)", transformStyle: "preserve-3d" }}
                className="absolute inset-4 bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden flex flex-col shadow-inner"
            >
                {/* Mock Window Controls */}
                <div className="h-8 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/20" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/20" />
                    <div className="w-3 h-3 rounded-full bg-green-500/20" />
                </div>

                {/* Mock Content */}
                <div className="p-6 flex-1 flex gap-6">
                    <div className="w-1/4 h-full bg-zinc-900/50 rounded-md border border-zinc-800/50 animate-pulse" />
                    <div className="flex-1 space-y-4">
                        <div className="h-8 w-1/3 bg-emerald-500/10 rounded border border-emerald-500/10" />
                        <div className="space-y-2">
                            <div className="h-20 w-full bg-zinc-900/50 rounded border border-zinc-800/50" />
                            <div className="h-20 w-full bg-zinc-900/50 rounded border border-zinc-800/50" />
                            <div className="h-20 w-full bg-zinc-900/50 rounded border border-zinc-800/50" />
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

export function HeroSection() {
    return (
        <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-32 px-4 lg:px-8">
            <div className="absolute inset-0 -z-10">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-emerald-500/20 blur-[120px] rounded-full opacity-30 pointer-events-none" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
            </div>

            <div className="mx-auto max-w-7xl text-center z-10 relative">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/80 border border-zinc-800 text-zinc-400 text-sm font-medium mb-8 hover:bg-zinc-800/80 transition-colors cursor-default backdrop-blur-sm">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <span>Reimagining Utility Transfers</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight text-white mb-8">
                        Utility Handoffs <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-emerald-300 to-emerald-500 animate-gradient-x">
                            Simplified.
                        </span>
                    </h1>

                    <p className="mx-auto max-w-2xl text-lg md:text-xl text-zinc-400 mb-10 leading-relaxed">
                        Stop spending hours on phone calls. Let our AI handle utility transfers for your clients in minutes, not days.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
                        <Link href="/auth/signup">
                            <Button size="lg" className="h-14 px-8 text-lg bg-emerald-500 text-white hover:bg-emerald-400 transition-all hover:scale-105 shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)]">
                                Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </Link>
                        <Link href="#how-it-works">
                            <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 bg-zinc-950/50 backdrop-blur-sm">
                                How it Works
                            </Button>
                        </Link>
                    </div>

                    <div style={{ perspective: "1000px" }} className="w-full flex justify-center">
                        <Hero3DCard />
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

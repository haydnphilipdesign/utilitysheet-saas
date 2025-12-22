'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Search, Check, Zap, CheckCircle2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { UtilitySheetPreview } from './UtilitySheetPreview';

const AnimationState = {
    INPUT: 0,
    LOADING: 1,
    SELECT: 2,
    SUCCESS: 3,
} as const;

function HeroFeatureAnimation() {
    const [step, setStep] = useState<number>(AnimationState.INPUT);
    const [text, setText] = useState("");
    const targetText = "123 Main St, Springfield";

    useEffect(() => {
        let timeout: NodeJS.Timeout;

        const runAnimation = async () => {
            // Step 0: Input typing
            if (step === AnimationState.INPUT) {
                if (text.length < targetText.length) {
                    timeout = setTimeout(() => {
                        setText(targetText.slice(0, text.length + 1));
                    }, 50 + Math.random() * 50); // Random typing speed
                } else {
                    timeout = setTimeout(() => setStep(AnimationState.LOADING), 800);
                }
            }
            // Step 1: Loading/Searching
            else if (step === AnimationState.LOADING) {
                timeout = setTimeout(() => setStep(AnimationState.SELECT), 1500);
            }
            // Step 2: Selection
            else if (step === AnimationState.SELECT) {
                timeout = setTimeout(() => setStep(AnimationState.SUCCESS), 2500);
            }
            // Step 3: Success -> Reset
            else if (step === AnimationState.SUCCESS) {
                timeout = setTimeout(() => {
                    setStep(AnimationState.INPUT);
                    setText("");
                }, 6000); // Longer pause to view the sheet
            }
        };

        runAnimation();
        return () => clearTimeout(timeout);
    }, [step, text]);

    return (
        <div className="w-full h-full flex flex-col font-sans">
            {/* Mock Header */}
            <div className="h-12 border-b border-border flex items-center justify-between px-6 bg-secondary/50">
                <div className="w-24 h-4 bg-secondary rounded-full" />
                <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-secondary" />
                    <div className="w-6 h-6 rounded-full bg-secondary" />
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-8 relative overflow-hidden bg-white/50 dark:bg-black/20">
                <AnimatePresence mode="wait">
                    {step === AnimationState.INPUT && (
                        <motion.div
                            key="input"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex flex-col items-center justify-center h-full gap-6"
                        >
                            <div className="text-center space-y-2">
                                <h3 className="text-xl font-medium text-foreground">Where are you moving?</h3>
                                <p className="text-muted-foreground text-sm">We'll find the providers for you.</p>
                            </div>
                            <div className="w-full max-w-md bg-card border border-border rounded-lg h-12 flex items-center px-4 gap-3 shadow-lg shadow-black/10 dark:shadow-black/20">
                                <Search className="w-4 h-4 text-muted-foreground" />
                                <span className="text-foreground">
                                    {text}
                                    <span className="animate-pulse text-emerald-500">|</span>
                                </span>
                            </div>
                        </motion.div>
                    )}

                    {step === AnimationState.LOADING && (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center h-full gap-4"
                        >
                            <div className="w-12 h-12 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                            <p className="text-muted-foreground text-sm">Scanning providers...</p>
                        </motion.div>
                    )}

                    {step === AnimationState.SELECT && (
                        <motion.div
                            key="select"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            className="w-full max-w-md mx-auto space-y-4 pt-4"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div className="space-y-1">
                                    <h4 className="text-foreground font-medium">Select Electric</h4>
                                    <p className="text-xs text-muted-foreground">Based on your address</p>
                                </div>
                                <Zap className="w-5 h-5 text-emerald-500" />
                            </div>

                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="p-4 rounded-xl bg-secondary/50 border border-emerald-500/50 flex items-center justify-between shadow-lg shadow-emerald-500/10 cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center">
                                        <Zap className="w-6 h-6 text-foreground fill-foreground" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-foreground font-medium">National Grid</span>
                                        <span className="text-xs text-emerald-500">98% Match</span>
                                    </div>
                                </div>
                                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center scale-0 animate-[scale-in_0.3s_ease-out_1s_forwards]">
                                    <Check className="w-4 h-4 text-white" />
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.4 }}
                                className="p-4 rounded-xl bg-card border border-border flex items-center justify-between opacity-50"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                                        <Zap className="w-6 h-6 text-muted-foreground" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-muted-foreground font-medium">Eversource</span>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}

                    {step === AnimationState.SUCCESS && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full h-full"
                        >
                            <UtilitySheetPreview />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function Hero3DCard() {
    return (
        <div
            className="relative w-full max-w-4xl mx-auto h-[600px] lg:h-[700px] rounded-xl bg-card/50 border border-border backdrop-blur-sm shadow-2xl shadow-emerald-500/10 flex items-center justify-center p-2"
        >
            <div
                className="w-full h-full bg-background rounded-lg border border-border overflow-hidden flex flex-col shadow-inner"
            >
                <HeroFeatureAnimation />
            </div>
        </div>
    );
}

export function HeroSection() {
    return (
        <section className="relative overflow-hidden pt-24 pb-16 sm:pt-32 sm:pb-24 lg:pt-40 lg:pb-32 px-4 lg:px-8">
            <div className="absolute inset-0 -z-10">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-emerald-500/20 blur-[120px] rounded-full opacity-30 pointer-events-none" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
            </div>

            <div className="mx-auto max-w-7xl px-6 lg:px-8 z-10 relative">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="text-center lg:text-left"
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/80 border border-border text-muted-foreground text-sm font-medium mb-8 hover:bg-secondary transition-colors cursor-default backdrop-blur-sm">
                            <Sparkles className="w-4 h-4 text-emerald-500" />
                            <span>Reimagining Utility Transfers</span>
                        </div>

                        <h1 className="text-5xl md:text-7xl lg:text-7xl font-black tracking-tight text-foreground mb-8">
                            Utility Handoffs <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-emerald-300 to-emerald-500 animate-gradient-x">
                                Simplified.
                            </span>
                        </h1>

                        <p className="mx-auto lg:mx-0 max-w-2xl text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed">
                            Stop spending hours on phone calls. Let our AI handle utility transfers for your clients in minutes, not days.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-12 lg:mb-0">
                            <Link href="/auth/signup">
                                <Button size="lg" className="h-14 px-8 text-lg bg-emerald-500 text-white hover:bg-emerald-400 transition-all hover:scale-105 shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)]">
                                    Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            </Link>
                            <Link href="#how-it-works">
                                <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-border text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-border bg-card/50 backdrop-blur-sm">
                                    How it Works
                                </Button>
                            </Link>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                        className="w-full flex justify-center"
                    >
                        <Hero3DCard />
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

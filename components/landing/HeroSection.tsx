'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Search, Check, Zap, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { UtilitySheetPreview } from './UtilitySheetPreview';

const AnimationState = {
    INPUT: 0,
    LOADING: 1,
    SELECT: 2,
    SUCCESS: 3,
} as const;

const painPoints = [
    'Texting sellers 2-3 times for utility info',
    'Waiting days for a response (if they reply)',
    'Manually typing into spreadsheets',
];

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
                                <h3 className="text-xl font-medium text-foreground">Enter the property address</h3>
                                <p className="text-muted-foreground text-sm">We&apos;ll suggest likely utility providers.</p>
                            </div>
                            <div className="w-full max-w-md bg-card border border-border rounded-lg h-12 flex items-center px-4 gap-3 shadow-lg shadow-black/10 dark:shadow-black/20">
                                <Search className="w-4 h-4 text-muted-foreground" />
                                <span className="text-foreground">
                                    {text}
                                    <span className="animate-pulse text-slate-500">|</span>
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
                            <div className="w-12 h-12 rounded-full border-2 border-slate-500/20 border-t-slate-500 animate-spin" />
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
                                <Zap className="w-5 h-5 text-slate-500" />
                            </div>

                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="p-4 rounded-xl bg-secondary/50 border border-slate-500/50 flex items-center justify-between shadow-lg shadow-slate-500/10 cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center">
                                        <Zap className="w-6 h-6 text-foreground fill-foreground" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-foreground font-medium">National Grid</span>
                                        <span className="text-xs text-slate-500">98% Match</span>
                                    </div>
                                </div>
                                <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center scale-0 animate-[scale-in_0.3s_ease-out_1s_forwards]">
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
            className="relative w-full max-w-4xl mx-auto h-[350px] sm:h-[450px] lg:h-[580px] rounded-xl bg-card/50 border border-border backdrop-blur-sm shadow-2xl shadow-slate-500/10 flex items-center justify-center p-2"
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
            {/* Background Effects */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-slate-500/20 blur-[120px] rounded-full opacity-30 pointer-events-none" />
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
                        {/* Badge */}
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-slate-600 text-white text-xs sm:text-sm font-medium mb-4 sm:mb-6 shadow-lg shadow-slate-500/20"
                        >
                            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span>Save 30+ minutes per listing</span>
                        </motion.div>

                        {/* Main Headline with Pain Hook */}
                        <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-6xl font-black tracking-tight text-foreground mb-4 sm:mb-6">
                            Still texting sellers
                            <span className="text-red-500 block mt-1">for utility info?</span>
                        </h1>

                        {/* Value Proposition */}
                        <p className="mx-auto lg:mx-0 max-w-2xl text-base sm:text-lg md:text-xl text-muted-foreground mb-6 sm:mb-8 leading-relaxed">
                            Stop the back-and-forth. Send one link, get a buyer-ready utility sheet in 2 minutes. 
                            No spreadsheets. No chasing. No follow-ups.
                        </p>

                        {/* Pain Points (The Problem) */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="mx-auto lg:mx-0 max-w-xl mb-6 sm:mb-8"
                        >
                            <p className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">The old way wastes your time:</p>
                            <div className="space-y-2">
                                {painPoints.map((pain, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-muted-foreground">
                                        <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                                        <span className="text-sm sm:text-base">{pain}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Solution Bullets */}
                        <motion.ul
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="mx-auto lg:mx-0 max-w-2xl space-y-2 sm:space-y-3 text-muted-foreground mb-6 sm:mb-8 text-left"
                        >
                            <li className="flex items-start gap-2 sm:gap-3">
                                <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                                <span className="text-sm sm:text-base"><strong>Seller-friendly:</strong> No login, no account numbers, no bills to upload</span>
                            </li>
                            <li className="flex items-start gap-2 sm:gap-3">
                                <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                                <span className="text-sm sm:text-base"><strong>Lightning fast:</strong> AI suggests providers, sellers confirm in 2 minutes</span>
                            </li>
                            <li className="flex items-start gap-2 sm:gap-3">
                                <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                                <span className="text-sm sm:text-base"><strong>Professional output:</strong> Branded PDF + shareable link, instantly</span>
                            </li>
                        </motion.ul>

                        {/* CTAs */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4 mb-4"
                        >
                            <Link href="/auth/signup" className="w-full sm:w-auto">
                                <Button size="lg" className="w-full sm:w-auto h-14 px-8 sm:px-10 text-base sm:text-lg bg-slate-600 text-white hover:bg-slate-500 transition-all hover:scale-105 shadow-[0_0_40px_-10px_rgba(71,85,105,0.5)] active:scale-[0.98]">
                                    Get Started Free
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            </Link>
                            <Link href="/demo" className="w-full sm:w-auto">
                                <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-6 sm:px-8 text-base sm:text-lg border-slate-500/50 text-slate-600 hover:text-slate-700 hover:bg-slate-500/10 hover:border-slate-600 bg-card/50 backdrop-blur-sm active:scale-[0.98]">
                                    <Sparkles className="mr-2 h-4 w-5" />
                                    See How It Works
                                </Button>
                            </Link>
                        </motion.div>

                        {/* Trust Indicators */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.7 }}
                            className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs sm:text-sm text-muted-foreground"
                        >
                            <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                Free plan: 3 requests/month
                            </span>
                            <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                No credit card required
                            </span>
                            <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                Cancel anytime
                            </span>
                        </motion.div>
                    </motion.div>

                    {/* Hero Visual */}
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

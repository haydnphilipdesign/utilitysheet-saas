'use client';

import { useEffect, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Sparkles, MapPin, Search, CheckCircle2 } from 'lucide-react';

export interface LoaderStep {
    icon: ReactNode;
    text: string;
    duration: number;
}

const DEFAULT_STEPS: LoaderStep[] = [
    {
        icon: <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />,
        text: "Verifying secure link...",
        duration: 800
    },
    {
        icon: <MapPin className="h-6 w-6 text-emerald-400" />,
        text: "Locating property...",
        duration: 1200
    },
    {
        icon: <Search className="h-6 w-6 text-emerald-400" />,
        text: "Analyzing local utility providers...",
        duration: 2500 // Longest step since this is usually where the AI work happens
    },
    {
        icon: <Sparkles className="h-6 w-6 text-emerald-400" />,
        text: "Preparing your workspace...",
        duration: 1000
    }
];

interface WizardLoaderProps {
    steps?: LoaderStep[];
}

export function WizardLoader({ steps = DEFAULT_STEPS }: WizardLoaderProps) {
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        if (currentStep >= steps.length - 1) return;

        const timer = setTimeout(() => {
            setCurrentStep(prev => prev + 1);
        }, steps[currentStep].duration);

        return () => clearTimeout(timer);
    }, [currentStep, steps]);

    return (
        <div className="fixed inset-0 bg-background flex flex-col items-center justify-center p-4 z-50">
            <div className="w-full max-w-sm">
                <div className="relative mb-12 flex justify-center">
                    {/* Pulsing center effect */}
                    <motion.div
                        className="absolute inset-0 bg-slate-500/10 blur-3xl rounded-full"
                        animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.3, 0.6, 0.3],
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />

                    {/* Icon container */}
                    <div className="relative h-20 w-20 bg-background/80 backdrop-blur-sm border border-border rounded-2xl flex items-center justify-center shadow-lg dark:shadow-2xl dark:shadow-black/50">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentStep}
                                initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                                transition={{ duration: 0.3 }}
                            >
                                {steps[currentStep].icon}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>

                {/* Text Scroller */}
                <div className="h-24 flex flex-col items-center justify-start text-center">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-2"
                        >
                            <h3 className="text-xl font-medium text-foreground tracking-tight">
                                {steps[currentStep].text}
                            </h3>
                            <div className="flex justify-center gap-1.5 pt-2">
                                {steps.map((_, idx) => (
                                    <motion.div
                                        key={idx}
                                        className={`h-1 rounded-full bg-slate-500/20`}
                                        animate={{
                                            width: idx === currentStep ? 24 : 6,
                                            backgroundColor: idx === currentStep ? "rgba(16, 185, 129, 1)" : "rgba(16, 185, 129, 0.2)"
                                        }}
                                        transition={{ duration: 0.4 }}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

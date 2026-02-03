'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';

interface WelcomeStepProps {
    address: string;
    onNext: () => void;
}

export function WelcomeStep({ address, onNext }: WelcomeStepProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center flex-1 text-center space-y-6 sm:space-y-8 px-2"
        >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-slate-500/20 to-slate-600/10 flex items-center justify-center ring-1 ring-border backdrop-blur-md">
                <Sparkles className="h-8 w-8 sm:h-10 sm:w-10 text-emerald-400" />
            </div>

            <div className="space-y-3 sm:space-y-4 max-w-md">
                <h2 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-foreground to-muted-foreground">
                    Tell us about the home's utilities
                </h2>
                <div className="space-y-2 sm:space-y-1">
                    <p className="text-sm sm:text-base text-muted-foreground">
                        We're gathering utility details for:
                    </p>
                    <p className="text-sm sm:text-lg font-medium text-foreground px-3 sm:px-4 py-2 bg-muted/50 rounded-lg border border-border inline-block max-w-full break-words">
                        {address}
                    </p>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    This will only take about 2 minutes. We'll ask which services the home uses, then you can confirm the providers.
                </p>
            </div>

            <button
                onClick={onNext}
                className="group relative inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-3.5 text-sm sm:text-base font-semibold text-foreground transition-all duration-200 bg-muted hover:bg-muted/80 border border-border rounded-full backdrop-blur-sm overflow-hidden active:scale-95"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-slate-500/10 to-slate-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="mr-2">Get Started</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
        </motion.div>
    );
}

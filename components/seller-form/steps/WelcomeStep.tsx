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
            className="flex flex-col items-center justify-center flex-1 text-center space-y-8"
        >
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/10 flex items-center justify-center ring-1 ring-white/10 backdrop-blur-md">
                <Sparkles className="h-10 w-10 text-emerald-400" />
            </div>

            <div className="space-y-4 max-w-md">
                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-foreground to-muted-foreground">
                    Let's set up the utilities
                </h2>
                <div className="space-y-1">
                    <p className="text-muted-foreground">
                        We're gathering utility info for:
                    </p>
                    <p className="text-lg font-medium text-foreground px-4 py-2 bg-muted/50 rounded-lg border border-border inline-block">
                        {address}
                    </p>
                </div>
                <p className="text-sm text-muted-foreground">
                    This will only take about 2 minutes. We'll ask about your services, then you can confirm the providers.
                </p>
            </div>

            <button
                onClick={onNext}
                className="group relative inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold text-foreground transition-all duration-200 bg-muted hover:bg-muted/80 border border-border rounded-full backdrop-blur-sm overflow-hidden"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="mr-2">Get Started</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
        </motion.div>
    );
}

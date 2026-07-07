'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Home, Save } from 'lucide-react';
import { wizardFocusRing } from '../wizard-ui';

interface WelcomeStepProps {
    address: string;
    onNext: () => void;
    estimatedMinutes?: number;
    stepCount?: number;
}

export function WelcomeStep({ address, onNext, estimatedMinutes, stepCount }: WelcomeStepProps) {
    const minutesText = (() => {
        if (!estimatedMinutes || estimatedMinutes <= 2) return 'about 2 minutes';
        if (estimatedMinutes <= 4) return 'about 3 to 4 minutes';
        if (estimatedMinutes <= 6) return 'about 5 minutes';
        return 'about 6 to 8 minutes';
    })();

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center flex-1 text-center space-y-6 sm:space-y-8 px-2"
        >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[var(--brand-accent-soft)] flex items-center justify-center ring-1 ring-border backdrop-blur-md">
                <Home className="h-8 w-8 sm:h-10 sm:w-10 text-[color:var(--brand-accent)]" />
            </div>

            <div className="space-y-3 sm:space-y-4 max-w-md">
                <h2 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-foreground to-muted-foreground">
                    Tell us about the home&apos;s utilities
                </h2>
                <div className="space-y-2 sm:space-y-1">
                    <p className="text-sm sm:text-base text-muted-foreground">
                        We&apos;re gathering utility details for:
                    </p>
                    <p className="text-sm sm:text-lg font-medium text-foreground px-3 sm:px-4 py-2 bg-muted/50 rounded-lg border border-border inline-block max-w-full break-words">
                        {address}
                    </p>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {stepCount && stepCount > 0
                        ? `${stepCount} quick questions, ${minutesText}. We'll ask which services the home uses, then you can confirm the providers.`
                        : `This takes ${minutesText}. We'll ask which services the home uses, then you can confirm the providers.`}
                </p>
                <p className="text-xs text-muted-foreground/80 inline-flex items-center gap-1.5 justify-center">
                    <Save className="h-3 w-3" />
                    Your progress saves automatically. Close the tab and come back anytime.
                </p>
            </div>

            <button
                type="button"
                onClick={onNext}
                data-testid="seller-welcome-continue"
                className={`group relative inline-flex items-center justify-center px-8 sm:px-10 py-3.5 sm:py-4 text-sm sm:text-base font-semibold text-white transition-all duration-200 bg-[color:var(--brand-accent)] hover:bg-[color:var(--brand-accent-strong)] border border-[color:var(--brand-accent-border)] rounded-xl shadow-lg active:scale-95 ${wizardFocusRing}`}
            >
                <span className="mr-2">Get Started</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
        </motion.div>
    );
}

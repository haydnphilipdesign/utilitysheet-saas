'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, ArrowRight, Sparkles } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/events';

export function StickyCTA() {
    const [isVisible, setIsVisible] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const shouldReduceMotion = useReducedMotion();

    useEffect(() => {
        const handleScroll = () => {
            // Show after scrolling past hero section (roughly 600px)
            if (window.scrollY > 600 && !isDismissed) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [isDismissed]);

    const handleDismiss = () => {
        setIsDismissed(true);
        setIsVisible(false);
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                    transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.2, ease: 'easeOut' }}
                    className="fixed inset-x-0 bottom-0 sm:bottom-auto sm:top-0 z-[60] bg-slate-700 text-white shadow-2xl pb-safe"
                >
                    <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-3">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Sparkles className="w-5 h-5 text-yellow-300 flex-shrink-0 hidden sm:block" />
                                <p className="text-sm sm:text-base font-medium truncate">
                                    <span className="hidden sm:inline">Ready to stop chasing utility info? </span>
                                    <span className="text-slate-200">Start free — 3 requests, no credit card.</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <Link href="/auth/signup">
                                    <Button
                                        size="sm"
                                        className="bg-white text-slate-700 hover:bg-slate-100 font-semibold h-10 px-4"
                                        data-testid="sticky-cta-signup"
                                        onClick={() =>
                                            trackEvent('landing_cta_clicked', {
                                                cta_id: 'sticky_cta_get_started',
                                                destination: '/auth/signup',
                                                location: 'sticky_cta',
                                            })
                                        }
                                    >
                                        Get Started
                                        <ArrowRight className="w-4 h-4 ml-1" />
                                    </Button>
                                </Link>
                                <button
                                    onClick={handleDismiss}
                                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                    aria-label="Dismiss"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

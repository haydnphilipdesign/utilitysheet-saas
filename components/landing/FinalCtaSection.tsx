'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackEvent } from '@/lib/analytics/events';
import { useEffect, useRef } from 'react';
import { useInView } from 'framer-motion';

export function FinalCtaSection() {
    const sectionRef = useRef<HTMLElement | null>(null);
    const isInView = useInView(sectionRef, { once: true, margin: '-20% 0px -20% 0px' });

    useEffect(() => {
        if (!isInView) return;
        trackEvent('landing_section_viewed', {
            section_id: 'final_cta',
            page: 'landing',
            location: 'final_cta',
        });
        trackEvent('landing_primary_cta_viewed', {
            cta_id: 'primary_final_start_free',
            page: 'landing',
            location: 'final_cta',
        });
    }, [isInView]);

    return (
        <section ref={sectionRef} className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="mx-auto max-w-5xl">
                <div className="relative rounded-3xl bg-slate-700 p-6 sm:p-8 md:p-16 text-center shadow-2xl shadow-slate-500/20 overflow-hidden">
                    <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20 brightness-100 mix-blend-overlay" />
                    <div className="absolute top-0 right-0 w-64 h-64 bg-slate-500/20 blur-[80px] rounded-full" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-slate-900/40 blur-[80px] rounded-full" />

                    <div className="relative z-10">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-sm font-medium mb-6">
                            <Sparkles className="w-4 h-4" />
                            <span>Built for transaction coordinators</span>
                        </div>

                        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:text-5xl tracking-tight">
                            Ready to stop the utility back-and-forth?
                        </h2>
                        <p className="text-slate-100/90 text-base sm:text-lg mb-6 max-w-2xl mx-auto font-medium">
                            Start free today. No credit card required. Cancel anytime.
                        </p>

                        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mb-8 sm:mb-10 text-sm text-slate-200">
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Guided seller link workflow
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Utility sheet web + PDF output
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Optional PDF email attachment on submission
                            </span>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <Link href="/auth/signup" className="w-full sm:w-auto">
                                <Button
                                    size="lg"
                                    data-testid="marketing-final-signup-cta"
                                    className="w-full sm:w-auto bg-white text-slate-700 hover:bg-slate-50 h-14 px-8 sm:px-10 text-base sm:text-xl font-bold shadow-xl shadow-black/10 hover:shadow-black/20 transition-all"
                                    onClick={() =>
                                        trackEvent('landing_primary_cta_clicked', {
                                            cta_id: 'primary_final_start_free',
                                            destination: '/auth/signup',
                                            location: 'final_cta',
                                        })
                                    }
                                >
                                    Start Free
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            </Link>
                            <Link href="/demo" className="w-full sm:w-auto">
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="w-full sm:w-auto h-14 px-8 sm:px-10 text-base sm:text-xl font-bold border-white/40 text-white hover:bg-white/10 hover:border-white/60"
                                    onClick={() =>
                                        trackEvent('landing_cta_clicked', {
                                            cta_id: 'secondary_final_demo',
                                            destination: '/demo',
                                            location: 'final_cta',
                                        })
                                    }
                                >
                                    Try the Demo
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

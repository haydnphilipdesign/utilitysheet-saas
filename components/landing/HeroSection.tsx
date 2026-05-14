'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, CheckCircle2, Link2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/analytics/events';

function Hero3DCard() {
    return (
        <div className="relative mx-auto w-full max-w-3xl lg:max-w-4xl">
            <div className="absolute -inset-x-4 bottom-0 top-10 -z-10 rounded-[2rem] bg-gradient-to-br from-emerald-200/25 via-slate-200/35 to-transparent blur-3xl dark:from-emerald-900/20 dark:via-slate-900/40" />
            <div className="relative mx-auto aspect-[1.08] w-full max-w-[520px] sm:aspect-[1.18] lg:max-w-[620px]">
                <Image
                    src="/landing/utility-info-sheet-123-Main-St.png"
                    alt="Finished UtilitySheet utility info sheet with provider contacts and buyer next steps"
                    fill
                    priority
                    sizes="(min-width: 1024px) 40vw, 88vw"
                    className="object-contain drop-shadow-[0_28px_48px_rgba(15,23,42,0.16)]"
                />
            </div>
        </div>
    );
}

export function HeroSection() {
    const shouldReduceMotion = useReducedMotion();
    const sectionRef = useRef<HTMLElement | null>(null);
    const isInView = useInView(sectionRef, { once: true, margin: '-20% 0px -20% 0px' });

    useEffect(() => {
        if (!isInView) return;

        trackEvent('landing_section_viewed', {
            section_id: 'hero',
            page: 'landing',
            location: 'hero',
        });

        trackEvent('landing_primary_cta_viewed', {
            cta_id: 'primary_hero_start_free',
            page: 'landing',
            location: 'hero',
        });
    }, [isInView]);

    return (
        <section ref={sectionRef} className="relative overflow-hidden pt-20 pb-14 sm:pt-28 sm:pb-20 lg:pt-32 lg:pb-24 px-4 lg:px-8">
            {/* Background Effects */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-emerald-500/10 blur-[120px] rounded-full opacity-30 pointer-events-none" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
            </div>

            <div className="mx-auto max-w-7xl px-6 lg:px-8 z-10 relative">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                    <motion.div
                        initial={shouldReduceMotion ? false : { opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.8, ease: "easeOut" }}
                        className="text-center lg:text-left"
                    >
                        {/* Badge */}
                        <motion.div
                            initial={shouldReduceMotion ? false : { opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={shouldReduceMotion ? { duration: 0.01 } : { delay: 0.2 }}
                            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm font-medium mb-4 sm:mb-6 border border-emerald-600/20"
                        >
                            <Link2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
                            <span>Your reusable seller link is ready after signup</span>
                        </motion.div>

                        {/* Headline */}
                        <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-6xl font-black tracking-tight text-foreground mb-4 sm:mb-6 text-balance">
                            Share a seller link. Collect utility info. Get a ready-to-review utility sheet.
                        </h1>

                        {/* Value Proposition — one clean sentence */}
                        <p className="mx-auto lg:mx-0 max-w-xl text-base sm:text-lg md:text-xl text-muted-foreground mb-6 sm:mb-8 leading-relaxed">
                            UtilitySheet gives agents and transaction coordinators one reusable seller intake link. Sellers enter utility details, and your dashboard gets a clean web sheet plus PDF for review and sharing.
                        </p>

                        {/* CTAs */}
                        <motion.div
                            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={shouldReduceMotion ? { duration: 0.01 } : { delay: 0.4 }}
                            className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4 mb-5"
                        >
                            <Link href="/auth/signup" className="w-full sm:w-auto">
                                <Button
                                    size="lg"
                                    data-testid="hero-signup-cta"
                                    className="w-full sm:w-auto h-14 px-8 sm:px-10 text-base sm:text-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-all hover:scale-105 shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)] active:scale-[0.98]"
                                    onClick={() =>
                                        trackEvent('landing_primary_cta_clicked', {
                                            cta_id: 'primary_hero_start_free',
                                            destination: '/auth/signup',
                                            location: 'hero',
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
                                    className="w-full sm:w-auto h-14 px-6 sm:px-8 text-base sm:text-lg border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 bg-card/50 backdrop-blur-sm active:scale-[0.98]"
                                    onClick={() =>
                                        trackEvent('landing_cta_clicked', {
                                            cta_id: 'secondary_hero_demo',
                                            destination: '/demo',
                                            location: 'hero',
                                        })
                                    }
                                >
                                    <Sparkles className="mr-2 h-4 w-5" />
                                    Try the Demo
                                </Button>
                            </Link>
                        </motion.div>

                        {/* Trust Indicators */}
                        <motion.div
                            initial={shouldReduceMotion ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={shouldReduceMotion ? { duration: 0.01 } : { delay: 0.5 }}
                            className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs sm:text-sm text-muted-foreground"
                        >
                            <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                No credit card required
                            </span>
                            <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                3 free requests per month
                            </span>
                            <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                Copy your seller link first
                            </span>
                        </motion.div>
                    </motion.div>

                    {/* Hero Visual */}
                    <motion.div
                        initial={shouldReduceMotion ? false : { opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.8, ease: "easeOut", delay: 0.2 }}
                        className="w-full flex justify-center"
                    >
                        <Hero3DCard />
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

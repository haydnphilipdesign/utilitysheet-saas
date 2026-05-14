'use client';

import { useEffect, useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { CheckCircle2, FileText, Link2, MailCheck, Smartphone } from 'lucide-react';

import { trackEvent } from '@/lib/analytics/events';

const demoHighlights = [
    {
        icon: Link2,
        text: 'One reusable seller link',
    },
    {
        icon: Smartphone,
        text: 'Seller-friendly mobile form',
    },
    {
        icon: MailCheck,
        text: 'PDF can attach to your completion email',
    },
    {
        icon: FileText,
        text: 'Saved in your dashboard for review',
    },
];

export function DemoVideoSection() {
    const shouldReduceMotion = useReducedMotion();
    const sectionRef = useRef<HTMLElement | null>(null);
    const isInView = useInView(sectionRef, { once: true, margin: '-20% 0px -20% 0px' });

    useEffect(() => {
        if (!isInView) return;

        trackEvent('landing_section_viewed', {
            section_id: 'demo_video',
            page: 'landing',
            location: 'demo_video',
        });
    }, [isInView]);

    return (
        <section ref={sectionRef} className="relative overflow-hidden bg-background px-4 pt-8 pb-12 sm:px-6 sm:py-18 lg:px-8 lg:py-24">
            <div className="absolute inset-x-0 top-0 -z-10 h-32 bg-gradient-to-b from-emerald-500/5 to-transparent" />
            <div className="mx-auto max-w-7xl">
                <div className="grid items-center gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-12">
                    <motion.div
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.5 }}
                        className="text-center lg:text-left"
                    >
                        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                            Product demo
                        </p>
                        <h2 className="text-3xl font-bold tracking-tight text-foreground text-balance sm:text-4xl lg:text-5xl">
                            See the seller flow
                        </h2>
                        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg lg:mx-0">
                            Send one reusable seller link, let the seller confirm their utilities, and get a clean web sheet plus PDF back after submission.
                        </p>

                        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
                            {demoHighlights.map((item) => (
                                <div
                                    key={item.text}
                                    className="flex items-center gap-3 rounded-lg border border-border/70 bg-card/70 px-4 py-3 text-left shadow-sm"
                                >
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-300">
                                        <item.icon className="h-4 w-4" aria-hidden="true" />
                                    </span>
                                    <span className="text-sm font-semibold leading-snug text-foreground">
                                        {item.text}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    <motion.div
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 22 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.55, delay: 0.1 }}
                        className="relative"
                    >
                        <div className="absolute -inset-x-4 -inset-y-6 -z-10 rounded-[2rem] bg-gradient-to-br from-emerald-200/25 via-slate-200/35 to-transparent blur-3xl dark:from-emerald-900/20 dark:via-slate-900/40" />
                        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl shadow-slate-950/10 dark:shadow-black/30">
                            <div className="flex items-center justify-between border-b border-border/70 bg-muted/35 px-3 py-2 sm:px-4">
                                <div className="flex items-center gap-1.5" aria-hidden="true">
                                    <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                                </div>
                                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                                    66-second workflow
                                </div>
                            </div>
                            <video
                                className="aspect-video h-auto w-full bg-slate-950 object-cover"
                                controls
                                muted
                                playsInline
                                preload="metadata"
                                poster="/landing/utilitysheet-demo-poster.jpg"
                                aria-label="UtilitySheet product demo showing the seller link, utility confirmation, PDF delivery, and dashboard submission workflow"
                            >
                                <source src="/landing/utilitysheet-demo.mp4" type="video/mp4" />
                                Your browser does not support the video tag.
                            </video>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { Bell, FilePenLine, FileText, Layers, Link2, MailCheck, Palette, ShieldCheck, Sparkles, SlidersHorizontal } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/events';
import { featureHighlights } from '@/lib/marketing-content';

function PlanBadge({ children }: { children: string }) {
    return (
        <span className="inline-flex h-6 items-center rounded-full border border-slate-400/25 bg-slate-500/12 px-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-slate-300 dark:text-slate-200">
            {children}
        </span>
    );
}

const features = [
    {
        icon: Link2,
        title: featureHighlights[0].title,
        description: featureHighlights[0].description,
    },
    {
        icon: SlidersHorizontal,
        title: 'A dashboard you do not have to babysit',
        description: 'Set up your reusable link once, add it to your template, and let sellers complete the form. Open the dashboard when you need to review, edit, manage branding, or adjust settings.',
    },
    {
        icon: Layers,
        title: featureHighlights[1].title,
        tag: 'Handoff',
        description: featureHighlights[1].description,
    },
    {
        icon: MailCheck,
        title: 'Completion email + PDF attachment',
        description: 'The completed PDF can attach to your completion email when the seller submits, so the sheet is ready to review right away.',
    },
    {
        icon: Sparkles,
        title: featureHighlights[2].title,
        description: featureHighlights[2].description,
    },
    {
        icon: FilePenLine,
        title: featureHighlights[3].title,
        tag: 'Pro + Teams',
        description: featureHighlights[3].description,
    },
    {
        icon: FileText,
        title: 'Clean utility sheet output',
        description: featureHighlights[4].description,
    },
    {
        icon: Bell,
        title: featureHighlights[5].title,
        description: featureHighlights[5].description,
    },
    {
        icon: ShieldCheck,
        title: 'Secure by design',
        description: 'Seller links are separate from share links. After submission, public and seller links stay read-only, and any corrections happen inside the dashboard.'
    },
    {
        icon: Palette,
        title: 'White-label branding',
        tag: 'Pro + Teams',
        description: featureHighlights[6].description,
    }
];

export function FeatureSection() {
    const sectionRef = useRef<HTMLElement | null>(null);
    const isInView = useInView(sectionRef, { once: true, margin: '-20% 0px -20% 0px' });

    useEffect(() => {
        if (!isInView) return;

        trackEvent('landing_section_viewed', {
            section_id: 'features',
            page: 'landing',
            location: 'features',
        });
        trackEvent('pdf_attachment_value_prop_viewed', {
            section_id: 'features',
            page: 'landing',
            location: 'features',
        });
    }, [isInView]);

    return (
        <section ref={sectionRef} id="features" className="scroll-mt-24 bg-background px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
            <div className="mx-auto max-w-7xl">
                <div className="mx-auto mb-12 max-w-3xl text-center sm:mb-16">
                    <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 sm:text-sm">Features</p>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
                        Built around the seller link
                    </h2>
                    <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                        UtilitySheet is focused on one real estate job: collect seller utility details once, turn them into a clean web sheet and PDF, and keep the finished sheet useful after submission.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-3 lg:gap-8">
                    {features.map((feature, idx) => (
                        <motion.div
                            key={idx}
                            whileHover={{ y: -4 }}
                            className="group flex min-h-[270px] flex-col rounded-lg border border-border bg-card/35 p-6 transition-all hover:border-slate-500/35 hover:bg-card/55 sm:p-7 lg:min-h-[292px] lg:last:col-start-2"
                        >
                            <div className="mb-6 flex items-start justify-between gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-500/10 transition-colors group-hover:bg-slate-500/18">
                                    <feature.icon className="h-5 w-5 text-slate-500 sm:h-6 sm:w-6" aria-hidden="true" />
                                </div>
                                {feature.tag && <PlanBadge>{feature.tag}</PlanBadge>}
                            </div>
                            <h4 className="mb-3 max-w-[18rem] text-xl font-bold leading-snug text-foreground">
                                {feature.title}
                            </h4>
                            <p className="text-base leading-7 text-muted-foreground">{feature.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { Bell, FilePenLine, FileText, Layers, Link2, MailCheck, Palette, ShieldCheck, Sparkles, SlidersHorizontal } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/events';
import { featureHighlights } from '@/lib/marketing-content';

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
        tag: 'Advanced',
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
        <section ref={sectionRef} id="features" className="scroll-mt-24 py-24 bg-background px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                <div className="text-center mb-20">
                    <p className="text-slate-600 font-bold text-sm tracking-wider uppercase mb-3">Features</p>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
                        Built around the seller link
                    </h2>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto mt-4">
                        UtilitySheet is focused on one real estate job: collect seller utility details once, turn them into a clean web sheet and PDF, and keep the finished sheet useful after submission.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, idx) => (
                        <motion.div
                            key={idx}
                            whileHover={{ y: -5 }}
                            className="group p-8 rounded-lg bg-card/40 border border-border hover:border-slate-500/30 transition-all hover:bg-card/60"
                        >
                            <div className="w-12 h-12 rounded-lg bg-slate-500/10 flex items-center justify-center mb-6 group-hover:bg-slate-500/20 transition-colors">
                                <feature.icon className="h-6 w-6 text-slate-600" aria-hidden="true" />
                            </div>
                            <h4 className="text-xl font-bold text-foreground mb-3">
                                <span className="inline-flex items-center gap-2">
                                    {feature.title}
                                    {feature.tag && (
                                        <span className="inline-flex items-center rounded-full bg-slate-600 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase shadow-sm shadow-slate-500/20">
                                            {feature.tag}
                                        </span>
                                    )}
                                </span>
                            </h4>
                            <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

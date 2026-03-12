'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { Bell, FileText, Layers, Link2, MailCheck, Palette, ShieldCheck, Sparkles } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/events';

const features = [
    {
        icon: Link2,
        title: "Reusable Seller Link",
        description: "One permanent link for every property. Share it anywhere — sellers tap, enter the address, and go."
    },
    {
        icon: Layers,
        title: "Simple + Advanced Modes",
        tag: "New",
        description: "Use Simple mode for fast handoffs, or Advanced mode to collect transition details like lawn care, security, and access info."
    },
    {
        icon: MailCheck,
        title: "PDF Delivered to Your Inbox",
        description: "The completed PDF auto-attaches to your notification email the moment the seller submits. No login needed."
    },
    {
        icon: Sparkles,
        title: "AI-Powered Suggestions",
        description: "We suggest likely providers based on the property address. Sellers confirm with one tap."
    },
    {
        icon: FileText,
        title: "Buyer-Ready Output",
        description: "Clean web view and downloadable PDF with provider names and contact details — ready to share."
    },
    {
        icon: Bell,
        title: "Tracking + Reminders",
        description: "See each request’s status at a glance and nudge sellers with one click when they go quiet."
    },
    {
        icon: ShieldCheck,
        title: "Secure by Design",
        description: "Seller links are separate from share links. Utility sheets only become accessible after submission."
    },
    {
        icon: Palette,
        title: "White-Label Branding",
        tag: "Pro + Teams",
        description: "Your logo, your colors, no UtilitySheet footer. A fully branded experience for your clients."
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
                    <h2 className="text-slate-600 font-bold text-sm tracking-wider uppercase mb-3">Features</h2>
                    <h3 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Everything you need to stop the back-and-forth</h3>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto mt-4">
                        Collect utility providers fast, standardize every handoff, and keep your deals moving.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, idx) => (
                        <motion.div
                            key={idx}
                            whileHover={{ y: -5 }}
                            className="group p-8 rounded-2xl bg-card/40 border border-border hover:border-slate-500/30 transition-all hover:bg-card/60"
                        >
                            <div className="w-12 h-12 rounded-xl bg-slate-500/10 flex items-center justify-center mb-6 group-hover:bg-slate-500/20 transition-colors">
                                <feature.icon className="h-6 w-6 text-slate-600" />
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

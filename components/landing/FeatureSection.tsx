'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { Bell, FileText, Link2, MailCheck, Palette, ShieldCheck, Sparkles } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/events';

const features = [
    {
        icon: Link2,
        title: "Reusable Seller Link",
        description: "One permanent link that works for every property. Share it in a text, your email signature, or a listing — sellers tap it, enter the address, and go. No new link to create each time. One-off requests are still available if you want to choose specific utilities per file."
    },
    {
        icon: MailCheck,
        title: "PDF Delivered to Your Inbox",
        tag: "New",
        description: "When a seller submits, the completed utility sheet PDF automatically attaches to your notification email. You get the result without logging in — it’s just there in your inbox. On by default; manage the setting anytime."
    },
    {
        icon: Sparkles,
        title: "AI-Powered Suggestions",
        description: "We suggest likely providers based on the address. Sellers can confirm, search, or type a provider anytime."
    },
    {
        icon: FileText,
        title: "Buyer-Ready Utility Sheet",
        description: "Generate a clean web sheet and a downloadable PDF with provider names and contact details."
    },
    {
        icon: Bell,
        title: "Tracking + Reminders",
        description: "See each request's status at a glance — Sent, In Progress, or Submitted — and nudge sellers with one click when they go quiet."
    },
    {
        icon: ShieldCheck,
        title: "Secure by Design",
        description: "Seller links are separate from share links. Utility sheet packets only become accessible after submission — never before."
    },
    {
        icon: Palette,
        title: "White-Label Branding",
        tag: "Pro + Teams",
        description: "Add your logo and brand colors. Remove the UtilitySheet footer from share links and PDFs for a fully branded client experience."
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
                        Built around the real TC workflow: collect utility providers fast, standardize the handoff, and keep deals moving.
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

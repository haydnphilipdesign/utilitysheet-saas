'use client';

import { motion } from 'framer-motion';
import { Bell, FileText, Link2, Palette, ShieldCheck, Sparkles } from 'lucide-react';

const features = [
    {
        icon: Link2,
        title: "Guided Seller Link",
        description: "Send a secure link to your seller—no login. They confirm utilities on their phone in minutes."
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
        description: "See Sent/In progress/Submitted at a glance and nudge sellers when they forget."
    },
    {
        icon: ShieldCheck,
        title: "Secure by Design",
        description: "Seller intake links are separate from share links, and packets only unlock after submission."
    },
    {
        icon: Palette,
        title: "White-Label Branding (Pro)",
        description: "Add your logo/colors and remove the UtilitySheet footer from share links and PDFs."
    }
];

export function FeatureSection() {
    return (
        <section id="features" className="py-24 bg-background px-4 sm:px-6 lg:px-8">
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
                            <h4 className="text-xl font-bold text-foreground mb-3">{feature.title}</h4>
                            <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

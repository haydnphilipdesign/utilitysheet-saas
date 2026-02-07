'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Clock, CheckCircle, Users } from 'lucide-react';

const impactStats = [
    {
        icon: Clock,
        value: 'Fast',
        unit: '',
        label: 'Seller completion flow',
        description: 'Designed for quick phone-friendly submission',
    },
    {
        icon: CheckCircle,
        value: 'Clean',
        unit: '',
        label: 'Utility handoff output',
        description: 'Web sheet and PDF for buyer-ready sharing',
    },
    {
        icon: TrendingUp,
        value: 'AI',
        unit: '',
        label: 'Suggestion assist',
        description: 'Sellers can confirm, search, or manually enter providers',
    },
    {
        icon: Users,
        value: 'Config',
        unit: '',
        label: 'Notification controls',
        description: 'Reminders and attachment behavior managed in Settings',
    },
];

export function StatsSection() {
    return (
        <section className="py-16 sm:py-24 bg-background px-4 sm:px-6 lg:px-8 border-y border-border/50">
            <div className="mx-auto max-w-7xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="text-center mb-12 sm:mb-16"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-sm font-medium mb-4">
                        <TrendingUp className="w-4 h-4" />
                        <span>Workflow capabilities at a glance</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-4">
                        Why teams use UtilitySheet
                    </h2>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                        Built to remove repetitive utility handoff work while keeping output consistent.
                    </p>
                </motion.div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    {impactStats.map((stat, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.1 }}
                            className="relative group p-6 sm:p-8 rounded-2xl bg-card/40 border border-border hover:border-slate-500/30 transition-all hover:shadow-lg hover:shadow-slate-500/5"
                        >
                            <div className="w-12 h-12 rounded-xl bg-slate-500/10 flex items-center justify-center mb-4 group-hover:bg-slate-500/20 transition-colors">
                                <stat.icon className="w-6 h-6 text-slate-600" />
                            </div>
                            <div className="flex items-baseline gap-1 mb-2">
                                <span className="text-3xl sm:text-4xl font-bold text-foreground">
                                    {stat.value}
                                </span>
                                <span className="text-xl text-muted-foreground font-medium">
                                    {stat.unit}
                                </span>
                            </div>
                            <div className="font-semibold text-foreground mb-1">
                                {stat.label}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {stat.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

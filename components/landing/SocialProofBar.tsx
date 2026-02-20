'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Clock, Link2, FileText } from 'lucide-react';
import Image from 'next/image';

const stats = [
    {
        icon: Clock,
        value: '30+ min',
        label: 'Saved per file',
        description: 'Typical time saved on utility collection and follow-up per transaction',
    },
    {
        icon: Link2,
        value: '1 link',
        label: 'Sent to the seller',
        description: 'No app install, no login, no account — sellers complete it on their phone',
    },
    {
        icon: FileText,
        value: '~2 min',
        label: 'Seller completion',
        description: 'Average time for a seller to fill out the guided utility form',
    },
];

export function SocialProofBar() {
    const shouldReduceMotion = useReducedMotion();

    return (
        <section className="py-12 sm:py-16 bg-slate-700 text-white px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                {/* Stats Row */}
                <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.5 }}
                    className="grid grid-cols-3 gap-4 sm:gap-8 mb-12"
                >
                    {stats.map((stat, idx) => (
                        <motion.div
                            key={idx}
                            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={shouldReduceMotion ? { duration: 0.01 } : { delay: idx * 0.1 }}
                            className="text-center"
                        >
                            <div className="flex justify-center mb-2">
                                <stat.icon className="w-5 h-5 text-slate-300" />
                            </div>
                            <div className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-1">
                                {stat.value}
                            </div>
                            <div className="text-xs sm:text-sm font-semibold text-white mb-1">{stat.label}</div>
                            <div className="text-xs text-slate-300 max-w-[160px] mx-auto hidden sm:block leading-snug">{stat.description}</div>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Founder Quote */}
                <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={shouldReduceMotion ? { duration: 0.01 } : { delay: 0.3 }}
                    className="relative max-w-3xl mx-auto"
                >
                    <div className="relative bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 text-center">
                        <div className="flex justify-center mb-5">
                            <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-white/20 shadow-lg flex-shrink-0">
                                <Image
                                    src="/debbie_headshot.png"
                                    alt="Debbie O'Brien - PA Real Estate Support Services"
                                    fill
                                    className="object-cover"
                                />
                            </div>
                        </div>
                        <blockquote className="text-base sm:text-lg lg:text-xl font-medium leading-relaxed mb-5 text-slate-100">
                            &ldquo;My TC business runs on UtilitySheet now. Sellers get one link, fill it out in a couple minutes, and I get a clean sheet ready to share. No more texting back and forth asking who their gas company is.&rdquo;
                        </blockquote>
                        <div className="flex flex-col items-center gap-1">
                            <div className="font-semibold text-white">Debbie O&apos;Brien</div>
                            <div className="text-sm text-slate-300">
                                Transaction Coordinator &middot; PA Real Estate Support Services, LLC
                            </div>
                            <div className="text-xs text-slate-400 mt-1 italic">
                                The TC business that inspired UtilitySheet
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Trust Badges */}
                <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={shouldReduceMotion ? { duration: 0.01 } : { delay: 0.5 }}
                    className="mt-10 pt-8 border-t border-slate-500/50"
                >
                    <div className="flex items-center justify-center gap-6 flex-wrap">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                            No credit card required
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                            Free plan: 3 requests/month
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                            Cancel anytime
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

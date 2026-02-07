'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Quote } from 'lucide-react';

const testimonials = [
    {
        quote: "UtilitySheet standardizes utility handoff with one seller link, clear provider details, and a buyer-ready sheet.",
        author: "UtilitySheet",
        role: "Product summary",
        location: "Real estate operations",
    },
];

const stats = [
    { value: 'No login', label: 'Seller-friendly form experience' },
    { value: 'PDF + link', label: 'Buyer-ready output formats' },
    { value: 'Settings', label: 'Reminder + attachment controls' },
];

export function SocialProofBar() {
    const shouldReduceMotion = useReducedMotion();

    return (
        <section className="py-12 sm:py-16 bg-slate-600 text-white px-4 sm:px-6 lg:px-8">
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
                            <div className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-1">
                                {stat.value}
                            </div>
                            <div className="text-xs sm:text-sm text-slate-200 font-medium">
                                {stat.label}
                            </div>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Testimonial */}
                <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={shouldReduceMotion ? { duration: 0.01 } : { delay: 0.3 }}
                    className="relative max-w-3xl mx-auto"
                >
                    <div className="pt-2 text-center">
                        <Quote className="w-8 h-8 text-slate-400 mx-auto mb-4 opacity-50" />
                        <blockquote className="text-lg sm:text-xl lg:text-2xl font-medium leading-relaxed mb-6">
                            &ldquo;{testimonials[0].quote}&rdquo;
                        </blockquote>
                        <div className="flex items-center justify-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-500 flex items-center justify-center text-sm font-bold">
                                {testimonials[0].author.charAt(0)}
                            </div>
                            <div className="text-left">
                                <div className="font-semibold">{testimonials[0].author}</div>
                                <div className="text-sm text-slate-300">{testimonials[0].role} • {testimonials[0].location}</div>
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
                    className="mt-12 pt-8 border-t border-slate-500/50"
                >
                    <p className="text-center text-sm text-slate-300 mb-4">
                        Built from real transaction coordination workflows
                    </p>
                    <div className="flex items-center justify-center gap-6 flex-wrap">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                            <div className="w-2 h-2 rounded-full bg-emerald-400" />
                            No credit card required
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                            <div className="w-2 h-2 rounded-full bg-emerald-400" />
                            Free plan: 3 requests/month
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                            <div className="w-2 h-2 rounded-full bg-emerald-400" />
                            Cancel anytime
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

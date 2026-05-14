'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { X, Check, Clock, MessageSquare, FileSpreadsheet, Zap } from 'lucide-react';

const oldWaySteps = [
    { icon: MessageSquare, text: 'Multiple texts/emails to collect provider details' },
    { icon: Clock, text: 'Delays and follow-ups when sellers miss info' },
    { icon: X, text: 'Typos and vague answers turn into more cleanup before closing' },
];

const newWaySteps = [
    { icon: MessageSquare, text: 'Send one secure seller link you can reuse on every file' },
    { icon: Zap, text: 'Seller enters the address and confirms providers on their phone' },
    { icon: Check, text: 'Pro/Teams can correct submitted sheets in the dashboard' },
    { icon: FileSpreadsheet, text: 'Web sheet + PDF generated for clean sharing' },
    { icon: Check, text: 'Your completion email can include the finished PDF automatically' },
];

export function BeforeAfterSection() {
    const shouldReduceMotion = useReducedMotion();

    return (
            <section className="py-14 sm:py-20 lg:py-24 bg-muted/30 px-4 sm:px-6 lg:px-8 border-b border-border/50">
            <div className="mx-auto max-w-7xl">
                <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.5 }}
                    className="text-center mb-12 sm:mb-16"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-600 text-sm font-medium mb-4">
                        <Clock className="w-4 h-4" />
                        <span>Sound familiar?</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground tracking-tight mb-4 text-balance">
                        Replace utility chase-downs with one seller link
                    </h2>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                        The old way is a blank form, scattered replies, and last-minute cleanup. UtilitySheet keeps the task simple: send the link, let the seller complete it, and review the finished sheet.
                    </p>
                </motion.div>

                <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
                    {/* Old Way */}
                    <motion.div
                        initial={shouldReduceMotion ? false : { opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.5, delay: 0.1 }}
                        className="relative rounded-2xl sm:rounded-3xl border border-red-200 bg-red-50/50 dark:bg-red-950/10 dark:border-red-900/30 p-6 sm:p-8"
                    >
                        <div className="absolute -top-3 left-6 sm:left-8">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-semibold border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
                                <X className="w-4 h-4" />
                                The Old Way
                            </span>
                        </div>

                        <div className="mt-4 space-y-4">
                            {oldWaySteps.map((step, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={shouldReduceMotion ? { duration: 0.01 } : { delay: 0.2 + idx * 0.1 }}
                                    className="flex items-start gap-3 sm:gap-4 p-4 rounded-xl bg-white/60 dark:bg-black/20 border border-red-100 dark:border-red-900/20"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                                        <step.icon className="w-5 h-5 text-red-600 dark:text-red-400" />
                                    </div>
                                    <p className="text-foreground font-medium pt-2">{step.text}</p>
                                </motion.div>
                            ))}
                        </div>

                        <div className="mt-6 p-4 rounded-xl bg-red-100/50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30">
                            <p className="text-red-800 dark:text-red-300 text-sm font-medium text-center">
                                Result: scattered answers, delayed files, and extra cleanup
                            </p>
                        </div>
                    </motion.div>

                    {/* New Way */}
                    <motion.div
                        initial={shouldReduceMotion ? false : { opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.5, delay: 0.2 }}
                        className="relative rounded-2xl sm:rounded-3xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/10 dark:border-emerald-900/30 p-6 sm:p-8"
                    >
                        <div className="absolute -top-3 left-6 sm:left-8">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-semibold border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
                                <Check className="w-4 h-4" />
                                With UtilitySheet
                            </span>
                        </div>

                        <div className="mt-4 space-y-4">
                            {newWaySteps.map((step, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={shouldReduceMotion ? { duration: 0.01 } : { delay: 0.3 + idx * 0.1 }}
                                    className="flex items-start gap-3 sm:gap-4 p-4 rounded-xl bg-white/60 dark:bg-black/20 border border-emerald-100 dark:border-emerald-900/20"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                                        <step.icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <p className="text-foreground font-medium pt-2">{step.text}</p>
                                </motion.div>
                            ))}
                        </div>

                        <div className="mt-6 p-4 rounded-xl bg-emerald-100/50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/30">
                            <p className="text-emerald-800 dark:text-emerald-300 text-sm font-medium text-center">
                                Result: fewer last-minute utility questions and the same clean sheet every time
                            </p>
                        </div>
                    </motion.div>
                </div>

                {/* Workflow Highlight */}
                <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={shouldReduceMotion ? { duration: 0.01 } : { delay: 0.5 }}
                    className="mt-12 text-center"
                >
                    <div className="inline-flex flex-col sm:flex-row items-center gap-3 sm:gap-6 px-6 py-4 rounded-2xl bg-slate-600 text-white shadow-xl shadow-slate-500/20">
                        <div className="flex items-center gap-3">
                            <Clock className="w-6 h-6" />
                            <span className="text-lg font-semibold">Simple utility collection:</span>
                        </div>
                        <span className="text-lg">one guided seller link, one utility sheet you can review and share</span>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

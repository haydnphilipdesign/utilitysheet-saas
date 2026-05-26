'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, Clock, Link2, FileText, Quote } from 'lucide-react';

const stats = [
    {
        icon: Clock,
        value: 'One link',
        label: 'Reused across files',
        description: 'Add one link to your templates and reuse it across transactions',
    },
    {
        icon: Link2,
        value: 'No login',
        label: 'For sellers',
        description: 'No app install, no login, no account required for the seller',
    },
    {
        icon: CheckCircle2,
        value: 'Nearly 86%',
        label: 'Started sheets completed',
        description: 'Most sellers who start a UtilitySheet finish it',
    },
    {
        icon: FileText,
        value: 'PDF ready',
        label: 'After submission',
        description: 'Review the web sheet and download a shareable utility sheet PDF',
    },
];

const customerTestimonials = [
    {
        quote: 'Before UtilitySheet, we sent blank forms to homeowners through Dotloop or DocuSign, and they rarely came back completed. Now we send one seller link from a templated email, get notified when it is complete, download the finished sheet, and we are done.',
        name: 'Kaylin Nunn',
        role: 'Owner & Director of Transaction Coordination, Precision Leverage Solutions',
        initials: 'KN',
    },
    {
        quote: 'UtilitySheet has made obtaining utility information much easier. Before, we sent emails asking for the info and tried to track down utility companies last minute. Now we keep the email simple, send sellers the UtilitySheet link, and the completion rate has been pretty dang good.',
        name: 'Courtney Bownes',
        role: 'Owner | Lead Transaction Manager, FastForward Transaction Management',
        initials: 'CB',
    },
    {
        quote: 'Before UtilitySheet, I used a Google spreadsheet with local providers and copied information into emails. UtilitySheet makes it easy for the co-op agent to send the form to the seller, and the completed branded PDF helps level up my TC company\'s service.',
        name: 'Agatha Aquilia',
        role: 'Transaction Manager, Aquilia Associates',
        initials: 'AA',
    },
];

const originStoryTestimonial = {
    heading: 'Built from real TC workflow',
    description: 'UtilitySheet started as an internal tool for a working transaction coordinator, then grew into a reusable seller link for TCs and real estate teams.',
    quote: 'Before UtilitySheet, I was chasing utility information through texts and emails, then cleaning up vague answers like "the gas company" right before closing. Now I send sellers one link, they complete the guided form, and I get a clean sheet that is easy to review and share.',
    name: 'Debbie O\'Brien',
    role: 'Transaction Coordinator, PA Real Estate Support Services, LLC',
};

export function SocialProofBar() {
    const shouldReduceMotion = useReducedMotion();

    return (
        <section className="bg-slate-700 px-4 py-12 text-white sm:px-6 sm:py-20 lg:px-8">
            <div className="mx-auto max-w-7xl">
                {/* Stats Row */}
                <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.5 }}
                    className="mb-12 grid grid-cols-2 gap-4 border-b border-white/10 pb-10 sm:gap-8 lg:grid-cols-4"
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
                            <div className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-1 text-balance">
                                {stat.value}
                            </div>
                            <div className="text-xs sm:text-sm font-semibold text-white mb-1">{stat.label}</div>
                            <div className="mx-auto hidden max-w-[160px] text-xs leading-snug text-slate-300 sm:block">{stat.description}</div>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Testimonials */}
                <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={shouldReduceMotion ? { duration: 0.01 } : { delay: 0.3 }}
                    className="relative"
                >
                    <div className="mx-auto max-w-3xl text-center mb-8 sm:mb-10">
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance">
                            Used by real estate professionals collecting utility info on real files
                        </h2>
                        <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed">
                            Real feedback from TCs and real estate professionals using UtilitySheet to get cleaner seller submissions with less back-and-forth.
                        </p>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
                        {customerTestimonials.map((testimonial) => (
                            <div
                                key={testimonial.name}
                                className="relative flex min-h-[360px] flex-col rounded-lg border border-white/10 bg-white/[0.055] p-6 sm:p-7"
                            >
                                <Quote className="mb-5 h-7 w-7 text-emerald-300" aria-hidden="true" />
                                <blockquote className="mb-7 flex-1 text-sm font-medium leading-7 text-slate-100 sm:text-[0.9375rem]">
                                    &ldquo;{testimonial.quote}&rdquo;
                                </blockquote>
                                <div className="flex items-start gap-4 border-t border-white/10 pt-5">
                                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-400/15 text-sm font-semibold text-emerald-100">
                                        {testimonial.initials}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-white">{testimonial.name}</div>
                                        <div className="mt-0.5 text-sm leading-snug text-slate-300">{testimonial.role}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 rounded-lg border border-white/10 bg-slate-800/40 p-6 sm:p-8 lg:flex lg:items-start lg:gap-10">
                        <div className="lg:w-5/12">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200 sm:text-sm">
                                Origin story
                            </p>
                            <h3 className="mt-3 text-2xl font-bold tracking-tight text-white">
                                {originStoryTestimonial.heading}
                            </h3>
                            <p className="mt-3 text-sm sm:text-base leading-7 text-slate-300">
                                {originStoryTestimonial.description}
                            </p>
                        </div>
                        <div className="mt-6 border-t border-white/10 pt-6 lg:mt-0 lg:w-7/12 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
                            <Quote className="w-7 h-7 text-emerald-300 mb-4" aria-hidden="true" />
                            <blockquote className="text-sm font-medium leading-7 text-slate-100 sm:text-base">
                                &ldquo;{originStoryTestimonial.quote}&rdquo;
                            </blockquote>
                            <div className="mt-5 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-emerald-400/15 border border-emerald-300/30 flex items-center justify-center text-sm font-semibold text-emerald-100 flex-shrink-0">
                                    DO
                                </div>
                                <div>
                                    <div className="font-semibold text-white">{originStoryTestimonial.name}</div>
                                    <div className="text-sm text-slate-300">{originStoryTestimonial.role}</div>
                                </div>
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

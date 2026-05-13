'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Clock, Link2, FileText, Quote } from 'lucide-react';

const stats = [
    {
        icon: Clock,
        value: 'Reusable',
        label: 'Seller link',
        description: 'Add one link to your templates and reuse it across transactions',
    },
    {
        icon: Link2,
        value: '1 link',
        label: 'Shared with sellers',
        description: 'No app install, no login, no account required for the seller',
    },
    {
        icon: FileText,
        value: 'PDF',
        label: 'Ready after submission',
        description: 'Review the web sheet and download a shareable utility sheet PDF',
    },
];

const customerTestimonials = [
    {
        quote: 'Before UtilitySheet, we were sending a blank form to homeowners through Dotloop or DocuSign. It was a pain and rarely came back completed. UtilitySheet transformed the process. Now we send the generic seller link from a templated email, get notified when it\'s complete, download the finished sheet, and we\'re done. It saves time, helps us streamline, and the AI prediction makes it super simple for clients.',
        name: 'Kaylin Nunn',
        role: 'Owner & Director of Transaction Coordination, Precision Leverage Solutions',
        initials: 'KN',
    },
    {
        quote: 'UtilitySheet has made obtaining utility information much easier. Before, we were sending emails asking for the info and trying to track down utility companies last minute. Now we keep the email simple, send sellers the UtilitySheet link, and the completion rate has been pretty dang good. I would absolutely recommend it to another TC or agent.',
        name: 'Courtney Bownes',
        role: 'Owner | Lead Transaction Manager, FastForward Transaction Management',
        initials: 'CB',
    },
    {
        quote: 'Before UtilitySheet, I was using a Google spreadsheet with local providers and copying/pasting information into emails, which made it difficult to find the correct providers for unique cities and townships. UtilitySheet makes it easy for the co-op agent to send the form to the seller, and I love that it doesn\'t collect confidential information. The completed branded PDF helps level up my TC company\'s service for agents and their clients.',
        name: 'Agatha Aquilia',
        role: 'Transaction Manager, Aquilia Associates',
        initials: 'AA',
    },
];

const originStoryTestimonial = {
    heading: 'Built from real TC workflow',
    description: 'UtilitySheet started as an internal tool for a working transaction coordinator, then grew into a reusable seller intake workflow for TCs and real estate teams.',
    quote: 'Before UtilitySheet, I was chasing utility information through texts and emails, then cleaning up vague answers like "the gas company" right before closing. Now I send sellers one link, they complete the guided form, and I get a clean branded sheet that is easy to review and share with everyone who needs it.',
    name: 'Debbie O\'Brien',
    role: 'Transaction Coordinator, PA Real Estate Support Services, LLC',
};

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
                            <div className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-1 text-balance">
                                {stat.value}
                            </div>
                            <div className="text-xs sm:text-sm font-semibold text-white mb-1">{stat.label}</div>
                            <div className="text-xs text-slate-300 max-w-[160px] mx-auto hidden sm:block leading-snug">{stat.description}</div>
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
                            Trusted by real estate professionals using UtilitySheet in the field
                        </h2>
                        <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed">
                            Real feedback from TCs and real estate professionals using UtilitySheet to collect seller utility information faster and deliver cleaner branded PDFs.
                        </p>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
                        {customerTestimonials.map((testimonial) => (
                            <div
                                key={testimonial.name}
                                className="relative bg-white/5 border border-white/10 rounded-lg p-6 sm:p-7 flex flex-col"
                            >
                                <Quote className="w-7 h-7 text-emerald-300 mb-5" aria-hidden="true" />
                                <blockquote className="text-sm sm:text-base font-medium leading-7 mb-6 text-slate-100 flex-1">
                                    &ldquo;{testimonial.quote}&rdquo;
                                </blockquote>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-emerald-400/15 border border-emerald-300/30 flex items-center justify-center text-sm font-semibold text-emerald-100 flex-shrink-0">
                                        {testimonial.initials}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-white">{testimonial.name}</div>
                                        <div className="text-sm text-slate-300">{testimonial.role}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 rounded-lg border border-white/10 bg-slate-800/40 p-6 sm:p-8 lg:flex lg:items-start lg:gap-10">
                        <div className="lg:w-5/12">
                            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">
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
                            <blockquote className="text-sm sm:text-base font-medium leading-7 text-slate-100">
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

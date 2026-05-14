'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { MousePointer2, FileCheck, Download } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/events';

export function HowItWorks() {
    const sectionRef = useRef<HTMLElement | null>(null);
    const isInView = useInView(sectionRef, { once: true, margin: '-20% 0px -20% 0px' });

    useEffect(() => {
        if (!isInView) return;

        trackEvent('landing_section_viewed', {
            section_id: 'how_it_works',
            page: 'landing',
            location: 'how_it_works',
        });
        trackEvent('pdf_attachment_value_prop_viewed', {
            section_id: 'how_it_works',
            page: 'landing',
            location: 'how_it_works',
        });
    }, [isInView]);

    return (
        <section ref={sectionRef} id="how-it-works" className="scroll-mt-24 py-16 sm:py-24 lg:py-32 bg-background relative overflow-hidden">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="text-center mb-12 sm:mb-16 lg:mb-24">
                    <p className="text-slate-600 font-bold text-xs sm:text-sm tracking-wider uppercase mb-2 sm:mb-3">How it works</p>
                    <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground tracking-tight text-balance">
                        How the seller-link flow works
                    </h2>
                    <p className="mt-4 max-w-3xl mx-auto text-base sm:text-lg text-muted-foreground">
                        Set up one reusable link, add it to your listing email template or send it directly, then let the seller complete the utility form from their phone.
                    </p>
                </div>

                <div className="space-y-16 sm:space-y-24 lg:space-y-32">
                    {/* Step 1: Generate Link */}
                    <div className="flex flex-col lg:flex-row items-center gap-8 sm:gap-12 lg:gap-20">
                        <div className="flex-1 text-center lg:text-left">
                            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-slate-500/10 text-slate-600 mb-4 sm:mb-8">
                                <MousePointer2 className="w-6 h-6 sm:w-8 sm:h-8" />
                            </div>
                            <h4 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2 sm:mb-4">
                                <span className="text-slate-600 mr-2">01.</span>
                                Set up your reusable seller link
                            </h4>
                            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto lg:mx-0">
                                Your workspace starts with one seller link you can reuse across files. Add it to your listing email template, text template, checklist, or send it directly on a transaction.
                            </p>
                        </div>
                        <div className="flex-1 w-full max-w-[500px] lg:max-w-none">
                            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border/50 bg-card group">
                                <Image
                                    src="/landing/demo-seller-link-dashboard.jpg"
                                    alt="UtilitySheet dashboard showing one reusable seller link ready to copy and send"
                                    width={1600}
                                    height={900}
                                    className="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-700"
                                />
                                <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-2xl" />
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Seller Confirms */}
                    <div className="flex flex-col lg:flex-row-reverse items-center gap-8 sm:gap-12 lg:gap-20">
                        <div className="flex-1 text-center lg:text-left">
                            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-slate-500/10 text-slate-600 mb-4 sm:mb-8">
                                <FileCheck className="w-6 h-6 sm:w-8 sm:h-8" />
                            </div>
                            <h4 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2 sm:mb-4">
                                <span className="text-slate-600 mr-2">02.</span>
                                Seller enters the address and confirms utilities
                            </h4>
                            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto lg:mx-0">
                                Sellers open the link on their phone, enter the property address, and move through a guided utility form. UtilitySheet can suggest likely providers based on the address, and sellers can confirm, search, or type their own answer.
                            </p>
                        </div>
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            transition={{ duration: 0.7 }}
                            className="flex-1 w-full max-w-[500px] lg:max-w-none"
                        >
                            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border/50 bg-card group">
                                <Image
                                    src="/landing/demo-provider-confirmation.jpg"
                                    alt="Mobile seller form showing guided utility questions inside UtilitySheet"
                                    width={1600}
                                    height={900}
                                    className="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-700"
                                />
                                <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-2xl" />
                            </div>
                        </motion.div>
                    </div>

                    {/* Step 3: Share the Utility Sheet */}
                    <div className="flex flex-col lg:flex-row items-center gap-8 sm:gap-12 lg:gap-20">
                        <div className="flex-1 text-center lg:text-left">
                            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-slate-500/10 text-slate-600 mb-4 sm:mb-8">
                                <Download className="w-6 h-6 sm:w-8 sm:h-8" />
                            </div>
                            <h4 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2 sm:mb-4">
                                <span className="text-slate-600 mr-2">03.</span>
                                Get a clean sheet and PDF back
                            </h4>
                            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto lg:mx-0">
                                After submission, your team gets a clean web sheet and downloadable PDF. Your completion email can include the finished PDF automatically, and Pro/Teams can make dashboard edits that carry through to future PDF downloads.
                            </p>
                        </div>
                        <motion.div
                            initial={{ opacity: 0, x: 50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            transition={{ duration: 0.7 }}
                            className="flex-1 w-full max-w-[500px] lg:max-w-none"
                        >
                            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border/50 bg-card group">
                                <Image
                                    src="/landing/demo-dashboard-saved.jpg"
                                    alt="UtilitySheet dashboard showing submitted requests with options to view, edit, and download the PDF"
                                    width={1600}
                                    height={900}
                                    className="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-700"
                                />
                                <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-2xl" />
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    );
}

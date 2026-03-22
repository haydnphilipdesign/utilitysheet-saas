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
                    <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground tracking-tight">
                        From seller utility form to buyer-ready utility sheet
                    </h2>
                    <p className="mt-4 max-w-3xl mx-auto text-base sm:text-lg text-muted-foreground">
                        UtilitySheet gives real estate teams a repeatable utility handoff workflow: send one link, collect cleaner seller data, and deliver a finished utility sheet without the usual chasing.
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
                                Send your reusable seller link
                            </h4>
                            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto lg:mx-0">
                                Share the same seller utility form link on every file. Sellers open it, enter the property address, and start without downloading an app or creating an account.
                            </p>
                        </div>
                        <div className="flex-1 w-full max-w-[500px] lg:max-w-none">
                            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border/50 bg-card group">
                                <Image
                                    src="/landing/new-request.png"
                                    alt="UtilitySheet dashboard showing how to send a reusable seller utility information request"
                                    width={1600}
                                    height={1040}
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
                                Seller confirms utility providers
                            </h4>
                            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto lg:mx-0">
                                Sellers review suggested providers, correct anything that looks off, and submit a cleaner utility handoff. Advanced mode can also capture access details, service vendors, and move-related notes.
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
                                    src="/landing/seller-wizard.png"
                                    alt="Seller utility information form with guided provider suggestions inside UtilitySheet"
                                    width={1600}
                                    height={1040}
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
                                Receive a polished utility sheet PDF
                            </h4>
                            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto lg:mx-0">
                                As soon as the seller submits, your team gets a clean web view and downloadable PDF. Share it with buyers, add it to the file, or pass it to support staff without more formatting work.
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
                                    src="/landing/utility-info-sheet.png"
                                    alt="Generated utility sheet PDF for a real estate transaction"
                                    width={1600}
                                    height={1040}
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

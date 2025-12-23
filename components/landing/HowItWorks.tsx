'use client';

import { motion } from 'framer-motion';
import { MousePointer2, FileCheck, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

const steps = [
    {
        id: "01",
        title: "Generate a Link",
        description: "Enter the property address and select needed utilities. We generate a secure unique link in seconds.",
        icon: MousePointer2
    },
    {
        id: "02",
        title: "Seller Confirms",
        description: "Sellers tap to confirm likely providers suggested by our AI. No account setup required for them.",
        icon: FileCheck
    },
    {
        id: "03",
        title: "Download Info Sheet",
        description: "Get a professional, branded PDF with all contact info, start-service links, and instructions.",
        icon: Download
    }
];

export function HowItWorks() {
    return (
        <section id="how-it-works" className="py-24 sm:py-32 bg-background relative overflow-hidden">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="text-center mb-24">
                    <h2 className="text-slate-600 font-bold text-sm tracking-wider uppercase mb-3">Workflow</h2>
                    <h3 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight">How it works</h3>
                </div>

                <div className="space-y-24 sm:space-y-32">
                    {/* Step 1: Generate Link */}
                    <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
                        <div className="flex-1 text-center lg:text-left">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 text-slate-600 mb-8">
                                <MousePointer2 className="w-8 h-8" />
                            </div>
                            <h4 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                                <span className="text-slate-600 mr-2">01.</span>
                                Generate a Link
                            </h4>
                            <p className="text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto lg:mx-0">
                                Enter the property address and select needed utilities. We generate a secure unique link in seconds to send to your client.
                            </p>
                        </div>
                        <div className="flex-1 w-full max-w-[500px] lg:max-w-none">
                            <div className="relative aspect-video rounded-xl bg-card border border-border flex items-center justify-center shadow-lg overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-tr from-slate-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="text-center p-8">
                                    <div className="bg-emerald-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                                        <MousePointer2 className="w-10 h-10 text-slate-600" />
                                    </div>
                                    <p className="text-sm text-muted-foreground">Secure Dashboard Link Generated</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Seller Confirms */}
                    <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-20">
                        <div className="flex-1 text-center lg:text-left">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 text-slate-600 mb-8">
                                <FileCheck className="w-8 h-8" />
                            </div>
                            <h4 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                                <span className="text-slate-600 mr-2">02.</span>
                                Seller Confirms
                            </h4>
                            <p className="text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto lg:mx-0">
                                Sellers tap to confirm likely providers suggested by our AI. No account setup or complex forms required for them.
                            </p>
                        </div>
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            transition={{ duration: 0.7 }}
                            className="flex-1 w-full max-w-[500px] lg:max-w-none"
                        >
                            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border/50 bg-card">
                                <img
                                    src="/landing/seller-wizard-electric.png"
                                    alt="Seller Wizard Interface - Confirming Electric Provider"
                                    className="w-full h-auto object-cover"
                                />
                                <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-2xl" />
                            </div>
                        </motion.div>
                    </div>

                    {/* Step 3: Download Packet */}
                    <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
                        <div className="flex-1 text-center lg:text-left">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 text-slate-600 mb-8">
                                <Download className="w-8 h-8" />
                            </div>
                            <h4 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                                <span className="text-slate-600 mr-2">03.</span>
                                Download Info Sheet
                            </h4>
                            <p className="text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto lg:mx-0">
                                Get a professional, branded PDF with all contact info, start-service links, and instructions ready to hand off to the buyer.
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
                                <img
                                    src="/landing/utility-packet.png"
                                    alt="Generated Utility Info Sheet PDF"
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

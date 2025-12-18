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
        title: "Download Packet",
        description: "Get a professional, branded PDF with all contact info, start-service links, and instructions.",
        icon: Download
    }
];

export function HowItWorks() {
    return (
        <section id="how-it-works" className="py-32 bg-zinc-950 relative overflow-hidden">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="text-center mb-24">
                    <h2 className="text-emerald-500 font-bold text-sm tracking-wider uppercase mb-3">Workflow</h2>
                    <h3 className="text-3xl md:text-5xl font-bold text-white tracking-tight">How it works</h3>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {steps.map((step, i) => (
                        <motion.div
                            key={step.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.2, duration: 0.5 }}
                            viewport={{ once: true }}
                            className="relative group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="relative p-8 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-emerald-500/30 transition-colors h-full">
                                <div className="absolute top-4 right-6 text-6xl font-black text-zinc-800/50 select-none group-hover:text-emerald-500/10 transition-colors">
                                    {step.id}
                                </div>

                                <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-8 shadow-lg group-hover:shadow-emerald-500/20 group-hover:border-emerald-500/50 transition-all">
                                    <step.icon className="h-6 w-6 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
                                </div>

                                <h4 className="text-xl font-bold text-white mb-4">{step.title}</h4>
                                <p className="text-zinc-400 leading-relaxed">
                                    {step.description}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

'use client';

import { motion } from 'framer-motion';
import { Clock, Zap, Shield, Sparkles, Smartphone, CheckCircle2 } from 'lucide-react';

const features = [
    {
        icon: Clock,
        title: "2-Minute Seller Form",
        description: "Smart suggestions mean sellers just tap to confirm providers. No bills or manual typing required."
    },
    {
        icon: Zap,
        title: "Instant AI Resolution",
        description: "Our AI engine automatically finds contact info and 'Start Service' links for every provider."
    },
    {
        icon: Shield,
        title: "Branded Packets",
        description: "Generate beautiful, professional PDFs for buyers with your brokerage's branding and colors."
    },
    {
        icon: Smartphone,
        title: "Mobile First",
        description: "Designed for on-the-go agents and clients. Works perfectly on any device."
    },
    {
        icon: Sparkles,
        title: "Smart Suggestions",
        description: "We predict utility providers based on address location with high accuracy."
    },
    {
        icon: CheckCircle2,
        title: "Task Tracking",
        description: "Keep track of every active listing's utility status in one dashboard."
    }
];

export function FeatureSection() {
    return (
        <section id="features" className="py-24 bg-zinc-950 px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                <div className="text-center mb-20">
                    <h2 className="text-emerald-500 font-bold text-sm tracking-wider uppercase mb-3">Features</h2>
                    <h3 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Everything you need to automate utilities</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, idx) => (
                        <motion.div
                            key={idx}
                            whileHover={{ y: -5 }}
                            className="group p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800 hover:border-emerald-500/30 transition-all hover:bg-zinc-900/60"
                        >
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-6 group-hover:bg-emerald-500/20 transition-colors">
                                <feature.icon className="h-6 w-6 text-emerald-400" />
                            </div>
                            <h4 className="text-xl font-bold text-white mb-3">{feature.title}</h4>
                            <p className="text-zinc-400 leading-relaxed">{feature.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

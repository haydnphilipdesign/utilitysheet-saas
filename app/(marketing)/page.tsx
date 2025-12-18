'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Zap, ArrowRight, Shield, Clock, MousePointer2 } from 'lucide-react';

export default function LandingPage() {
    return (
        <div className="relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 w-full h-[1000px] pointer-events-none opacity-20">
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/30 blur-[120px] rounded-full" />
                <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-emerald-600/20 blur-[120px] rounded-full" />
            </div>

            {/* Hero Section */}
            <section className="px-4 pt-24 pb-20 sm:pt-32 sm:pb-32 lg:px-8">
                <div className="mx-auto max-w-7xl text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-8">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            Now in Beta for Real Estate Professionals
                        </div>
                        <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-7xl lg:text-8xl mb-8">
                            Utility handoffs. <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600">
                                Automated.
                            </span>
                        </h1>
                        <p className="mx-auto max-w-2xl text-lg text-zinc-400 sm:text-xl lg:text-2xl mb-10">
                            The fastest way to collect and share utility provider information.
                            Sellers complete a tap-to-confirm form in 2 minutes. We do the rest.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link href="/auth/signup">
                                <Button size="lg" className="h-14 px-8 text-lg bg-emerald-500 text-white hover:bg-emerald-600 shadow-xl shadow-emerald-500/25">
                                    Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            </Link>
                            <Link href="#how-it-works">
                                <Button size="lg" variant="ghost" className="h-14 px-8 text-lg text-zinc-300 hover:text-white hover:bg-zinc-800/50">
                                    See How it Works
                                </Button>
                            </Link>
                        </div>

                        <div className="mt-16 relative">
                            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 blur-[10px] -z-10" />
                            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 backdrop-blur-sm">
                                <div className="aspect-video rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center overflow-hidden">
                                    {/* Simplified Illustration of Dashboard */}
                                    <div className="w-full h-full p-8 flex flex-col gap-4">
                                        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                                            <div className="w-48 h-6 bg-zinc-800 rounded" />
                                            <div className="flex gap-2">
                                                <div className="w-8 h-8 rounded-full bg-zinc-800" />
                                                <div className="w-8 h-8 rounded-full bg-zinc-800" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="h-32 bg-zinc-900 rounded-lg border border-zinc-800 p-4">
                                                <div className="w-12 h-12 rounded bg-emerald-500/20 mb-3" />
                                                <div className="w-full h-4 bg-zinc-800 rounded mb-2" />
                                                <div className="w-2/3 h-4 bg-zinc-800 rounded" />
                                            </div>
                                            <div className="h-32 bg-zinc-900 rounded-lg border border-zinc-800 p-4">
                                                <div className="w-12 h-12 rounded bg-emerald-500/20 mb-3" />
                                                <div className="w-full h-4 bg-zinc-800 rounded mb-2" />
                                                <div className="w-2/3 h-4 bg-zinc-800 rounded" />
                                            </div>
                                            <div className="h-32 bg-zinc-900 rounded-lg border border-zinc-800 p-4">
                                                <div className="w-12 h-12 rounded bg-emerald-500/20 mb-3" />
                                                <div className="w-full h-4 bg-zinc-800 rounded mb-2" />
                                                <div className="w-2/3 h-4 bg-zinc-800 rounded" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-24 bg-zinc-950 px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-7xl">
                    <div className="text-center mb-20">
                        <h2 className="text-emerald-500 font-semibold text-base mb-2">Features</h2>
                        <h3 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Everything you need to automate utilities</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
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
                            }
                        ].map((feature, idx) => (
                            <motion.div
                                key={idx}
                                whileHover={{ y: -5 }}
                                className="group p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800 hover:border-emerald-500/30 transition-all"
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

            {/* How it Works */}
            <section id="how-it-works" className="py-24 border-t border-zinc-900/50 px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-7xl">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div className="order-2 lg:order-1">
                            <div className="space-y-12">
                                {[
                                    {
                                        step: "01",
                                        title: "Generate a Link",
                                        description: "Enter the property address and select the utility categories you need. We generate a unique, unguessable link in seconds."
                                    },
                                    {
                                        step: "02",
                                        title: "Seller Confirms",
                                        description: "Sellers receive the link on their phone. We use address-first logic to suggest likely providers. They just tap 'Confirm'."
                                    },
                                    {
                                        step: "03",
                                        title: "Handoff the Packet",
                                        description: "Download the branded PDF or share the live link. It includes all contact info, next steps, and essential links for the buyer."
                                    }
                                ].map((step, idx) => (
                                    <div key={idx} className="flex gap-6">
                                        <div className="text-4xl font-black text-emerald-500/20">{step.step}</div>
                                        <div>
                                            <h4 className="text-xl font-bold text-white mb-2">{step.title}</h4>
                                            <p className="text-zinc-400">{step.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="order-1 lg:order-2 relative">
                            <div className="absolute inset-0 bg-emerald-500/10 blur-[80px] rounded-full" />
                            <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 overflow-hidden">
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                            <MousePointer2 className="h-5 w-5 text-emerald-400" />
                                        </div>
                                        <span className="text-lg font-medium text-white">Select Electric Provider</span>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="p-4 rounded-xl bg-zinc-800/50 border border-emerald-500/50 flex items-center justify-between">
                                            <span className="text-white">National Grid</span>
                                            <div className="px-3 py-1 bg-emerald-500 rounded-lg text-xs font-bold text-white">SUGGESTED</div>
                                        </div>
                                        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-between grayscale opacity-50">
                                            <span className="text-white">Eversource</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button className="w-full bg-emerald-500 text-white">Confirm</Button>
                                        <Button variant="outline" className="w-full border-zinc-700 text-zinc-300">Not This</Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-5xl">
                    <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-8 md:p-16 text-center shadow-2xl shadow-emerald-500/20">
                        <h2 className="text-3xl font-bold text-white mb-6 sm:text-5xl">Ready to save hours on every closing?</h2>
                        <p className="text-emerald-50/80 text-lg mb-10 max-w-2xl mx-auto">
                            Join hundreds of agents and TCs who use UtilitySheet to simplify their workflow and wow their clients.
                        </p>
                        <Link href="/auth/signup">
                            <Button size="lg" className="bg-white text-emerald-600 hover:bg-emerald-50 h-14 px-10 text-xl font-bold">
                                Get Started for Free
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}

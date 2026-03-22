import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { createPageMetadata } from '@/lib/seo/site';
import { Zap, Shield, Users, Clock, Heart, Code, Quote } from 'lucide-react';

export const metadata: Metadata = createPageMetadata({
    title: 'About UtilitySheet',
    description:
        'Learn how UtilitySheet was built from real transaction coordination workflows to make seller utility collection faster, cleaner, and easier to share.',
    path: '/about',
});

export default function AboutPage() {
    return (
        <div className="relative overflow-hidden bg-background">
            {/* Hero Section */}
            <section className="relative pt-24 pb-16 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-600/5 to-transparent" />
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="max-w-3xl">
                        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl mb-6">
                            Built from <span className="text-slate-500">Real Experience</span>
                        </h1>
                        <p className="text-xl text-muted-foreground leading-relaxed">
                            UtilitySheet helps transaction coordinators collect utility providers with one seller link, then deliver a clean utility handoff as either a Simple Utility Sheet or an Advanced Utility Packet (web + PDF). It was built from real closing workflow pain.
                        </p>
                    </div>
                </div>
            </section>

            {/* What It Does + 3-Step Summary */}
            <section className="py-10 bg-background">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-6 sm:p-8">
                        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">What UtilitySheet does</h2>
                        <p className="text-muted-foreground text-base sm:text-lg max-w-3xl">
                            UtilitySheet helps transaction coordinators collect utility provider details from sellers and deliver clean handoff output without repeated follow-ups - with both simple and advanced packet options.
                        </p>

                        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Step 1</p>
                                <p className="font-semibold text-foreground">Send one guided seller link</p>
                                <p className="text-sm text-muted-foreground mt-1">No login required for the seller.</p>
                            </div>
                            <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Step 2</p>
                                <p className="font-semibold text-foreground">Seller confirms providers</p>
                                <p className="text-sm text-muted-foreground mt-1">Address-based suggestions plus optional advanced transition modules.</p>
                            </div>
                            <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Step 3</p>
                                <p className="font-semibold text-foreground">Deliver simple or advanced packet output</p>
                                <p className="text-sm text-muted-foreground mt-1">Completion emails can include the finished PDF attachment automatically.</p>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-col sm:flex-row gap-3">
                            <Link href="/auth/signup">
                                <Button className="w-full sm:w-auto bg-emerald-600 text-white hover:bg-emerald-500">Start Free</Button>
                            </Link>
                            <Link href="/demo">
                                <Button variant="outline" className="w-full sm:w-auto">Try Demo</Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Origin Story Section */}
            <section className="py-12 bg-muted/30">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        {/* Story Content */}
                        <div className="order-2 lg:order-1">
                            <div className="flex items-center gap-3 mb-6">
                                <Heart className="h-6 w-6 text-rose-500" />
                                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">The Origin Story</span>
                            </div>
                                <h2 className="text-3xl font-bold text-foreground mb-6">It Started with My Mom</h2>
                            <div className="space-y-4 text-lg text-muted-foreground">
                                <p>
                                    My mom, <strong className="text-foreground">Debbie O’Brien</strong>, runs <strong className="text-foreground">PA Real Estate Support Services, LLC</strong>—a transaction coordination business. Watching her manage high-volume closings made one thing painfully obvious:
                                </p>
                                <p className="pl-4 border-l-4 border-slate-500 italic">
                                    Collecting utility provider information from sellers is way more chaotic than it should be.
                                </p>
                                <p>
                                    You know the drill: back-and-forth texts, half-filled forms, sellers saying “the gas company” instead of the actual provider name, and last-minute scrambles right before closing.
                                </p>
                                <p>
                                    I’m a web developer, and I’ve spent years building tools around her workflow—custom intake forms, process automation, PDF generation—anything to reduce repetitive admin work.
                                </p>
                                <p className="font-medium text-foreground">
                                    UtilitySheet came directly from that: a fast, standardized way to collect utility info and generate a clean sheet that travels with the transaction.
                                </p>
                            </div>
                        </div>

                        {/* Photos and Logo */}
                        <div className="order-1 lg:order-2 flex flex-col items-center gap-8">
                            {/* Both photos side by side */}
                            <div className="flex flex-col sm:flex-row items-center gap-8">
                                {/* Debbie - The TC Veteran */}
                                <div className="flex flex-col items-center gap-3">
                                    <div className="relative">
                                        <div className="absolute -inset-3 bg-gradient-to-r from-rose-500/20 to-pink-500/20 rounded-full blur-xl" />
                                        <div className="relative w-44 h-44 rounded-full overflow-hidden border-4 border-background shadow-2xl">
                                            <Image
                                                src="/debbie_headshot.png"
                                                alt="Debbie O'Brien - PA Real Estate Support Services"
                                                fill
                                                className="object-cover"
                                            />
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-semibold text-foreground">Debbie O’Brien</p>
                                        <p className="text-sm text-muted-foreground">The TC Veteran</p>
                                    </div>
                                </div>

                                {/* Haydn - The Developer */}
                                <div className="flex flex-col items-center gap-3">
                                    <div className="relative">
                                        <div className="absolute -inset-3 bg-gradient-to-r from-slate-500/20 to-sky-500/20 rounded-full blur-xl" />
                                        <div className="relative w-44 h-44 rounded-full overflow-hidden border-4 border-background shadow-2xl">
                                            <Image
                                                src="/haydn.png"
                                                alt="Haydn - Developer of UtilitySheet"
                                                fill
                                                className="object-cover"
                                            />
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-semibold text-foreground">Haydn</p>
                                        <p className="text-sm text-muted-foreground">The Developer</p>
                                    </div>
                                </div>
                            </div>

                            {/* Logo */}
                            <div className="text-center mt-4">
                                <Image
                                    src="/pa-real-estate-support.png"
                                    alt="PA Real Estate Support Services Logo"
                                    width={180}
                                    height={54}
                                    className="mx-auto mb-2 dark:brightness-110"
                                />
                                <p className="text-xs text-muted-foreground">
                                    The TC business that inspired it all
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* The Problem Section */}
            <section className="py-12">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="max-w-3xl mx-auto text-center mb-12">
                        <h2 className="text-3xl font-bold text-foreground mb-4">The Problem We Saw</h2>
                        <p className="text-lg text-muted-foreground">
                            On paper, collecting utility info seems simple: “Just tell us who your providers are.” In reality, it’s almost always messy.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                        <div className="bg-muted/50 p-6 rounded-xl border border-border/50">
                            <Quote className="h-6 w-6 text-slate-500 mb-3" />
                            <p className="text-muted-foreground italic">“Who’s your electric company?”</p>
                            <p className="text-foreground font-medium mt-2">“The electric company.”</p>
                        </div>
                        <div className="bg-muted/50 p-6 rounded-xl border border-border/50">
                            <Quote className="h-6 w-6 text-slate-500 mb-3" />
                            <p className="text-muted-foreground italic">“Can you send me the utility info?”</p>
                            <p className="text-foreground font-medium mt-2">“I’ll send it later.” <span className="text-muted-foreground text-sm">(becomes a fire drill)</span></p>
                        </div>
                        <div className="bg-muted/50 p-6 rounded-xl border border-border/50">
                            <Quote className="h-6 w-6 text-slate-500 mb-3" />
                            <p className="text-muted-foreground italic">“What’s the phone number?”</p>
                            <p className="text-foreground font-medium mt-2">“No idea. It’s on the bill somewhere.”</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* What We Built Section */}
            <section className="py-12 bg-muted/30">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <Code className="h-6 w-6 text-slate-500" />
                                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">The Solution</span>
                            </div>
                            <h2 className="text-3xl font-bold text-foreground mb-6">What We Built</h2>
                            <p className="text-lg text-muted-foreground mb-6">
                                UtilitySheet is a lightweight, transaction-friendly way to collect utility provider information and output it in a clean, professional format that can travel with the deal.
                            </p>
                            <p className="text-lg text-muted-foreground">
                                No heavy setup. Sellers complete a guided form, and you get either a Simple Utility Sheet or an Advanced Utility Packet ready to share as web view + PDF. You can also auto-attach that PDF to completion emails.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="bg-background p-6 rounded-2xl shadow-sm border border-border/50">
                                <Clock className="h-8 w-8 text-slate-500 mb-4" />
                                <h3 className="font-semibold text-foreground mb-2">~2 Minutes</h3>
                                <p className="text-sm text-muted-foreground">Designed to be fast for sellers (and easy for you).</p>
                            </div>
                            <div className="bg-background p-6 rounded-2xl shadow-sm border border-border/50 mt-12">
                                <Shield className="h-8 w-8 text-slate-500 mb-4" />
                                <h3 className="font-semibold text-foreground mb-2">Accurate</h3>
                                <p className="text-sm text-muted-foreground">Guided prompts eliminate guesswork and errors.</p>
                            </div>
                            <div className="bg-background p-6 rounded-2xl shadow-sm border border-border/50">
                                <Users className="h-8 w-8 text-slate-500 mb-4" />
                                <h3 className="font-semibold text-foreground mb-2">Brandable</h3>
                                <p className="text-sm text-muted-foreground">Your logo, your colors, your professional look.</p>
                            </div>
                            <div className="bg-background p-6 rounded-2xl shadow-sm border border-border/50 mt-12">
                                <Zap className="h-8 w-8 text-slate-500 mb-4" />
                                <h3 className="font-semibold text-foreground mb-2">Instant</h3>
                                <p className="text-sm text-muted-foreground">PDF ready to download and share immediately.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Who It's For */}
            <section className="py-12">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-bold text-foreground mb-4">Built for TCs. Useful for Everyone.</h2>
                    <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
                        Whether you’re a solo transaction coordinator, a busy agent, or a team that wants more consistent closings—UtilitySheet fits your workflow.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <span className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full text-sm font-medium">Transaction Coordinators</span>
                        <span className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full text-sm font-medium">Real Estate Agents</span>
                        <span className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full text-sm font-medium">Brokerages & Teams</span>
                        <span className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full text-sm font-medium">Title Companies</span>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 px-4 sm:px-6 lg:px-8 relative">
                <div className="mx-auto max-w-5xl">
                    <div className="relative rounded-3xl bg-slate-700 p-8 md:p-16 text-center shadow-2xl shadow-slate-500/20 overflow-hidden">
                        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20 brightness-100 mix-blend-overlay"></div>
                        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-500/20 blur-[80px] rounded-full" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-slate-900/40 blur-[80px] rounded-full" />

                        <div className="relative z-10">
                            <h2 className="text-3xl font-bold text-white mb-6 sm:text-5xl tracking-tight">Ready to simplify your workflow?</h2>
                            <p className="text-slate-100/90 text-lg mb-10 max-w-2xl mx-auto font-medium">
                                Try UtilitySheet free and standardize your utility handoff.
                            </p>
                            <Link href="/auth/signup">
                                <Button size="lg" className="bg-emerald-500 text-white hover:bg-emerald-400 h-14 px-10 text-xl font-bold shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/30 transform hover:-translate-y-1 transition-all">
                                    Get Started Free
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

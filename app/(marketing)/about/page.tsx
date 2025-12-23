import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Zap, Shield, Users, Clock, Heart, Code, Quote } from 'lucide-react';

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
                            UtilitySheet wasn't born in a boardroom. It was built by watching a transaction coordinator handle hundreds of closings — and seeing the same frustrating problem over and over.
                        </p>
                    </div>
                </div>
            </section>

            {/* Origin Story Section */}
            <section className="py-16 bg-muted/30">
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
                                    My mom, <strong className="text-foreground">Debbie O'Brien</strong>, runs <strong className="text-foreground">PA Real Estate Support Services, LLC</strong> — a transaction coordination business. Watching her manage high-volume closings made one thing painfully obvious:
                                </p>
                                <p className="pl-4 border-l-4 border-slate-500 italic">
                                    Collecting utility provider information from sellers is way more chaotic than it should be.
                                </p>
                                <p>
                                    You know the drill: back-and-forth texts, half-filled forms, sellers saying "the gas company" instead of the actual provider name, and last-minute scrambles right before closing.
                                </p>
                                <p>
                                    I'm a web developer, and I've spent years building tools around her workflow — custom intake forms, process automation, PDF generation, anything to reduce the repetitive admin work.
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
                                                src="/debbie.jpg"
                                                alt="Debbie O'Brien - PA Real Estate Support Services"
                                                fill
                                                className="object-cover"
                                            />
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-semibold text-foreground">Debbie O'Brien</p>
                                        <p className="text-sm text-muted-foreground">The TC Veteran</p>
                                    </div>
                                </div>

                                {/* Haydn - The Developer */}
                                <div className="flex flex-col items-center gap-3">
                                    <div className="relative">
                                        <div className="absolute -inset-3 bg-gradient-to-r from-slate-500/20 to-sky-500/20 rounded-full blur-xl" />
                                        <div className="relative w-44 h-44 rounded-full overflow-hidden border-4 border-background shadow-2xl">
                                            <Image
                                                src="/haydn.jpg"
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
            <section className="py-16">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="max-w-3xl mx-auto text-center mb-12">
                        <h2 className="text-3xl font-bold text-foreground mb-4">The Problem We Saw</h2>
                        <p className="text-lg text-muted-foreground">
                            On paper, collecting utility info seems simple: "Just tell us who your providers are." In reality, it's almost always messy.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                        <div className="bg-muted/50 p-6 rounded-xl border border-border/50">
                            <Quote className="h-6 w-6 text-slate-500 mb-3" />
                            <p className="text-muted-foreground italic">"Who's your electric company?"</p>
                            <p className="text-foreground font-medium mt-2">"The electric company."</p>
                        </div>
                        <div className="bg-muted/50 p-6 rounded-xl border border-border/50">
                            <Quote className="h-6 w-6 text-slate-500 mb-3" />
                            <p className="text-muted-foreground italic">"Can you send me the utility info?"</p>
                            <p className="text-foreground font-medium mt-2">"I'll send it later." <span className="text-muted-foreground text-sm">(becomes a fire drill)</span></p>
                        </div>
                        <div className="bg-muted/50 p-6 rounded-xl border border-border/50">
                            <Quote className="h-6 w-6 text-slate-500 mb-3" />
                            <p className="text-muted-foreground italic">"What's the phone number?"</p>
                            <p className="text-foreground font-medium mt-2">"No idea. It's on the bill somewhere."</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* What We Built Section */}
            <section className="py-16 bg-muted/30">
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
                                No databases to maintain. No crazy setup. The seller completes a guided form in minutes, and you get a branded utility sheet instantly — ready to share with agents, buyers, title, whoever needs it.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="bg-background p-6 rounded-2xl shadow-sm border border-border/50">
                                <Clock className="h-8 w-8 text-slate-500 mb-4" />
                                <h3 className="font-semibold text-foreground mb-2">5 Minutes</h3>
                                <p className="text-sm text-muted-foreground">That's all it takes sellers to complete the form.</p>
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
            <section className="py-16">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-bold text-foreground mb-4">Built for TCs. Useful for Everyone.</h2>
                    <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
                        Whether you're a solo transaction coordinator, a busy agent, or a team that wants more consistent closings — UtilitySheet fits your workflow.
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
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 mix-blend-overlay"></div>
                        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-500/20 blur-[80px] rounded-full" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-slate-900/40 blur-[80px] rounded-full" />

                        <div className="relative z-10">
                            <h2 className="text-3xl font-bold text-white mb-6 sm:text-5xl tracking-tight">Ready to simplify your workflow?</h2>
                            <p className="text-slate-100/90 text-lg mb-10 max-w-2xl mx-auto font-medium">
                                Try UtilitySheet free and see why transaction coordinators everywhere are making the switch.
                            </p>
                            <Link href="/auth/signup">
                                <Button size="lg" className="bg-white text-slate-700 hover:bg-slate-50 h-14 px-10 text-xl font-bold shadow-xl shadow-black/10 hover:shadow-black/20 transform hover:-translate-y-1 transition-all">
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

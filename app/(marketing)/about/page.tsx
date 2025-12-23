import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Zap, Shield, Users, Clock } from 'lucide-react';

export default function AboutPage() {
    return (
        <div className="relative overflow-hidden bg-background">
            {/* Hero Section */}
            <section className="relative pt-24 pb-32 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-600/5 to-transparent" />
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="max-w-3xl">
                        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl mb-6">
                            Empowering Real Estate Professionals to <span className="text-slate-500">Close Faster</span>
                        </h1>
                        <p className="text-xl text-muted-foreground leading-relaxed">
                            UtilitySheet is on a mission to standardize and automate the utility handoff process, saving agents hours of manual work and ensuring a seamless experience for buyers and sellers.
                        </p>
                    </div>
                </div>
            </section>

            {/* Mission Section */}
            <section className="py-24 bg-muted/30">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                        <div>
                            <h2 className="text-3xl font-bold text-foreground mb-6">Our Mission</h2>
                            <p className="text-lg text-muted-foreground mb-6">
                                The utility handoff has always been a chaotic, manual last step in the real estate transaction. We believe it doesn't have to be.
                            </p>
                            <p className="text-lg text-muted-foreground">
                                By providing a centralized, standardized platform, we help transaction coordinators and agents collect, verify, and transfer utility information with accuracy and speed. Our goal is to make utility transfer an afterthought, not a headache.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="bg-background p-6 rounded-2xl shadow-sm border border-border/50">
                                <Clock className="h-8 w-8 text-slate-500 mb-4" />
                                <h3 className="font-semibold text-foreground mb-2">Time Saved</h3>
                                <p className="text-sm text-muted-foreground">Reducing hours of phone calls to minutes of clicks.</p>
                            </div>
                            <div className="bg-background p-6 rounded-2xl shadow-sm border border-border/50 mt-12">
                                <Shield className="h-8 w-8 text-slate-500 mb-4" />
                                <h3 className="font-semibold text-foreground mb-2">Accuracy</h3>
                                <p className="text-sm text-muted-foreground">Eliminating errors in critical service transfers.</p>
                            </div>
                            <div className="bg-background p-6 rounded-2xl shadow-sm border border-border/50">
                                <Users className="h-8 w-8 text-slate-500 mb-4" />
                                <h3 className="font-semibold text-foreground mb-2">Experience</h3>
                                <p className="text-sm text-muted-foreground">Delivering a premium closing experience.</p>
                            </div>
                            <div className="bg-background p-6 rounded-2xl shadow-sm border border-border/50 mt-12">
                                <Zap className="h-8 w-8 text-slate-500 mb-4" />
                                <h3 className="font-semibold text-foreground mb-2">Speed</h3>
                                <p className="text-sm text-muted-foreground">Instant access to verified utility data.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Story Section */}
            <section className="py-24">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center max-w-4xl mx-auto">
                    <h2 className="text-3xl font-bold text-foreground mb-8">Our Story</h2>
                    <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                        Founded by industry veterans who were tired of the "utility scramble" before every closing, UtilitySheet was born out of necessity. We realized that while the rest of the real estate transaction had gone digital, utility coordination was still stuck in the age of sticky notes and phone calls.
                    </p>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        Today, we help agents and TCs standardize their workflow and provide a white-glove service to their clients.
                    </p>
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
                            <h2 className="text-3xl font-bold text-white mb-6 sm:text-5xl tracking-tight">Ready to streamline your workflow?</h2>
                            <p className="text-slate-100/90 text-lg mb-10 max-w-2xl mx-auto font-medium">
                                Join the top real estate professionals who trust UtilitySheet.
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

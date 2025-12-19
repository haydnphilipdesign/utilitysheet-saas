'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { HeroSection } from '@/components/landing/HeroSection';
import { FeatureSection } from '@/components/landing/FeatureSection';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { PricingSection } from '@/components/landing/PricingSection';
import { FaqSection } from '@/components/landing/FaqSection';

export default function LandingPage() {
    return (
        <div className="relative overflow-hidden bg-background min-h-screen">
            <HeroSection />
            <FeatureSection />
            <HowItWorks />
            <PricingSection />
            <FaqSection />

            {/* CTA Section */}
            <section className="py-24 px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="mx-auto max-w-5xl">
                    <div className="relative rounded-3xl bg-emerald-600 p-8 md:p-16 text-center shadow-2xl shadow-emerald-500/20 overflow-hidden">
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 mix-blend-overlay"></div>
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/20 blur-[80px] rounded-full" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-800/40 blur-[80px] rounded-full" />

                        <div className="relative z-10">
                            <h2 className="text-3xl font-bold text-white mb-6 sm:text-5xl tracking-tight">Ready to save hours on every closing?</h2>
                            <p className="text-emerald-50/90 text-lg mb-10 max-w-2xl mx-auto font-medium">
                                Join hundreds of agents and TCs who use UtilitySheet to simplify their workflow and wow their clients.
                            </p>
                            <Link href="/auth/signup">
                                <Button size="lg" className="bg-white text-emerald-700 hover:bg-emerald-50 h-14 px-10 text-xl font-bold shadow-xl shadow-black/10 hover:shadow-black/20 transform hover:-translate-y-1 transition-all">
                                    Get Started for Free
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

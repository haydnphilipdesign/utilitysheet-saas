import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { HeroSection } from '@/components/landing/HeroSection';
import { SocialProofBar } from '@/components/landing/SocialProofBar';
import { BeforeAfterSection } from '@/components/landing/BeforeAfterSection';
import { TrustStrip } from '@/components/landing/TrustStrip';
import { ForTcsSection } from '@/components/landing/ForTcsSection';
import { StatsSection } from '@/components/landing/StatsSection';
import { FeatureSection } from '@/components/landing/FeatureSection';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { CopyTemplatesSection } from '@/components/landing/CopyTemplatesSection';
import { PricingSection } from '@/components/landing/PricingSection';
import { FaqSection } from '@/components/landing/FaqSection';
import { StickyCTA } from '@/components/landing/StickyCTA';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function LandingPage() {
    return (
        <div className="relative overflow-hidden bg-background min-h-screen">
            {/* Sticky CTA Banner (appears on scroll) */}
            <StickyCTA />

            {/* Hero Section - Pain-focused headline + Value prop */}
            <HeroSection />

            {/* Social Proof Bar - Stats + Testimonial + Trust badges */}
            <SocialProofBar />

            {/* Before/After Comparison - Old way vs New way */}
            <BeforeAfterSection />

            {/* Trust Strip - Credibility indicators */}
            <TrustStrip />

            {/* For TCs Section - Pain points + Solution */}
            <ForTcsSection />

            {/* Stats Section - Numbers that matter */}
            <StatsSection />

            {/* Feature Section - Product capabilities */}
            <FeatureSection />

            {/* How It Works - Process visualization */}
            <HowItWorks />

            {/* Copy Templates Section - Ready-to-use content */}
            <CopyTemplatesSection />

            {/* Pricing Section - Clear pricing tiers */}
            <PricingSection />

            {/* FAQ Section - Common questions */}
            <FaqSection />

            {/* Final CTA Section - Strong closing */}
            <section className="py-24 px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="mx-auto max-w-5xl">
                    <div className="relative rounded-3xl bg-slate-700 p-8 md:p-16 text-center shadow-2xl shadow-slate-500/20 overflow-hidden">
                        {/* Background Effects */}
                        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20 brightness-100 mix-blend-overlay" />
                        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-500/20 blur-[80px] rounded-full" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-slate-900/40 blur-[80px] rounded-full" />

                        <div className="relative z-10">
                            {/* Badge */}
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-sm font-medium mb-6">
                                <Sparkles className="w-4 h-4" />
                                <span>Join 500+ TCs saving time every day</span>
                            </div>

                            <h2 className="text-3xl font-bold text-white mb-4 sm:text-5xl tracking-tight">
                                Ready to stop the utility back-and-forth?
                            </h2>
                            <p className="text-slate-100/90 text-lg mb-6 max-w-2xl mx-auto font-medium">
                                Start free today. No credit card required. Cancel anytime.
                            </p>
                            
                            {/* Value Props */}
                            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mb-10 text-sm text-slate-200">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    3 free requests/month
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    2-min seller completion
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    Professional PDF output
                                </span>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                                <Link href="/auth/signup">
                                    <Button size="lg" className="bg-white text-slate-700 hover:bg-slate-50 h-14 px-10 text-xl font-bold shadow-xl shadow-black/10 hover:shadow-black/20 transform hover:-translate-y-1 transition-all">
                                        Get Started Free
                                        <ArrowRight className="ml-2 h-5 w-5" />
                                    </Button>
                                </Link>
                                <Link href="/demo">
                                    <Button size="lg" variant="outline" className="h-14 px-10 text-xl font-bold border-white/40 text-white hover:bg-white/10 hover:border-white/60">
                                        Try the Demo
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

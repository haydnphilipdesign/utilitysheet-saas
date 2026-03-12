import { HeroSection } from '@/components/landing/HeroSection';
import { BeforeAfterSection } from '@/components/landing/BeforeAfterSection';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { FeatureSection } from '@/components/landing/FeatureSection';
import { SocialProofBar } from '@/components/landing/SocialProofBar';
import { PricingSection } from '@/components/landing/PricingSection';
import { FaqSection } from '@/components/landing/FaqSection';
import { StickyCTA } from '@/components/landing/StickyCTA';
import { FinalCtaSection } from '@/components/landing/FinalCtaSection';

export default function LandingPage() {
    return (
        <div className="relative overflow-hidden bg-background min-h-screen">
            {/* Sticky CTA Banner (appears after scrolling past social proof) */}
            <StickyCTA />

            {/* Hero — outcome-focused headline + animated visual */}
            <HeroSection />

            {/* Social Proof — stats + real customer quote (builds trust early) */}
            <SocialProofBar />

            {/* Before/After — pain vs. solution contrast */}
            <BeforeAfterSection />

            {/* How It Works — 3-step process visualization */}
            <HowItWorks />

            {/* Features — product capabilities grid */}
            <FeatureSection />

            {/* Pricing — clear tiers */}
            <PricingSection />

            {/* FAQ — top questions */}
            <FaqSection />

            {/* Final CTA — strong closing */}
            <FinalCtaSection />
        </div>
    );
}

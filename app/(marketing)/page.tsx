import { HeroSection } from '@/components/landing/HeroSection';
import { TrustStrip } from '@/components/landing/TrustStrip';
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
            {/* Sticky CTA Banner (appears on scroll) */}
            <StickyCTA />

            {/* Hero Section - Pain-focused headline + Value prop */}
            <HeroSection />

            {/* Trust Strip - Credibility indicators */}
            <TrustStrip />

            {/* Before/After - Establish the pain before explaining the solution */}
            <BeforeAfterSection />

            {/* How It Works - Process visualization */}
            <HowItWorks />

            {/* Feature Section - Product capabilities */}
            <FeatureSection />

            {/* Social Proof - Real quote from founding customer + key metrics */}
            <SocialProofBar />

            {/* Pricing Section - Clear pricing tiers */}
            <PricingSection />

            {/* FAQ Section - Common questions */}
            <FaqSection />

            {/* Final CTA Section - Strong closing */}
            <FinalCtaSection />
        </div>
    );
}

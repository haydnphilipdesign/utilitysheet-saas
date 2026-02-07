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
import { FinalCtaSection } from '@/components/landing/FinalCtaSection';

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
            <FinalCtaSection />
        </div>
    );
}

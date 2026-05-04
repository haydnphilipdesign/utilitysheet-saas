import type { Metadata } from 'next';

import { HeroSection } from '@/components/landing/HeroSection';
import { BeforeAfterSection } from '@/components/landing/BeforeAfterSection';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { FeatureSection } from '@/components/landing/FeatureSection';
import { SocialProofBar } from '@/components/landing/SocialProofBar';
import { PricingSection } from '@/components/landing/PricingSection';
import { FaqSection } from '@/components/landing/FaqSection';
import { StickyCTA } from '@/components/landing/StickyCTA';
import { FinalCtaSection } from '@/components/landing/FinalCtaSection';
import { ForTcsSection } from '@/components/landing/ForTcsSection';
import { AudienceSection } from '@/components/landing/AudienceSection';
import { JsonLd } from '@/components/seo/JsonLd';
import { faqItems } from '@/lib/marketing-content';
import { createPageMetadata } from '@/lib/seo/site';
import {
    faqPageSchema,
    organizationSchema,
    softwareApplicationSchema,
    websiteSchema,
} from '@/lib/seo/schema';

export const metadata: Metadata = createPageMetadata({
    title: 'Share a Seller Link and Get a Ready Utility Sheet',
    description:
        'UtilitySheet helps agents and transaction coordinators share one reusable seller link, collect utility details, and review a clean utility sheet and PDF after submission.',
    path: '/',
});

export default function LandingPage() {
    return (
        <div className="relative overflow-hidden bg-background min-h-screen">
            <JsonLd
                data={[
                    organizationSchema(),
                    websiteSchema(),
                    softwareApplicationSchema({
                        path: '/',
                        description:
                            'Utility sheet software for transaction coordinators and real estate agents built around one reusable seller link, guided utility intake, clean web and PDF output, and dashboard-side updates after submission on paid plans.',
                    }),
                    faqPageSchema(faqItems),
                ]}
            />

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

            {/* Audience pages — internal links for high-intent searches */}
            <AudienceSection />

            {/* Use case content — TC workflow language */}
            <ForTcsSection />

            {/* Pricing — clear tiers */}
            <PricingSection />

            {/* FAQ — top questions */}
            <FaqSection />

            {/* Final CTA — strong closing */}
            <FinalCtaSection />
        </div>
    );
}

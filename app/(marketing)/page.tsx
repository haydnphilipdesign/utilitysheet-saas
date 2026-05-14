import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthenticatedRedirect } from '@/components/landing/AuthenticatedRedirect';
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
            <Suspense fallback={null}>
                <AuthenticatedRedirect />
            </Suspense>
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

            {/* Hero — pain-first seller-link positioning */}
            <HeroSection />

            {/* Before/After — pain vs. solution contrast */}
            <BeforeAfterSection />

            {/* Social Proof — testimonials land hardest right after seeing the demo in the hero */}
            <SocialProofBar />

            {/* How It Works — skimmable still-image walkthrough for people who did not play the hero video */}
            <HowItWorks />

            {/* Features — product capabilities grid */}
            <FeatureSection />

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

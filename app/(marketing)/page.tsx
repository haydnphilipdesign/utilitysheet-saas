import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthenticatedRedirect } from '@/components/landing/AuthenticatedRedirect';
import { ArtifactPreviewBand } from '@/components/landing/ArtifactPreviewBand';
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
    title: 'Seller Utility Handoff Software for Real Estate Closings',
    description:
        'UtilitySheet helps transaction coordinators and real estate teams send one reusable seller link, collect utility details, and produce a clean buyer-ready utility sheet.',
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
                            'Seller utility handoff software for transaction coordinators and real estate teams built around one reusable seller link, guided utility intake, clean web and PDF output, and dashboard-side updates after submission on paid plans.',
                    }),
                    faqPageSchema(faqItems),
                ]}
            />

            {/* Sticky CTA Banner (appears after scrolling past social proof) */}
            <StickyCTA />

            {/* Hero — pain-first seller-link positioning */}
            <HeroSection />

            {/* Artifact preview — show the final utility handoff early */}
            <ArtifactPreviewBand />

            {/* Before/After — pain vs. solution contrast */}
            <BeforeAfterSection />

            {/* Social Proof — testimonials land hardest right after seeing the demo in the hero */}
            <SocialProofBar />

            {/* Use case content — TC workflow language */}
            <ForTcsSection />

            {/* How It Works — skimmable still-image walkthrough for people who did not play the hero video */}
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

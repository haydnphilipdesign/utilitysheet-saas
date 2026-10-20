import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthenticatedRedirect } from '@/components/landing/AuthenticatedRedirect';
import { MarketingWorkflow, MarketingCapabilities, MarketingAudience } from '@/components/landing/MarketingStory';
import { HeroSection } from '@/components/landing/HeroSection';
import { SocialProofBar } from '@/components/landing/SocialProofBar';
import { PricingSection } from '@/components/landing/PricingSection';
import { FaqSection } from '@/components/landing/FaqSection';
import { StickyCTA } from '@/components/landing/StickyCTA';
import { FinalCtaSection } from '@/components/landing/FinalCtaSection';
import { JsonLd } from '@/components/seo/JsonLd';
import { createPageMetadata } from '@/lib/seo/site';
import {
    organizationSchema,
    softwareApplicationSchema,
    websiteSchema,
} from '@/lib/seo/schema';

export const metadata: Metadata = createPageMetadata({
    title: 'Seller Utility Handoff Software for Real Estate Closings',
    description:
        'UtilitySheet helps transaction coordinators and real estate teams send one reusable seller link at listing intake or before closing, collect seller utility details, and produce a clean buyer-ready utility sheet.',
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
                    softwareApplicationSchema(),
                ]}
            />
            <StickyCTA />
            <HeroSection />
            <MarketingWorkflow />
            <MarketingCapabilities />
            <SocialProofBar />
            <MarketingAudience />


            <PricingSection />
            <FaqSection />
            <FinalCtaSection />
        </div>
    );
}

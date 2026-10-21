import type { Metadata } from 'next';

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
    title: 'UtilitySheet: Seller Utility Sheets for Real Estate Closings',
    absoluteTitle: true,
    description:
        'Send sellers one reusable link to collect their electric, water, gas, and internet providers, then share a clean utility sheet and PDF with the buyer.',
    path: '/',
});

export default function LandingPage() {
    return (
        <div className="relative overflow-hidden bg-background min-h-screen">
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

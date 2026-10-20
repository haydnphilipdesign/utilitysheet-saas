import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Check } from 'lucide-react';

import { MarketingHeroArt } from '@/components/marketing/hero-art';
import {
    MarketingBreadcrumbs,
    MarketingPageHero,
    MarketingSection,
    MarketingStepRow,
} from '@/components/marketing/page-shell';
import { MockGuidedForm, MockSheet } from '@/components/marketing/product-mockups';
import { JsonLd } from '@/components/seo/JsonLd';
import { createPageMetadata } from '@/lib/seo/site';
import { breadcrumbSchema } from '@/lib/seo/schema';
import { GenericSenderIntro, ReferralSignupCta, SenderIntro, SignupCta } from './referral';

export const metadata: Metadata = createPageMetadata({
    title: 'You Received a UtilitySheet',
    description:
        'A transaction professional sent you a utility sheet made with UtilitySheet. See how it was collected and create your own reusable seller utility link.',
    path: '/from-a-closing',
    keywords: [
        'utility sheet from closing',
        'seller utility information form',
        'transaction coordinator utility link',
    ],
});

const workflowSteps = [
    {
        title: 'One reusable link',
        copy:
            'The coordinator keeps a single seller link in their email templates and closing checklists. No new form is built for each property.',
    },
    {
        title: 'The seller confirms providers',
        copy:
            'The seller opens the link on their phone, enters the property address, and confirms or types each utility provider.',
    },
    {
        title: 'A clean sheet comes back',
        copy:
            'The finished utility sheet arrives as a web page and PDF, ready to review, save to the file, and share with the buyer side.',
    },
] as const;

// Static on purpose: a dynamic route streams its metadata into <body>, which
// costs the page its Lighthouse meta-description audit. The referral parts
// (sender brand, signup attribution) are client islands that read the query
// string after load; see ./referral.tsx.
export default function FromAClosingPage() {
    return (
        <div className="bg-background">
            <JsonLd
                data={breadcrumbSchema([
                    { name: 'Home', path: '/' },
                    { name: 'From a Closing', path: '/from-a-closing' },
                ])}
            />

            <MarketingPageHero
                art={<MarketingHeroArt primary={<MockSheet />} secondary={<MockGuidedForm />} />}
                eyebrow="For closing professionals"
                title="You just received a UtilitySheet"
                description={
                    <Suspense fallback={<GenericSenderIntro />}>
                        <SenderIntro />
                    </Suspense>
                }
            >
                <MarketingBreadcrumbs
                    items={[
                        { label: 'Home', href: '/' },
                        { label: 'From a Closing', href: '/from-a-closing' },
                    ]}
                />
            </MarketingPageHero>

            <MarketingSection
                title="How the sheet you received was made"
                description="Three steps, no chasing, and nothing for the seller to research or upload."
            >
                <MarketingStepRow steps={workflowSteps} />
                <p className="marketing-section-note">
                    Passing the sheet to your buyer? Send them the{' '}
                    <Link
                        href="/guides/set-up-utilities-when-buying-a-house"
                        className="font-semibold text-foreground underline underline-offset-4"
                    >
                        guide to setting up utilities when buying a house
                    </Link>
                    .
                </p>
            </MarketingSection>

            <MarketingSection
                title="Why coordinators switch"
                description="UtilitySheet was built from a working transaction coordinator's own listing-side workflow."
            >
                <ul className="marketing-note-grid">
                    {[
                        'Sellers need no account, no app, and no research. "Not sure" is always allowed.',
                        'When available, provider suggestions from the property address help sellers pick the right companies.',
                        'The finished sheet arrives as a web view and PDF, ready to forward.',
                        'The free plan covers 3 submitted sheets per month, with no credit card required.',
                    ].map((item) => (
                        <li key={item}>
                            <span>
                                <Check size={13} aria-hidden="true" />
                            </span>
                            <p>{item}</p>
                        </li>
                    ))}
                </ul>
            </MarketingSection>

            <MarketingSection
                title="Use it on your next listing file"
                description="Create your reusable seller link in about a minute, or try the seller flow first with a sample property."
            >
                <div className="marketing-actions">
                    <Suspense fallback={<SignupCta />}>
                        <ReferralSignupCta />
                    </Suspense>
                    <Link href="/demo" className="marketing-button marketing-button-outline">
                        Try the seller flow
                    </Link>
                </div>
            </MarketingSection>
        </div>
    );
}

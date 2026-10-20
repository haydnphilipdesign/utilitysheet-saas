import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';

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
import {
    getAccountById,
    getDefaultBrandProfile,
    getIntakeLinkBySlug,
} from '@/lib/neon/queries';

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

const REFERRAL_CODE_PATTERN = /^[a-z0-9-]{1,60}$/;

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

async function getSenderBrandName(referralCode: string | null): Promise<string | null> {
    if (!referralCode || !REFERRAL_CODE_PATTERN.test(referralCode)) return null;

    try {
        const intakeLink = await getIntakeLinkBySlug(referralCode);
        if (!intakeLink || !intakeLink.is_active) return null;

        const account = await getAccountById(intakeLink.account_id);
        if (!account || account.role === 'banned') return null;

        const brandProfile = await getDefaultBrandProfile(
            account.id,
            intakeLink.organization_id ?? undefined
        );
        return brandProfile?.name || null;
    } catch (error) {
        console.error('Failed to resolve sender brand for /from-a-closing:', error);
        return null;
    }
}

function firstParam(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
}

export default async function FromAClosingPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = await searchParams;
    const referralCode = firstParam(params.ref);
    const senderBrandName = await getSenderBrandName(referralCode);

    const signupParams = new URLSearchParams({
        utm_source: firstParam(params.utm_source) || 'utilitysheet_packet',
        utm_medium: firstParam(params.utm_medium) || 'product_referral',
        utm_campaign: firstParam(params.utm_campaign) || 'transaction_exposure',
        utm_content: 'from-a-closing',
    });
    if (referralCode && REFERRAL_CODE_PATTERN.test(referralCode)) {
        signupParams.set('ref', referralCode);
    }
    const signupHref = `/auth/signup?${signupParams.toString()}`;

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
                    senderBrandName
                        ? `${senderBrandName} collected this utility sheet automatically with UtilitySheet instead of chasing the seller through texts, emails, and blank forms. If you coordinate closings too, you can use the same workflow on your next file.`
                        : 'The utility sheet you were sent was collected automatically with UtilitySheet instead of texts, emails, and blank forms. If you coordinate closings too, you can use the same workflow on your next file.'
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
            </MarketingSection>

            <MarketingSection
                title="Why coordinators switch"
                description="UtilitySheet was built from a working transaction coordinator's own listing-side workflow."
            >
                <ul className="marketing-note-grid">
                    {[
                        'Sellers need no account, no app, and no research. "Not sure" is always allowed.',
                        'Sellers can complete the guided form on their phone without an account.',
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
                    <Link href={signupHref} className="marketing-button">
                        Create your free seller link
                        <ArrowRight size={17} aria-hidden="true" />
                    </Link>
                    <Link href="/demo" className="marketing-button marketing-button-outline">
                        Try the seller flow
                    </Link>
                </div>
            </MarketingSection>
        </div>
    );
}

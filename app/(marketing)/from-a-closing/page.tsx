import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, FileText, Link2, Smartphone } from 'lucide-react';

import {
    MarketingBreadcrumbs,
    MarketingPageHero,
    MarketingSection,
} from '@/components/marketing/page-shell';
import { JsonLd } from '@/components/seo/JsonLd';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
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
        icon: Link2,
        title: 'One reusable link',
        description:
            'The coordinator keeps a single seller link in their email templates and closing checklists. No new form is built for each property.',
    },
    {
        icon: Smartphone,
        title: 'The seller confirms providers',
        description:
            'The seller opens the link on their phone, enters the property address, and confirms or types each utility provider in about two minutes.',
    },
    {
        icon: FileText,
        title: 'A clean sheet comes back',
        description:
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
            account.active_organization_id ?? undefined
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
                <div className="grid gap-4 md:grid-cols-3">
                    {workflowSteps.map((step) => (
                        <Card key={step.title} className="border-border bg-card/30">
                            <CardContent className="space-y-3 p-6">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                                    <step.icon className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
                                </div>
                                <h3 className="font-semibold text-foreground">{step.title}</h3>
                                <p className="text-sm leading-6 text-muted-foreground">{step.description}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </MarketingSection>

            <MarketingSection
                title="Why coordinators switch"
                description="UtilitySheet was built from a working transaction coordinator's own listing-side workflow."
            >
                <ul className="grid gap-3 md:grid-cols-2">
                    {[
                        'Sellers need no account, no app, and no research. "Not sure" is always allowed.',
                        'Nearly 86% of started UtilitySheets are completed.',
                        'The finished sheet arrives as a web view and PDF, ready to forward.',
                        'The free plan covers 3 live files per month, with no credit card required.',
                    ].map((item) => (
                        <li
                            key={item}
                            className="flex gap-3 rounded-2xl border border-border bg-card/20 p-5"
                        >
                            <CheckCircle2
                                className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                                aria-hidden="true"
                            />
                            <span className="leading-7 text-muted-foreground">{item}</span>
                        </li>
                    ))}
                </ul>
            </MarketingSection>

            <MarketingSection
                title="Use it on your next listing file"
                description="Create your reusable seller link in about a minute, or try the seller flow first with a sample property."
            >
                <div className="flex flex-wrap items-center gap-4">
                    <Link href={signupHref} className={cn(buttonVariants({ size: 'lg' }))}>
                        Create your free seller link
                        <ArrowRight aria-hidden="true" />
                    </Link>
                    <Link
                        href="/demo"
                        className={cn(buttonVariants({ size: 'lg', variant: 'outline' }))}
                    >
                        Try the seller flow
                    </Link>
                </div>
            </MarketingSection>
        </div>
    );
}

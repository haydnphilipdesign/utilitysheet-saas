import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { CheckCircle2, FileText, Link2, Smartphone } from 'lucide-react';

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
        icon: Link2,
        title: 'One reusable link',
        description:
            'The coordinator keeps a single seller link in their email templates and closing checklists. No new form is built for each property.',
    },
    {
        icon: Smartphone,
        title: 'The seller confirms providers',
        description:
            'The seller opens the link on their phone, enters the property address, and confirms or types each utility provider.',
    },
    {
        icon: FileText,
        title: 'A clean sheet comes back',
        description:
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
                        'Sellers can complete the guided form on their phone without an account.',
                        'The finished sheet arrives as a web view and PDF, ready to forward.',
                        'The free plan covers 3 submitted sheets per month, with no credit card required.',
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
                    <Suspense fallback={<SignupCta />}>
                        <ReferralSignupCta />
                    </Suspense>
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

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Mail, MessageSquareText } from 'lucide-react';

import {
    MarketingBreadcrumbs,
    MarketingPageHero,
    MarketingSection,
} from '@/components/marketing/page-shell';
import { JsonLd } from '@/components/seo/JsonLd';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { createPageMetadata } from '@/lib/seo/site';
import { breadcrumbSchema } from '@/lib/seo/schema';

export const metadata: Metadata = createPageMetadata({
    title: 'Free TC Utility Handoff Kit',
    description:
        'Copy a seller utility email, text message, and closing utility checklist built for transaction coordinators.',
    path: '/tc-utility-handoff-kit',
    keywords: [
        'transaction coordinator templates',
        'seller utility email template',
        'utility handoff checklist',
    ],
});

const checklist = [
    'Add the utility-form link to the listing-side seller email template.',
    'Send the link when your process normally requests utility information.',
    'Confirm that the seller opened or submitted the form.',
    'Send one reminder if the form remains incomplete.',
    'Review provider names and public contact details for obvious errors.',
    'Save the finished sheet or PDF in the transaction file.',
    'Share the approved utility sheet with the intended closing participants.',
    'Never request account numbers, passwords, or copies of utility bills.',
] as const;

const signupHref =
    '/auth/signup?utm_source=handoff-kit&utm_medium=resource&utm_campaign=90-day-tc-growth&utm_content=kit-cta';

export default function TcUtilityHandoffKitPage() {
    return (
        <div className="bg-background">
            <JsonLd
                data={breadcrumbSchema([
                    { name: 'Home', path: '/' },
                    { name: 'TC Utility Handoff Kit', path: '/tc-utility-handoff-kit' },
                ])}
            />

            <MarketingPageHero
                eyebrow="Free TC resource"
                title="The TC Utility Handoff Kit"
                description="Copy the email, text message, and checklist for a cleaner seller utility handoff. Use the templates with any workflow or replace the form step with one reusable UtilitySheet link."
            >
                <MarketingBreadcrumbs
                    items={[
                        { label: 'Home', href: '/' },
                        { label: 'TC Utility Handoff Kit', href: '/tc-utility-handoff-kit' },
                    ]}
                />
            </MarketingPageHero>

            <MarketingSection
                title="Seller email template"
                description="Save this message in the email workflow you already use. Replace the bracketed fields before sending."
            >
                <Card className="max-w-3xl border-border bg-card/40">
                    <CardHeader className="flex-row items-center gap-3">
                        <Mail className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                        <p className="font-semibold text-foreground">Quick utility information for your closing</p>
                    </CardHeader>
                    <CardContent className="space-y-4 leading-7 text-muted-foreground">
                        <p>Hi [Seller First Name],</p>
                        <p>
                            Please complete our short utility information form for [Property Address]:
                        </p>
                        <p className="font-medium text-foreground">[UTILITY FORM LINK]</p>
                        <p>
                            It works from your phone and should only take a few minutes. If you are unsure
                            about a provider, choose “Not sure” and continue—you do not need to research
                            anything before submitting.
                        </p>
                        <p>
                            Thank you!
                            <br />
                            [TC Name]
                            <br />
                            [TC Company]
                        </p>
                    </CardContent>
                </Card>
            </MarketingSection>

            <MarketingSection
                title="Seller text template"
                description="Use this shorter version when text is the normal communication channel."
            >
                <Card className="max-w-3xl border-border bg-card/40">
                    <CardHeader className="flex-row items-center gap-3">
                        <MessageSquareText className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                        <p className="font-semibold text-foreground">Copy-and-paste text</p>
                    </CardHeader>
                    <CardContent className="leading-7 text-muted-foreground">
                        Hi [Seller First Name]—when you have a moment, please complete this short utility
                        form for [Property Address]: [UTILITY FORM LINK]. It works from your phone, and “Not
                        sure” is completely fine if you do not know an answer. Thank you! —[TC Name]
                    </CardContent>
                </Card>
            </MarketingSection>

            <MarketingSection
                title="TC utility handoff checklist"
                description="Drop these steps into the listing-side workflow your team already follows."
            >
                <ol className="grid gap-3 md:grid-cols-2">
                    {checklist.map((item) => (
                        <li
                            key={item}
                            className="flex gap-3 rounded-2xl border border-border bg-card/20 p-5"
                        >
                            <CheckCircle2
                                className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
                                aria-hidden="true"
                            />
                            <span className="leading-7 text-muted-foreground">{item}</span>
                        </li>
                    ))}
                </ol>
            </MarketingSection>

            <MarketingSection
                title="Want the automated version?"
                description="UtilitySheet replaces the blank form and cleanup with a reusable seller link, guided questions, tracking, and a clean web sheet plus PDF."
            >
                <Link
                    href={signupHref}
                    className={cn(buttonVariants({ size: 'lg' }), 'bg-emerald-600 text-white hover:bg-emerald-500')}
                >
                    Create your seller link
                    <ArrowRight aria-hidden="true" />
                </Link>
            </MarketingSection>
        </div>
    );
}

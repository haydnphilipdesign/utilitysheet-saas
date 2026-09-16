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
import { CopyTemplateButton } from '@/components/marketing/copy-template-button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { createPageMetadata } from '@/lib/seo/site';
import { breadcrumbSchema } from '@/lib/seo/schema';

export const metadata: Metadata = createPageMetadata({
    title: 'Free TC Utility Handoff Kit',
    description:
        'Copy seller utility email templates for listing intake, closing prep, and buyer-side requests through the listing agent, plus a text message and closing utility checklist for transaction coordinators.',
    path: '/tc-utility-handoff-kit',
    keywords: [
        'transaction coordinator templates',
        'seller utility email template',
        'utility handoff checklist',
        'listing welcome email template',
        'closing utility email template',
    ],
});

const emailTemplates = [
    {
        id: 'listing-welcome',
        title: 'Listing welcome',
        when: 'Listing side, at intake. Add it to your seller welcome email or listing checklist.',
        subject: 'Welcome, plus one quick form for [Property Address]',
        body: `Hi [Seller First Name],

Welcome! While we get your listing started, please take a few minutes to share your utility providers for [Property Address]:

[UTILITY FORM LINK]

It works from your phone. If you are unsure about a provider, choose "Not sure" and continue. We will use this to prepare a utility sheet for the buyer and will check in if anything needs an update before closing.

Thank you!
[Your Name]
[Company]`,
    },
    {
        id: 'listing-closing-prep',
        title: 'Listing side, closing prep',
        when: 'Listing side, under contract or as closing approaches. Send it directly to the seller.',
        subject: 'Utility information for [Property Address]',
        body: `Hi [Seller First Name],

As we prepare for closing, please complete our short utility information form for [Property Address]:

[UTILITY FORM LINK]

It works from your phone and should only take a few minutes. If you are unsure about a provider, choose "Not sure" and continue. You do not need to research anything before submitting.

Thank you!
[Your Name]
[Company]`,
    },
    {
        id: 'buyer-side-forward',
        title: 'Buyer side, via listing agent',
        when: 'Buyer side, under contract. Ask the listing agent to forward the link to the seller.',
        subject: 'Seller utility form for [Property Address]',
        body: `Hi [Listing Agent First Name],

To help our buyer set up utilities, could you please forward this short form to your seller for [Property Address]?

[UTILITY FORM LINK]

The seller can fill it out on their phone in a few minutes, and "Not sure" is fine for any provider they do not know. The form is meant for the seller to complete, so please pass it along rather than filling it in.

Thank you!
[Your Name]
[Company]`,
    },
] as const;

const checklist = [
    'Decide where the link belongs: the seller welcome email, the listing checklist, or your closing-prep email.',
    'On the buyer side, ask the listing agent to forward the link to the seller.',
    'Confirm that the seller opened or submitted the form.',
    'Send one reminder if the form remains incomplete.',
    'Review provider names and public contact details for obvious errors, especially if the details were collected early.',
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
                description="Copy emails for listing intake, closing prep, and buyer-side requests, plus a text message and checklist for a cleaner seller utility handoff. Use the templates with any workflow or replace the form step with one reusable UtilitySheet link."
            >
                <MarketingBreadcrumbs
                    items={[
                        { label: 'Home', href: '/' },
                        { label: 'TC Utility Handoff Kit', href: '/tc-utility-handoff-kit' },
                    ]}
                />
            </MarketingPageHero>

            <MarketingSection
                title="Email templates for each stage"
                description="Save the one that matches your side and timing in the email workflow you already use. Replace the bracketed fields before sending."
            >
                <div className="grid gap-6 lg:grid-cols-3">
                    {emailTemplates.map((template) => (
                        <Card key={template.id} className="border-border bg-card/40">
                            <CardHeader className="space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <Mail className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                                        <h3 className="font-semibold text-foreground">{template.title}</h3>
                                    </div>
                                    <CopyTemplateButton
                                        label={`${template.title} email`}
                                        text={`Subject: ${template.subject}\n\n${template.body}`}
                                    />
                                </div>
                                <p className="text-sm leading-6 text-muted-foreground">{template.when}</p>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
                                <p>
                                    <span className="font-medium text-foreground">Subject:</span> {template.subject}
                                </p>
                                <p className="whitespace-pre-line border-t border-border pt-3">{template.body}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
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
                description="Drop these steps into the workflow your team already follows, on either side of the transaction."
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

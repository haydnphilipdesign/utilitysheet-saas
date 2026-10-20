import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check, Mail, MessageSquareText } from 'lucide-react';

import { MarketingHeroArt } from '@/components/marketing/hero-art';
import {
    MarketingBreadcrumbs,
    MarketingPageHero,
    MarketingSection,
} from '@/components/marketing/page-shell';
import { MockGuidedForm, MockSellerLink } from '@/components/marketing/product-mockups';
import { JsonLd } from '@/components/seo/JsonLd';
import { CopyTemplateButton } from '@/components/marketing/copy-template-button';
import { createPageMetadata } from '@/lib/seo/site';
import { breadcrumbSchema } from '@/lib/seo/schema';

export const metadata: Metadata = createPageMetadata({
    title: 'Free TC Utility Handoff Kit',
    description:
        'Free copy-and-paste emails, a seller text, and a checklist for collecting seller utility details at listing intake, closing prep, or from the buyer side.',
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

Welcome! While we get your listing started, please share your utility providers for [Property Address]:

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

It works from your phone. If you are unsure about a provider, choose "Not sure" and continue. You do not need to research anything before submitting.

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

The seller can fill it out on their phone, and "Not sure" is fine for any provider they do not know. The form is meant for the seller to complete, so please pass it along rather than filling it in.

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
                art={<MarketingHeroArt primary={<MockSellerLink />} secondary={<MockGuidedForm />} />}
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
                <div className="kit-templates">
                    {emailTemplates.map((template) => (
                        <article key={template.id} className="kit-card">
                            <div className="kit-card-head">
                                <h3>
                                    <Mail size={18} aria-hidden="true" />
                                    {template.title}
                                </h3>
                                <CopyTemplateButton
                                    label={`${template.title} email`}
                                    text={`Subject: ${template.subject}\n\n${template.body}`}
                                />
                            </div>
                            <p className="kit-card-when">{template.when}</p>
                            <p className="kit-card-subject">
                                <span>Subject:</span> {template.subject}
                            </p>
                            <p className="kit-card-body">{template.body}</p>
                        </article>
                    ))}
                </div>
            </MarketingSection>

            <MarketingSection
                title="Seller text template"
                description="Use this shorter version when text is the normal communication channel."
            >
                <div className="kit-card kit-card-text">
                    <p className="kit-card-title">
                        <MessageSquareText size={18} aria-hidden="true" />
                        Copy-and-paste text
                    </p>
                    <p className="kit-card-body">
                        Hi [Seller First Name], when you have a moment, please complete this short utility
                        form for [Property Address]: [UTILITY FORM LINK]. It works from your phone, and “Not
                        sure” is completely fine if you do not know an answer. Thank you! [TC Name]
                    </p>
                </div>
            </MarketingSection>

            <MarketingSection
                title="TC utility handoff checklist"
                description="Drop these steps into the workflow your team already follows, on either side of the transaction."
            >
                <ol className="marketing-note-grid">
                    {checklist.map((item) => (
                        <li key={item}>
                            <span>
                                <Check size={13} aria-hidden="true" />
                            </span>
                            <p>{item}</p>
                        </li>
                    ))}
                </ol>
            </MarketingSection>

            <MarketingSection
                title="Want the automated version?"
                description="UtilitySheet replaces the blank form and cleanup with a reusable seller link, guided questions, tracking, and a clean web sheet plus PDF."
            >
                <Link href={signupHref} className="marketing-button">
                    Create your free seller link
                    <ArrowRight size={17} aria-hidden="true" />
                </Link>
            </MarketingSection>
        </div>
    );
}

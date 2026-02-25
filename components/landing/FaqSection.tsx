'use client';

import { useEffect, useRef } from 'react';
import { useInView } from 'framer-motion';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { trackEvent } from '@/lib/analytics/events';

const faqs = [
    {
        question: 'Who is UtilitySheet for?',
        answer: 'UtilitySheet is built for transaction coordinators and real estate agents who want a standardized, buyer-ready utility handoff\u2014without chasing sellers.',
    },
    {
        question: 'Can I use one link for every property?',
        answer: 'Yes \u2014 and this is one of the most powerful things about UtilitySheet. Your seller link works for any property. Add it to your email signature, include it in your standard seller texts, or paste it into your TC checklist. Sellers tap the link, enter the property address themselves, and complete the guided utility form. You never have to create a new request or log in to send a new link. If you do want to choose specific utility categories for a particular file, you can still create a one-off request \u2014 but the reusable link is the fastest way to work.',
    },
    {
        question: 'Do I need to log in every time to get the utility sheet?',
        answer: 'No. When a seller submits, the completed utility sheet PDF automatically attaches to your notification email. It shows up in your inbox without you doing anything \u2014 no logging in, no downloading, no follow-up. You can log in anytime to view submissions, track status, share the web link with buyers, or download the PDF again, but the email delivery means you always have the result the moment it\'s ready.',
    },
    {
        question: 'Does the seller need an account?',
        answer: 'No. Sellers open a secure link and complete the guided form on their phone\u2014no login and no app install.',
    },
    {
        question: 'Do sellers need to upload bills or share account numbers?',
        answer: 'No. UtilitySheet is designed to be quick and low-friction\u2014no bill uploads and no account numbers.',
    },
    {
        question: 'What if the seller doesn\'t know a provider?',
        answer: 'They can tap "Not sure" and keep moving, or search/type the provider name if they do know it. You\'ll still get a clean sheet with whatever they provided.',
    },
    {
        question: 'Can UtilitySheet auto-attach the PDF to completion emails?',
        answer: 'Yes, and it\'s on by default. When a seller submits, your completion notification email automatically includes the utility sheet PDF as an attachment. You don\'t have to configure anything \u2014 it works out of the box. You can turn it off or change the behavior in Settings > Notifications.',
    },
    {
        question: 'Will every completion email always include a PDF attachment?',
        answer: 'Usually yes when the attachment setting is enabled. If a submission is locked due to free-plan overage, or if PDF generation fails, the email still sends without the attachment.',
    },
    {
        question: 'How do provider suggestions work?',
        answer: 'We suggest likely providers based on the address and utility type. Sellers can confirm with a tap or enter a provider manually if the suggestion isn\'t correct.',
    },
    {
        question: 'What utilities can I collect?',
        answer: 'Common categories like electric, gas, water, sewer, trash, internet, cable, and propane. One-off requests let you choose categories per file; the reusable link uses a standard set that covers the most common utilities.',
    },
    {
        question: 'What happens if I hit the free plan limit?',
        answer: 'Sellers can still submit. New submissions beyond your free limit are saved as "Locked" in your dashboard until you upgrade (then they unlock automatically).',
    },
    {
        question: 'Can I remove UtilitySheet branding?',
        answer: 'Yes. Pro and Teams accounts can remove the "Powered by UtilitySheet" footer from share links and PDFs (white-label).',
    },
    {
        question: 'Do you offer Teams (multi-seat)?',
        answer: 'Yes. Teams lets you invite multiple users under one organization. It\'s $7 per seat per month with a 3 seat minimum.',
    }
];

export function FaqSection() {
    const sectionRef = useRef<HTMLElement | null>(null);
    const isInView = useInView(sectionRef, { once: true, margin: '-20% 0px -20% 0px' });

    useEffect(() => {
        if (!isInView) return;
        trackEvent('landing_section_viewed', {
            section_id: 'faq',
            page: 'landing',
            location: 'faq',
        });
    }, [isInView]);

    return (
        <section ref={sectionRef} id="faq" className="scroll-mt-24 py-16 sm:py-24 bg-background px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8 sm:mb-12">Frequently Asked Questions</h2>

                <Accordion className="w-full">
                    {faqs.map((faq, i) => (
                        <AccordionItem key={i} value={`item-${i}`} className="border-border">
                            <AccordionTrigger className="text-base sm:text-lg text-foreground hover:text-slate-600 transition-colors text-left py-3 sm:py-4">
                                {faq.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                                {faq.answer}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </section>
    );
}

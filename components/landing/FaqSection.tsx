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
        answer: 'Transaction coordinators and real estate agents who want a standardized, buyer-ready utility handoff\u2014without chasing sellers.',
    },
    {
        question: 'Can I use one link for every property?',
        answer: 'Yes. Your seller link works for any property. Add it to your email signature, texts, or TC checklist. Sellers tap the link, enter the address, and complete the guided flow. On Pro/Teams, you can set it to start in Advanced Utility Packet mode by default.',
    },
    {
        question: 'What is the Advanced Utility Packet?',
        answer: 'A modular version of the workflow for deeper handoff details. Along with utility providers, you can collect Lawn + Irrigation, Home Security, Service Providers, and Mailbox + Access modules. Available on Pro and Teams.',
    },
    {
        question: 'Does the seller need an account or app?',
        answer: 'No. Sellers open a secure link and complete the guided form on their phone\u2014no login, no app install, no bill uploads.',
    },
    {
        question: 'How does the PDF delivery work?',
        answer: 'When a seller submits, the completed PDF automatically attaches to your notification email. You don\'t have to log in or download anything\u2014it just shows up in your inbox. This is on by default and can be managed in Settings.',
    },
    {
        question: 'How do provider suggestions work?',
        answer: 'We suggest likely providers based on the address and utility type. Sellers can confirm with a tap, search, or type a provider manually if the suggestion isn\'t right.',
    },
    {
        question: 'What happens if I hit the free plan limit?',
        answer: 'Sellers can still submit. New submissions beyond your limit are saved as "Locked" until you upgrade, then they unlock automatically.',
    },
    {
        question: 'How long does it take to get started?',
        answer: 'About 30 seconds. Sign up, grab your seller link, and send it. There\'s nothing to configure\u2014your link works immediately.',
    },
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

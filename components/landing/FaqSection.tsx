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
import { faqItems } from '@/lib/marketing-content';

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
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-4">Frequently Asked Questions</h2>
                <p className="text-center text-muted-foreground mb-8 sm:mb-12">
                    Answers about seller utility forms, utility sheet PDFs, pricing, and how UtilitySheet fits a real estate closing workflow.
                </p>

                <Accordion className="w-full">
                    {faqItems.map((faq, i) => (
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

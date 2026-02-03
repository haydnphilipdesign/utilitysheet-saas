'use client';

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
    {
        question: 'Who is UtilitySheet for?',
        answer: 'UtilitySheet is built for transaction coordinators and real estate agents who want a standardized, buyer-ready utility handoff—without chasing sellers.',
    },
    {
        question: 'Does the seller need an account?',
        answer: 'No. Sellers open a secure link and complete the guided form on their phone—no login and no app install.',
    },
    {
        question: 'Can I use one link for every property?',
        answer: 'Yes. You can share your reusable seller link over and over—sellers enter the property address at the start, then complete the same guided utility form.',
    },
    {
        question: 'Do sellers need to upload bills or share account numbers?',
        answer: 'No. UtilitySheet is designed to be quick and low-friction—no bill uploads and no account numbers.',
    },
    {
        question: 'What if the seller doesn’t know a provider?',
        answer: 'They can tap “Not sure” and keep moving, or search/type the provider name if they do know it. You’ll still get a clean sheet with whatever they provided.',
    },
    {
        question: 'How do provider suggestions work?',
        answer: 'We suggest likely providers based on the address and utility type. Sellers can confirm with a tap or enter a provider manually if the suggestion isn’t correct.',
    },
    {
        question: 'What utilities can I collect?',
        answer: 'Common categories like electric, gas, water, sewer, trash, internet, cable, and propane. One-off requests let you choose categories; the reusable link uses a standard set.',
    },
    {
        question: 'What happens if I hit the free plan limit?',
        answer: 'Sellers can still submit. New submissions beyond your free limit are saved as “Locked” in your dashboard until you upgrade (then they unlock automatically).',
    },
    {
        question: 'Can I remove UtilitySheet branding?',
        answer: 'Yes. Pro and Teams accounts can remove the “Powered by UtilitySheet” footer from share links and PDFs (white-label).',
    },
    {
        question: 'Do you offer Teams (multi-seat)?',
        answer: 'Yes. Teams lets you invite multiple users under one organization. It’s $7 per seat per month with a 3 seat minimum.',
    }
];

export function FaqSection() {
    return (
        <section id="faq" className="scroll-mt-24 py-16 sm:py-24 bg-background px-4 sm:px-6 lg:px-8">
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

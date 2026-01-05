'use client';

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
    {
        question: "Who is UtilitySheet for?",
        answer: "UtilitySheet is built for transaction coordinators and real estate agents who want a standardized, buyer-ready utility handoff without chasing sellers."
    },
    {
        question: "Does the seller need an account?",
        answer: "No. Sellers open a secure link and complete the guided form on their phone—no login and no app install."
    },
    {
        question: "What if the seller doesn’t know a provider?",
        answer: "They can tap “Not sure” and move on, or search/type the provider name if they do know it. You’ll still get a clean sheet with what they provided."
    },
    {
        question: "How do provider suggestions work?",
        answer: "We use AI to suggest likely providers based on the address and utility type. Sellers can confirm with a tap or enter a provider manually if the suggestion isn’t correct."
    },
    {
        question: "Can I remove UtilitySheet branding?",
        answer: "Yes. Pro accounts can remove the “Powered by UtilitySheet” footer from share links and PDFs (white-label)."
    }
];

export function FaqSection() {
    return (
        <section id="faq" className="py-24 bg-background px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
                <h2 className="text-3xl font-bold text-foreground text-center mb-12">Frequently Asked Questions</h2>

                <Accordion className="w-full">
                    {faqs.map((faq, i) => (
                        <AccordionItem key={i} value={`item-${i}`} className="border-border">
                            <AccordionTrigger className="text-lg text-foreground hover:text-slate-600 transition-colors text-left">
                                {faq.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                                {faq.answer}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </section>
    );
}

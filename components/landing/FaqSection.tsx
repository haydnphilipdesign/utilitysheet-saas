'use client';

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
    {
        question: "How does UtilitySheet check for providers?",
        answer: "We use a proprietary database combined with real-time address verification logic to identify utility providers that serve the specific address. Our AI then double-checks contact information."
    },
    {
        question: "Is it really free to start?",
        answer: "Yes! Our Starter plan is completely free. You can use it for up to 3 properties per month. No credit card required."
    },
    {
        question: "Can I customize the branding?",
        answer: "Absolutely. On the Pro plan, you can upload your brokerage logo, setting custom colors, and even adding your headshot to the final PDF packet."
    },
    {
        question: "What happens if a provider is missing?",
        answer: "While rare, if a provider isn't automatically found, the seller can manually add it during their confirmation step, or you can add it from your dashboard."
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
                            <AccordionTrigger className="text-lg text-foreground hover:text-emerald-500 transition-colors text-left">
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

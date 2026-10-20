'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useInView } from 'framer-motion';
import { ArrowRight, ChevronDown } from 'lucide-react';
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

    // Every answer stays rendered: the homepage FAQPage schema lists all of them.
    return (
        <section ref={sectionRef} id="faq" className="home-faq marketing-section scroll-mt-24">
            <div className="marketing-container">
                <div className="home-section-heading">
                    <p className="marketing-eyebrow">FAQ</p>
                    <h2 className="text-balance">Questions, answered.</h2>
                    <p>
                        Seller forms, utility sheet PDFs, pricing, and how UtilitySheet fits a real estate closing workflow.
                    </p>
                </div>

                <div className="faq-accordions home-faq-list">
                    {faqItems.map((faq) => (
                        <details key={faq.question} className="faq-item">
                            <summary>
                                {faq.question}
                                <ChevronDown size={18} aria-hidden="true" />
                            </summary>
                            <p>{faq.answer}</p>
                        </details>
                    ))}
                </div>

                <p className="home-section-link">
                    <Link href="/faq" className="marketing-text-link">
                        Search every answer <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                </p>
            </div>
        </section>
    );
}

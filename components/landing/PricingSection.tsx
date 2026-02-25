'use client';

import { useEffect, useRef } from 'react';
import { useInView } from 'framer-motion';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { trackEvent } from '@/lib/analytics/events';

const tiers = [
    {
        name: 'Starter',
        price: 'Free',
        description: 'Try it on real transactions — no credit card, no time limit.',
        features: [
            '3 unlocked requests per month',
            'Reusable seller link (seller enters address)',
            'Simple Utility Sheet mode',
            'Buyer-ready PDF + share link',
            'Seller submission completion email notifications',
            'Optional completion-email PDF attachment (on by default)',
            'Over-limit submissions saved as locked (attachment resumes when unlocked)',
            'UtilitySheet footer on share links',
        ],
        cta: 'Start for Free',
        href: '/auth/signup',
        popular: false
    },
    {
        name: 'Pro',
        price: '$9',
        period: '/month',
        description: 'Unlimited requests, your branding. The full experience for solo TCs and agents.',
        features: [
            'Unlimited requests',
            'Custom branded link',
            'Advanced Utility Packet mode',
            'Choose advanced module defaults on your reusable link',
            'Custom branding (logo + colors)',
            'Branded completion-email PDF attachments',
            'Unlock locked submissions',
            'Remove "Powered by UtilitySheet"',
            'Priority support',
            'Single-seat (1 user)'
        ],
        cta: 'Get Started',
        href: '/auth/signup?plan=pro',
        popular: true
    },
    {
        name: 'Teams',
        price: '$7',
        period: '/seat/mo',
        description: 'For brokerages and teams. 3-seat minimum — starts at $21/month.',
        features: [
            'Everything in Pro',
            'Shared organization workspace',
            'Invite members (admin + member roles)',
            'Seat-based billing (3 seat minimum)',
            'Org-wide Advanced Utility Packet defaults',
            'Branded completion-email PDF attachments across the org',
            'Priority support'
        ],
        cta: 'Start Teams',
        href: '/auth/signup?plan=teams',
        popular: false
    }
];

export function PricingSection() {
    const sectionRef = useRef<HTMLElement | null>(null);
    const isInView = useInView(sectionRef, { once: true, margin: '-20% 0px -20% 0px' });

    useEffect(() => {
        if (!isInView) return;
        trackEvent('landing_section_viewed', {
            section_id: 'pricing',
            page: 'landing',
            location: 'pricing',
        });
        trackEvent('pdf_attachment_value_prop_viewed', {
            section_id: 'pricing',
            page: 'landing',
            location: 'pricing',
        });
    }, [isInView]);

    return (
        <section ref={sectionRef} id="pricing" className="scroll-mt-24 py-16 sm:py-24 lg:py-32 bg-background border-t border-border/50">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-10 sm:mb-16 lg:mb-20">
                    <h2 className="text-slate-600 font-bold text-xs sm:text-sm tracking-wider uppercase mb-2 sm:mb-3">Pricing</h2>
                    <h3 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground tracking-tight mb-3 sm:mb-4">Simple, transparent pricing</h3>
                    <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto">
                        Choose the plan that best fits your business needs. No hidden fees.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
                    {tiers.map((tier) => (
                        <div
                            key={tier.name}
                            className={`relative rounded-2xl sm:rounded-3xl p-5 sm:p-8 border ${tier.popular
                                ? 'bg-card/40 border-slate-500/50 shadow-2xl shadow-slate-500/10'
                                : 'bg-card/20 border-border'
                                } flex flex-col`}
                        >
                            {tier.popular && (
                                <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 px-3 sm:px-4 py-0.5 sm:py-1 bg-slate-600 text-white text-[10px] sm:text-xs font-bold rounded-full uppercase tracking-wide">
                                    Most Popular
                                </div>
                            )}

                            <div className="mb-6 sm:mb-8">
                                <h4 className="text-base sm:text-lg font-medium text-foreground">{tier.name}</h4>
                                <div className="mt-3 sm:mt-4 flex items-baseline text-foreground">
                                    <span className="text-4xl sm:text-5xl font-bold tracking-tight">{tier.price}</span>
                                    {tier.period && (
                                        <span className="ml-1 text-lg sm:text-xl font-medium text-muted-foreground">{tier.period}</span>
                                    )}
                                </div>
                                <p className="mt-3 sm:mt-4 text-muted-foreground text-xs sm:text-sm h-8 sm:h-10">{tier.description}</p>
                            </div>

                            <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8 flex-1">
                                {tier.features.map((feature) => (
                                    <li key={feature} className="flex items-start">
                                        <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-600/10 flex items-center justify-center mt-0.5">
                                            <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-600" />
                                        </div>
                                        <span className="ml-2.5 sm:ml-3 text-secondary-foreground text-xs sm:text-sm">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <Link href={tier.href} className="block mt-auto">
                                <Button
                                    data-testid={`pricing-${tier.name.toLowerCase()}-cta`}
                                    className={`w-full h-11 sm:h-12 text-sm sm:text-base font-semibold active:scale-[0.98] ${tier.popular
                                        ? 'bg-slate-600 text-white hover:bg-slate-700'
                                        : 'bg-foreground text-background hover:bg-foreground/90'
                                        }`}
                                    onClick={() => {
                                        trackEvent('landing_cta_clicked', {
                                            cta_id: `secondary_pricing_${tier.name.toLowerCase()}_cta`,
                                            destination: tier.href,
                                            location: 'pricing',
                                        });
                                    }}
                                >
                                    {tier.cta}
                                </Button>
                            </Link>
                        </div>
                    ))}
                </div>

                <p className="mt-10 text-center text-sm text-muted-foreground">
                    Start on Starter with no credit card. Upgrade or cancel anytime. Teams is billed per seat (3 seat minimum).
                </p>
            </div>
        </section>
    );
}

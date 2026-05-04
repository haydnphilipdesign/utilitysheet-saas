'use client';

import { useEffect, useRef } from 'react';
import { useInView } from 'framer-motion';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { trackEvent } from '@/lib/analytics/events';
import { pricingTiers } from '@/lib/marketing-content';

const tiers = [
    {
        ...pricingTiers[0],
        period: undefined,
        cta: 'Start Free',
        popular: false,
        features: [
            '3 unlocked requests per month',
            'Reusable seller link',
            'Simple Utility Sheet mode',
            'Dashboard view of submitted sheets',
            'Buyer-ready PDF and share link',
            'Completion email notifications',
            'Optional PDF attachment on completion emails',
            'Saved over-limit submissions',
            'UtilitySheet branding on shared links',
        ],
    },
    {
        ...pricingTiers[1],
        price: '$9',
        period: '/month',
        cta: 'Start Pro',
        popular: true,
        features: [
            'Unlimited requests',
            'Custom branded link',
            'Advanced Utility Packet mode',
            'Edit submitted sheets after seller submission',
            'Live updates to future PDF downloads',
            'Custom branding',
            'Branded PDF attachments',
            'Unlock locked submissions',
            'Remove UtilitySheet footer',
            'Priority support',
            'Single-seat account',
        ],
    },
    {
        ...pricingTiers[2],
        price: '$7',
        period: '/seat/mo',
        cta: 'Start Teams',
        popular: false,
        features: [
            'Everything in Pro',
            'Shared organization workspace',
            'Any teammate with request access can edit submitted sheets',
            'Invite members and assign roles',
            'Seat-based billing with 3-seat minimum',
            'Org-wide packet defaults',
            'Branded output across the team',
            'Priority support',
        ],
    },
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
                    <p className="text-slate-600 font-bold text-xs sm:text-sm tracking-wider uppercase mb-2 sm:mb-3">Pricing</p>
                    <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground tracking-tight mb-3 sm:mb-4 text-balance">
                        Pricing for reusable seller-link workflows
                    </h2>
                    <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto">
                        Start with your reusable seller link. Upgrade when you need unlimited submissions, post-submission edits, branded output, or a shared team workspace.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
                    {tiers.map((tier) => (
                        <div
                            key={tier.name}
                            className={`relative rounded-lg p-5 sm:p-8 border ${tier.popular
                                ? 'bg-card/40 border-emerald-500/30 shadow-2xl shadow-emerald-500/10'
                                : 'bg-card/20 border-border'
                                } flex flex-col`}
                        >
                            {tier.popular && (
                                <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 px-3 sm:px-4 py-0.5 sm:py-1 bg-emerald-600 text-white text-[10px] sm:text-xs font-bold rounded-full uppercase tracking-wide">
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
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-500'
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
                    Every plan starts with a reusable seller link. Starter keeps submitted sheets read-only after seller submission; Pro and Teams add dashboard editing while seller and public links stay write-protected.
                </p>
            </div>
        </section>
    );
}

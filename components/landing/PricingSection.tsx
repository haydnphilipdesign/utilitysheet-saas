'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const tiers = [
    {
        name: 'Starter',
        price: 'Free',
        description: 'Perfect for solo transaction coordinators and agents getting started.',
        features: [
            '3 requests per month',
            'Shareable seller intake link',
            'Buyer-ready PDF + share link',
            'Email reminders',
            'UtilitySheet footer on share links'
        ],
        cta: 'Start for Free',
        href: '/auth/signup',
        popular: false
    },
    {
        name: 'Pro',
        price: '$9',
        period: '/month',
        description: 'For high-volume TCs and teams who want white-label branding.',
        features: [
            'Unlimited requests',
            'Custom branding (logo + colors)',
            'Remove "Powered by UtilitySheet"',
            'Priority support',
            'Team management (coming soon)'
        ],
        cta: 'Get Started',
        href: '/auth/signup?plan=pro',
        popular: true
    }
];

export function PricingSection() {
    return (
        <section id="pricing" className="scroll-mt-24 py-16 sm:py-24 lg:py-32 bg-background border-t border-border/50">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-10 sm:mb-16 lg:mb-20">
                    <h2 className="text-slate-600 font-bold text-xs sm:text-sm tracking-wider uppercase mb-2 sm:mb-3">Pricing</h2>
                    <h3 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground tracking-tight mb-3 sm:mb-4">Simple, transparent pricing</h3>
                    <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto">
                        Choose the plan that best fits your business needs. No hidden fees.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
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
                                    className={`w-full h-11 sm:h-12 text-sm sm:text-base font-semibold active:scale-[0.98] ${tier.popular
                                        ? 'bg-slate-600 text-white hover:bg-slate-700'
                                        : 'bg-foreground text-background hover:bg-foreground/90'
                                        }`}
                                >
                                    {tier.cta}
                                </Button>
                            </Link>
                        </div>
                    ))}
                </div>

                <p className="mt-10 text-center text-sm text-muted-foreground">
                    Start on Starter with no credit card. Upgrade or cancel anytime.
                </p>
            </div>
        </section>
    );
}

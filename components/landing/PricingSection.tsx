'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const tiers = [
    {
        name: 'Starter',
        price: 'Free',
        description: 'Perfect for individual agents just getting started.',
        features: [
            '3 requests per month',
            'Standard PDF generation',
            'Basic email support',
            '7-day data retention'
        ],
        cta: 'Start for Free',
        href: '/auth/signup',
        popular: false
    },
    {
        name: 'Pro',
        price: '$9',
        period: '/month',
        description: 'For high-volume agents and teams needing more power.',
        features: [
            'Unlimited requests',
            'Custom branding & colors',
            'Priority support',
            'Indefinite data retention',
            'Team management (coming soon)'
        ],
        cta: 'Get Started',
        href: '/auth/signup?plan=pro',
        popular: true
    }
];

export function PricingSection() {
    return (
        <section id="pricing" className="py-32 bg-background border-t border-border/50">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-20">
                    <h2 className="text-slate-600 font-bold text-sm tracking-wider uppercase mb-3">Pricing</h2>
                    <h3 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight mb-4">Simple, transparent pricing</h3>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                        Choose the plan that best fits your business needs. No hidden fees.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {tiers.map((tier) => (
                        <div
                            key={tier.name}
                            className={`relative rounded-3xl p-8 border ${tier.popular
                                ? 'bg-card/40 border-slate-500/50 shadow-2xl shadow-slate-500/10'
                                : 'bg-card/20 border-border'
                                } flex flex-col`}
                        >
                            {tier.popular && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-slate-600 text-white text-xs font-bold rounded-full uppercase tracking-wide">
                                    Most Popular
                                </div>
                            )}

                            <div className="mb-8">
                                <h4 className="text-lg font-medium text-foreground">{tier.name}</h4>
                                <div className="mt-4 flex items-baseline text-foreground">
                                    <span className="text-5xl font-bold tracking-tight">{tier.price}</span>
                                    {tier.period && (
                                        <span className="ml-1 text-xl font-medium text-muted-foreground">{tier.period}</span>
                                    )}
                                </div>
                                <p className="mt-4 text-muted-foreground text-sm h-10">{tier.description}</p>
                            </div>

                            <ul className="space-y-4 mb-8 flex-1">
                                {tier.features.map((feature) => (
                                    <li key={feature} className="flex items-start">
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-600/10 flex items-center justify-center mt-0.5">
                                            <Check className="h-3.5 w-3.5 text-slate-600" />
                                        </div>
                                        <span className="ml-3 text-secondary-foreground text-sm">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <Link href={tier.href} className="block mt-auto">
                                <Button
                                    className={`w-full h-12 text-base font-semibold ${tier.popular
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
            </div>
        </section>
    );
}

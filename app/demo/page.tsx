'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, ArrowRight, Loader2, Sparkles, Search } from 'lucide-react';
import { SellerWizard } from '@/components/seller-form/SellerWizard';
import { WizardLoader } from '@/components/ui/wizard-loader';
import type { UtilityCategory, ProviderSuggestion } from '@/types';
import Link from 'next/link';
import { MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { trackEvent } from '@/lib/analytics/events';

// UtilitySheet branding for demo
const DEMO_BRAND = {
    name: "UtilitySheet",
    primary_color: "#475569",
};

const DEMO_STEPS = [
    {
        icon: <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />,
        text: "Verifying address...",
        duration: 800
    },
    {
        icon: <MapPin className="h-6 w-6 text-emerald-400" />,
        text: "Locating property...",
        duration: 1200
    },
    {
        icon: <Search className="h-6 w-6 text-emerald-400" />,
        text: "Analyzing local utility providers...",
        duration: 2500
    },
    {
        icon: <Sparkles className="h-6 w-6 text-emerald-400" />,
        text: "Preparing your experience...",
        duration: 1000
    }
];

export default function DemoPage() {
    const [address, setAddress] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [wizardReady, setWizardReady] = useState(false);
    const [suggestions, setSuggestions] = useState<Record<UtilityCategory, ProviderSuggestion[]>>({} as Record<UtilityCategory, ProviderSuggestion[]>);

    useEffect(() => {
        trackEvent('landing_section_viewed', {
            section_id: 'demo_entry',
            page: 'demo',
            location: 'demo',
        });
    }, []);

    const handleStartDemo = async () => {
        if (!address.trim() || address.length < 10) {
            setError('Please enter the full address: street, city and state.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const challengeResponse = await fetch('/api/demo/suggestions', { method: 'GET' });
            if (!challengeResponse.ok) {
                throw new Error('Failed to prepare demo challenge');
            }
            const challengeData = await challengeResponse.json();
            const challengeToken = typeof challengeData?.challengeToken === 'string' ? challengeData.challengeToken : '';
            if (!challengeToken) {
                throw new Error('Missing demo challenge token');
            }

            // Artificial delay to show the "Verify address" step at least briefly if specific conditions are met,
            // but usually the API takes a moment.
            // We'll let the API control the timing mostly.
            const response = await fetch('/api/demo/suggestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: address.trim(), challengeToken }),
            });

            if (!response.ok) {
                throw new Error('Failed to get suggestions');
            }

            const data = await response.json();
            setSuggestions(data.suggestions || {});

            // If the API was too fast, maybe wait a bit? 
            // Let's ensure at least 2 seconds of loading visualization for better UX
            // relying on the user's desire for the "beautiful visual animation"
            await new Promise(resolve => setTimeout(resolve, 2000));

            setWizardReady(true);
        } catch (err) {
            console.error('Demo error:', err);
            setError('Something went wrong on our side. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <WizardLoader steps={DEMO_STEPS} />;
    }

    // Once we have the address and suggestions, show the wizard
    if (wizardReady) {
        return (
            <SellerWizard
                initialRequestData={{
                    property_address: address,
                    utility_categories: ['electric', 'gas', 'water', 'sewer', 'trash', 'internet', 'cable', 'propane'],
                }}
                initialSuggestions={suggestions}
                token="demo"
                brandProfile={DEMO_BRAND}
                isDemo={true}
            />
        );
    }

    // Address input step. The marketing header and footer frame this step
    // only; the wizard above runs full screen like the real seller form.
    return (
        <div className="marketing-site flex min-h-screen flex-col bg-background text-foreground">
            <MarketingHeader />
            <main className="flex flex-1 flex-col">
                <div className="demo-entry">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="demo-entry-inner"
                    >
                        <div className="demo-entry-icon">
                            <MapPin className="h-7 w-7" aria-hidden="true" />
                        </div>
                        <h1>Try the Seller Experience</h1>
                        <p className="demo-entry-lead">
                            Enter an address to see suggested providers. Sellers can confirm, search, or type with no login required.
                        </p>

                        <div className="demo-entry-card">
                            <p className="demo-entry-note">
                                This demo shows the core guided flow. On Pro and Teams you can also collect a Property Handoff Packet and edit submitted sheets later from the dashboard.
                            </p>

                            <div>
                                <label htmlFor="address">Property Address</label>
                                <input
                                    id="address"
                                    type="text"
                                    value={address}
                                    onChange={(e) => {
                                        setAddress(e.target.value);
                                        setError(null);
                                    }}
                                    onKeyDown={(e) => e.key === 'Enter' && handleStartDemo()}
                                    placeholder="123 Sample Street, City, state, zip"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAddress('123 Sample Street, City, state, zip');
                                        setError(null);
                                    }}
                                    className="demo-entry-sample"
                                >
                                    Use a sample address
                                </button>
                                {error && (
                                    <motion.p
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="demo-entry-error"
                                        role="alert"
                                    >
                                        {error}
                                    </motion.p>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={handleStartDemo}
                                disabled={loading || !address.trim()}
                                className="marketing-button"
                            >
                                Start Demo
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </button>

                            <p className="demo-entry-privacy">
                                Your address is only used to generate suggestions.
                            </p>
                        </div>

                        <p className="demo-entry-alt">
                            <Link
                                href="/auth/signup"
                                onClick={() =>
                                    trackEvent('landing_primary_cta_clicked', {
                                        cta_id: 'primary_demo_start_free',
                                        destination: '/auth/signup',
                                        location: 'demo',
                                        page: 'demo',
                                    })
                                }
                            >
                                Start Free instead
                            </Link>
                        </p>
                    </motion.div>
                </div>
            </main>
            <MarketingFooter />
        </div>
    );
}

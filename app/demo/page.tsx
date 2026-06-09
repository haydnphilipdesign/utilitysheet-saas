'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, ArrowRight, Loader2, Sparkles, Search } from 'lucide-react';
import { SellerWizard } from '@/components/seller-form/SellerWizard';
import { WizardLoader } from '@/components/ui/wizard-loader';
import type { UtilityCategory, ProviderSuggestion } from '@/types';
import Link from 'next/link';
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
            setError('Please enter a complete address (street, city, state)');
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
            setError('Something went wrong. Please try again.');
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

    // Address input step
    return (
        <div className="min-h-[calc(100vh-4rem)] flex flex-col">

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-md w-full"
                >
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-xl">
                            <MapPin className="h-8 w-8 text-white" />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
                            Try the Seller Experience
                        </h1>
                        <p className="text-muted-foreground text-sm sm:text-base">
                            Enter an address to see suggested providers. Sellers can confirm, search, or type with no login required.
                        </p>
                    </div>

                    <div className="bg-card/50 border border-border rounded-2xl p-6 space-y-4">
                        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-900">
                            This demo shows the core guided flow. Pro and Teams can also run Advanced Utility Packet mode and edit submitted sheets later from the dashboard.
                        </div>

                        <div>
                            <label htmlFor="address" className="block text-sm font-medium text-muted-foreground mb-2">
                                Property Address
                            </label>
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
                                className="w-full px-4 py-3 bg-background/50 border border-input rounded-xl text-base sm:text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all"
                            />
                            <div className="mt-2 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAddress('123 Sample Street, City, state, zip');
                                        setError(null);
                                    }}
                                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                                >
                                    Use a sample address
                                </button>
                            </div>
                            {error && (
                                <motion.p
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-2 text-sm text-red-400"
                                >
                                    {error}
                                </motion.p>
                            )}
                        </div>

                        <button
                            onClick={handleStartDemo}
                            disabled={loading || !address.trim()}
                            className="w-full py-3.5 px-6 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 disabled:from-slate-700 disabled:to-slate-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-slate-500/20"
                        >
                            Start Demo
                            <ArrowRight className="h-5 w-5" />
                        </button>

                        <p className="text-xs text-muted-foreground text-center">
                            Your address is only used to generate suggestions.
                        </p>
                    </div>

                    <div className="mt-6 text-center">
                        <Link
                            href="/auth/signup"
                            className="inline-flex items-center text-sm font-semibold text-slate-700 hover:text-slate-900 underline underline-offset-2"
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
                    </div>
                </motion.div>
            </main>
        </div>
    );
}

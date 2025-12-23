'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { SellerWizard } from '@/components/seller-form/SellerWizard';
import type { UtilityCategory, ProviderSuggestion } from '@/types';
import Link from 'next/link';

// UtilitySheet branding for demo
const DEMO_BRAND = {
    name: "UtilitySheet",
    primary_color: "#475569",
};

export default function DemoPage() {
    const [address, setAddress] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [wizardReady, setWizardReady] = useState(false);
    const [suggestions, setSuggestions] = useState<Record<UtilityCategory, ProviderSuggestion[]>>({} as Record<UtilityCategory, ProviderSuggestion[]>);

    const handleStartDemo = async () => {
        if (!address.trim() || address.length < 10) {
            setError('Please enter a complete address (street, city, state)');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/demo/suggestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: address.trim() }),
            });

            if (!response.ok) {
                throw new Error('Failed to get suggestions');
            }

            const data = await response.json();
            setSuggestions(data.suggestions || {});
            setWizardReady(true);
        } catch (err) {
            console.error('Demo error:', err);
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Once we have the address and suggestions, show the wizard
    if (wizardReady) {
        return (
            <SellerWizard
                initialRequestData={{
                    property_address: address,
                    utility_categories: ['electric', 'gas', 'water', 'sewer', 'trash'],
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
                        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                            Try the Seller Experience
                        </h1>
                        <p className="text-slate-400 text-sm sm:text-base">
                            Enter any address you know the utility providers for. Our AI will suggest providers — see how accurate it is!
                        </p>
                    </div>

                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-4">
                        <div>
                            <label htmlFor="address" className="block text-sm font-medium text-slate-300 mb-2">
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
                                placeholder="123 Main St, Austin, TX 78701"
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all"
                            />
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
                            className="w-full py-3.5 px-6 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 disabled:from-slate-700 disabled:to-slate-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-slate-900/50"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Getting AI Suggestions...
                                </>
                            ) : (
                                <>
                                    Start Demo
                                    <ArrowRight className="h-5 w-5" />
                                </>
                            )}
                        </button>

                        <p className="text-xs text-slate-500 text-center">
                            Your address is only used to generate suggestions and won't be saved.
                        </p>
                    </div>

                    <div className="mt-6 text-center">
                        <Link
                            href="/auth/signup"
                            className="text-slate-400 hover:text-slate-300 text-sm underline underline-offset-2"
                        >
                            Ready to sign up instead?
                        </Link>
                    </div>
                </motion.div>
            </main>
        </div>
    );
}

'use client';

import { useEffect, useState, use } from 'react';
import { AlertTriangle } from 'lucide-react';
import { WizardLoader } from '@/components/ui/wizard-loader';
import type { UtilityCategory, ProviderSuggestion } from '@/types';
import { SellerWizard } from '@/components/seller-form/SellerWizard';

interface RequestData {
    property_address: string;
    utility_categories: UtilityCategory[];
}

interface BrandProfile {
    name?: string;
    logo_url?: string;
    primary_color?: string;
    contact_email?: string;
    contact_phone?: string;
    contact_website?: string;
}

export default function SellerFormPage({ params }: { params: Promise<{ token: string }> }) {
    const resolvedParams = use(params);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [requestData, setRequestData] = useState<RequestData | null>(null);
    const [suggestions, setSuggestions] = useState<Record<UtilityCategory, ProviderSuggestion[]>>({} as Record<UtilityCategory, ProviderSuggestion[]>);
    const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);

    const handleRetry = () => {
        setLoading(true);
        setError(null);
        // Force re-fetch by toggling a key or similar, but simplified:
        // In a real app we might use SWR/React Query.
        // Here we just re-run the effect by unmounting/remounting essentially, 
        // or we extract the fetch into a function we can call.
        loadRequestDataRef();
    };

    // Extract fetch logic to reuse
    const loadRequestDataRef = async () => {
        try {
            const response = await fetch(`/api/seller/${resolvedParams.token}`);

            if (!response.ok) {
                if (response.status === 404) {
                    setError('Request not found. Please check your link and try again.');
                } else {
                    setError('Failed to load request. Please try again later.');
                }
                setLoading(false);
                return;
            }

            const data = await response.json();
            const request = data.request;

            const reqData: RequestData = {
                property_address: request.property_address,
                utility_categories: request.utility_categories || ['electric', 'gas', 'water', 'sewer', 'trash'],
            };

            setRequestData(reqData);
            setSuggestions(data.suggestions || {});
            setBrandProfile(data.brandProfile || null);

        } catch (err) {
            console.error('Failed to load request data:', err);
            setError('Failed to load request. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRequestDataRef();
    }, [resolvedParams.token]);

    if (loading) {
        return <WizardLoader />;
    }

    if (error || !requestData) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 text-center">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
                        <AlertTriangle className="h-8 w-8 text-red-400" />
                    </div>
                    <h1 className="text-xl font-bold text-white mb-2">Unavailable</h1>
                    <p className="text-zinc-400 mb-6 text-sm">
                        {error || 'Something went wrong. Please check your link and try again.'}
                    </p>
                    <button
                        onClick={handleRetry}
                        className="px-6 py-2 bg-white text-black font-medium rounded-full text-sm hover:bg-zinc-200 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <SellerWizard
            initialRequestData={requestData}
            initialSuggestions={suggestions}
            token={resolvedParams.token}
            brandProfile={brandProfile}
        />
    );
}

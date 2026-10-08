'use client';

import { useEffect, useState, use } from 'react';
import { AlertTriangle } from 'lucide-react';
import { WizardLoader } from '@/components/ui/wizard-loader';
import type {
    AdvancedModuleExclusions,
    AdvancedModuleKey,
    AdvancedPacketData,
    HoaAnswers,
    PacketMode,
    ProviderSuggestion,
    UtilityCategory,
} from '@/types';
import { SellerWizard } from '@/components/seller-form/SellerWizard';
import { SellerLayout } from '@/components/seller-form/SellerLayout';
import { SellerStatusNotice } from '@/components/seller-form/steps/SellerStatusNotice';
import type { SellerPrefill } from '@/lib/seller-form/prefill';
import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';

interface RequestData {
    seller_intro?: string | null;
    property_address: string;
    utility_categories: UtilityCategory[];
    collect_electric_meter_number?: boolean;
    collect_hoa_questions?: boolean;
    packet_mode?: PacketMode;
    advanced_modules?: AdvancedModuleKey[];
    advanced_module_exclusions?: AdvancedModuleExclusions;
    advanced_packet_data?: AdvancedPacketData;
    hoa?: HoaAnswers;
    is_demo?: boolean;
    edit_version?: number;
    prefill?: SellerPrefill;
    /** Read-only: already sent and not reopened by the agent. */
    submitted?: boolean;
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
        loadRequestData();
    };

    const loadRequestData = async () => {
        try {
            const response = await fetch(`/api/seller/${resolvedParams.token}`);

            if (!response.ok) {
                if (response.status === 404) {
                    setError('We couldn’t find this form. Check your link and try again.');
                } else {
                    setError('We couldn’t load this form. Please try again in a moment.');
                }
                setLoading(false);
                return;
            }

            const data = await response.json();
            const request = data.request;

            const reqData: RequestData = {
                seller_intro: request.seller_intro || null,
                property_address: request.property_address,
                utility_categories: request.utility_categories || UTILITY_CATEGORY_KEYS,
                collect_electric_meter_number: request.collect_electric_meter_number !== false,
                collect_hoa_questions: request.collect_hoa_questions !== false,
                packet_mode: request.packet_mode || 'simple',
                advanced_modules: request.advanced_modules || [],
                advanced_module_exclusions: request.advanced_module_exclusions || {},
                advanced_packet_data: request.advanced_packet_data || {},
                hoa: request.hoa || undefined,
                is_demo: request.is_demo === true,
                edit_version: Number.isInteger(request.edit_version) ? request.edit_version : 0,
                prefill: request.prefill || undefined,
                submitted: request.status === 'submitted' && request.is_demo !== true,
            };

            if (reqData.submitted) {
                // The answers are on the sheet; a leftover local copy has no use.
                try {
                    localStorage.removeItem(`us_seller_draft:${resolvedParams.token}`);
                } catch {
                    // ignore
                }
            }

            setRequestData(reqData);
            setSuggestions(data.suggestions || {});
            setBrandProfile(data.brandProfile || null);

        } catch (err) {
            console.error('Failed to load request data:', err);
            setError('We couldn’t load this form. Please try again in a moment.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRequestData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resolvedParams.token]);

    if (loading) {
        return <WizardLoader />;
    }

    if (error || !requestData) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-card/60 border border-border rounded-2xl p-8 text-center space-y-5">
                    <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                        <AlertTriangle className="h-8 w-8 text-destructive" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-xl font-bold text-foreground">This link isn’t working</h1>
                        <p className="text-muted-foreground text-sm">
                            {error || 'Something went wrong. Please check your link and try again.'}
                        </p>
                    </div>
                    <button
                        onClick={handleRetry}
                        data-testid="seller-retry"
                        className="px-6 py-2.5 bg-foreground text-background font-medium rounded-full text-sm hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                        Try Again
                    </button>
                    <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                        Please ask whoever sent you this link to resend it.
                    </p>
                </div>
            </div>
        );
    }

    if (requestData.submitted) {
        return (
            <SellerLayout
                progress={100}
                address={requestData.property_address}
                stepName="Submitted"
                completedCount={0}
                totalCount={0}
                brandProfile={brandProfile}
            >
                <SellerStatusNotice kind="submitted" address={requestData.property_address} brandProfile={brandProfile} />
            </SellerLayout>
        );
    }

    return (
        <SellerWizard
            key={`session-${requestData.edit_version ?? 0}`}
            initialRequestData={requestData}
            initialSuggestions={suggestions}
            token={resolvedParams.token}
            brandProfile={brandProfile}
            isTestDrive={requestData.is_demo === true}
        />
    );
}

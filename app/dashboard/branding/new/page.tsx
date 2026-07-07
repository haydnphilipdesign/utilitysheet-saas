'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import BrandProfileForm from '@/components/branding/BrandProfileForm';
import type { BrandProfileFormData } from '@/types';
import { toast } from 'sonner';
import { useEffect, useState, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

function NewBrandingPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnTo = searchParams.get('returnTo');
    const [loading, setLoading] = useState(true);
    const [isPro, setIsPro] = useState(false);
    const [scopeLabel, setScopeLabel] = useState<string | undefined>(undefined);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await fetch('/api/account');
                if (response.ok) {
                    const data = await response.json();
                    const hasPaidAccess = data.account.subscription_status === 'pro' || data.activeOrganization?.subscription_status === 'team';
                    setIsPro(hasPaidAccess);
                    setScopeLabel(
                        data.activeOrganization
                            ? `Team profile · ${data.activeOrganization.name}`
                            : 'Personal profile'
                    );
                    if (!hasPaidAccess) {
                        toast.error('Upgrade to Pro to create custom branding');
                        router.push('/dashboard/branding');
                    }
                }
            } catch (error) {
                console.error('Error checking auth:', error);
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, [router]);

    const handleSubmit = async (data: BrandProfileFormData) => {
        try {
            const response = await fetch('/api/branding', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create profile');
            }

            toast.success('Brand profile created successfully');
            // Redirect back to where they came from, or default to branding page
            router.push(returnTo || '/dashboard/branding');
            router.refresh();
        } catch (error) {
            console.error('Error creating profile:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to create brand profile');
            throw error;
        }
    };

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return <BrandProfileForm onSubmit={handleSubmit} isPro={isPro} scopeLabel={scopeLabel} />;
}

export default function NewBrandingPage() {
    return (
        <Suspense fallback={
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        }>
            <NewBrandingPageContent />
        </Suspense>
    );
}

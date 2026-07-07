'use client';

import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BrandProfileForm from '@/components/branding/BrandProfileForm';
import type { BrandProfileFormData } from '@/types';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function EditBrandingPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const [initialData, setInitialData] = useState<BrandProfileFormData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isPro, setIsPro] = useState(false);
    const [scopeLabel, setScopeLabel] = useState<string | undefined>(undefined);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const [profileResponse, accountResponse] = await Promise.all([
                    fetch(`/api/branding/${resolvedParams.id}`),
                    fetch('/api/account'),
                ]);

                let organizationName: string | undefined;
                if (accountResponse.ok) {
                    const accountData = await accountResponse.json().catch(() => ({}));
                    setIsPro(accountData?.account?.subscription_status === 'pro' || accountData?.activeOrganization?.subscription_status === 'team');
                    organizationName = accountData?.activeOrganization?.name || undefined;
                }

                if (!profileResponse.ok) {
                    toast.error('Failed to fetch brand profile');
                    router.push('/dashboard/branding');
                    return;
                }

                const data = await profileResponse.json();
                setScopeLabel(
                    data?.organization_id
                        ? `Team profile${organizationName ? ` · ${organizationName}` : ''}`
                        : 'Personal profile'
                );
                setInitialData(data);
            } catch (error) {
                console.error('Error fetching profile:', error);
                toast.error('Error fetching brand profile');
                router.push('/dashboard/branding');
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [resolvedParams.id, router]);

    const handleSubmit = async (data: BrandProfileFormData) => {
        try {
            const response = await fetch(`/api/branding/${resolvedParams.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update profile');
            }

            toast.success('Brand profile updated successfully');
            router.push('/dashboard/branding');
            router.refresh();
        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to update brand profile');
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

    if (!initialData) return null;

    return (
        <BrandProfileForm
            initialData={initialData}
            onSubmit={handleSubmit}
            isEditing={true}
            isPro={isPro}
            scopeLabel={scopeLabel}
        />
    );
}

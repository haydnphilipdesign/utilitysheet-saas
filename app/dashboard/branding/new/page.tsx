'use client';

import { useRouter } from 'next/navigation';
import BrandProfileForm from '@/components/branding/BrandProfileForm';
import type { BrandProfileFormData } from '@/types';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function NewBrandingPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await fetch('/api/account');
                if (response.ok) {
                    const data = await response.json();
                    if (data.account.subscription_status !== 'pro') {
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
            router.push('/dashboard/branding');
            router.refresh();
        } catch (error) {
            console.error('Error creating profile:', error);
            toast.error('Failed to create brand profile');
        }
    };

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    return <BrandProfileForm onSubmit={handleSubmit} />;
}

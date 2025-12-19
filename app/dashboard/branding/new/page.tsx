'use client';

import { useRouter } from 'next/navigation';
import BrandProfileForm from '@/components/branding/BrandProfileForm';
import type { BrandProfileFormData } from '@/types';
import { toast } from 'sonner';

export default function NewBrandingPage() {
    const router = useRouter();

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

    return <BrandProfileForm onSubmit={handleSubmit} />;
}

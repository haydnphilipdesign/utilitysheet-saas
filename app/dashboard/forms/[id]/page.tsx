import { Suspense } from 'react';
import { FormEditor } from '@/components/seller-forms/FormEditor';
export default async function SellerFormPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    return (
        <Suspense fallback={<p>Loading seller form…</p>}>
            <FormEditor id={(await params).id} />
        </Suspense>
    );
}

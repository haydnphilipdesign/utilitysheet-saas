import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { FormsWorkspace } from '@/components/seller-forms/FormsWorkspace';
import { FormEditor } from '@/components/seller-forms/FormEditor';
import NewRequestPage from '@/app/dashboard/requests/new/page';

// Development-only rendering of production components. Browser tests mock every API.
// No auth/database/server mutation occurs on this fixture route.
export const metadata = {
    robots: { index: false, follow: false },
    title: 'Seller forms fixture',
};
export default async function SellerFormsFixture({
    searchParams,
}: {
    searchParams: Promise<{ id?: string; request?: string }>;
}) {
    if (process.env.NODE_ENV !== 'development') notFound();
    const query = await searchParams;
    return (
        <main className="min-h-screen bg-background p-4 sm:p-8">
            <Suspense fallback={<p>Loading…</p>}>
                {query.request ? (
                    <NewRequestPage />
                ) : query.id ? (
                    <FormEditor id={query.id} />
                ) : (
                    <FormsWorkspace />
                )}
            </Suspense>
        </main>
    );
}

import Link from 'next/link';
import { ProductUpdatesAdmin } from '@/components/admin/ProductUpdatesAdmin';
import { AdminPageHeader } from '@/components/admin/primitives';
import { Button } from '@/components/ui/button';
import { getProductUpdates } from '@/lib/neon/queries/updates';

export const dynamic = 'force-dynamic';

export default async function AdminUpdatesPage() {
    const updates = await getProductUpdates({ limit: 50, includeUnpublished: true });

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Product Updates"
                description="Draft, review, and publish changelog entries that appear in the customer dashboard."
                action={(
                    <Link href="/dashboard">
                        <Button variant="secondary">Back to App</Button>
                    </Link>
                )}
            />
            <ProductUpdatesAdmin updates={updates} />
        </div>
    );
}

import { redirect } from 'next/navigation';
import { requireAdmin, AdminAuthorizationError } from '@/lib/admin';
import { AdminLayoutContent } from './layout-content';
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    try {
        await requireAdmin();
    } catch (error) {
        if (error instanceof AdminAuthorizationError) {
            redirect('/dashboard');
        }
        throw error;
    }

    return (
        <>
            <ImpersonationBanner />
            <AdminLayoutContent>{children}</AdminLayoutContent>
        </>
    );
}

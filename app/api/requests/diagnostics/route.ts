import { NextResponse } from 'next/server';
import { sql } from '@/lib/neon/db';
import { AdminAuthorizationError, requireAdmin } from '@/lib/admin';

function diagnosticsEnabled(): boolean {
    if (process.env.NODE_ENV !== 'production') return true;
    return process.env.ENABLE_REQUEST_DIAGNOSTICS === 'true';
}

export async function GET() {
    try {
        if (!diagnosticsEnabled()) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const { account } = await requireAdmin();

        if (!sql) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
        }

        const accountId = account.id as string;
        const activeOrganizationId = (account.active_organization_id as string | null) || null;

        const [totalForAccount, deletedForAccount, personalVisible, orgVisible, visibleNow] = await Promise.all([
            sql`SELECT COUNT(*)::int as count FROM requests WHERE account_id = ${accountId}`,
            sql`SELECT COUNT(*)::int as count FROM requests WHERE account_id = ${accountId} AND deleted_at IS NOT NULL`,
            sql`SELECT COUNT(*)::int as count FROM requests WHERE account_id = ${accountId} AND organization_id IS NULL AND deleted_at IS NULL`,
            activeOrganizationId
                ? sql`SELECT COUNT(*)::int as count FROM requests WHERE organization_id = ${activeOrganizationId} AND deleted_at IS NULL`
                : Promise.resolve([{ count: 0 }]),
            activeOrganizationId
                ? sql`
                    SELECT COUNT(*)::int as count
                    FROM requests
                    WHERE deleted_at IS NULL
                        AND (
                            organization_id = ${activeOrganizationId}
                            OR (account_id = ${accountId} AND organization_id IS NULL)
                        )
                `
                : sql`SELECT COUNT(*)::int as count FROM requests WHERE account_id = ${accountId} AND organization_id IS NULL AND deleted_at IS NULL`,
        ]);

        return NextResponse.json({
            counts: {
                totalForAccount: Number(totalForAccount[0]?.count) || 0,
                deletedForAccount: Number(deletedForAccount[0]?.count) || 0,
                personalVisible: Number(personalVisible[0]?.count) || 0,
                orgVisible: Number(orgVisible[0]?.count) || 0,
                visibleNow: Number(visibleNow[0]?.count) || 0,
            },
        });
    } catch (error) {
        if (error instanceof AdminAuthorizationError) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        console.error('Error fetching request diagnostics:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}


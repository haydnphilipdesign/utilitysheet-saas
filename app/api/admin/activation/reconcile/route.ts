import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdmin, assertAdminWritesEnabled } from '@/lib/admin';
import { reconcileAuthUsers } from '@/lib/activation/reconcile-auth-users';

function parseLimit(value: string | null, fallback = 100) {
    const parsed = Number.parseInt(value || '', 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(parsed, 200));
}

function errorResponse(error: unknown, fallbackMessage: string) {
    if (error instanceof AdminAuthorizationError) {
        return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
        { error: error instanceof Error ? error.message : fallbackMessage },
        { status: 500 }
    );
}

export async function GET(request: Request) {
    try {
        await requireAdmin();

        const { searchParams } = new URL(request.url);
        const result = await reconcileAuthUsers({
            limit: parseLimit(searchParams.get('limit')),
            cursor: searchParams.get('cursor'),
            includeUnverified: searchParams.get('includeUnverified') === 'true',
            execute: false,
        });

        return NextResponse.json(result);
    } catch (error) {
        return errorResponse(error, 'Failed to preview reconciliation');
    }
}

export async function POST(request: Request) {
    try {
        await requireAdmin();
        assertAdminWritesEnabled();

        const body = await request.json().catch(() => ({}));
        const result = await reconcileAuthUsers({
            limit: parseLimit(typeof body?.limit === 'number' ? String(body.limit) : null),
            cursor: typeof body?.cursor === 'string' ? body.cursor : null,
            includeUnverified: body?.includeUnverified === true,
            execute: true,
        });

        return NextResponse.json(result);
    } catch (error) {
        return errorResponse(error, 'Failed to run reconciliation');
    }
}

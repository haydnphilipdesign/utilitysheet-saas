import { NextResponse } from 'next/server';
import { getProductUpdates } from '@/lib/neon/queries/updates';

export const dynamic = 'force-dynamic';

function clampInt(value: string | null, fallback: number, min: number, max: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = clampInt(searchParams.get('limit'), 5, 1, 20);
        const offset = clampInt(searchParams.get('offset'), 0, 0, 10_000);

        const updates = await getProductUpdates({ limit, offset, includeUnpublished: false });
        return NextResponse.json(updates);
    } catch (error) {
        console.error('Error fetching product updates:', error);
        return NextResponse.json({ error: 'Failed to fetch product updates' }, { status: 500 });
    }
}


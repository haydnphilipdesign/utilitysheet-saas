import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureAccountActivation } from '@/lib/activation/ensure-account-activation';
import { saveFirstTouchGrowthAttribution } from '@/lib/neon/queries';
import { stackServerApp } from '@/lib/stack/server';

const nullableField = z.string().trim().max(100).nullable();
const growthAttributionSchema = z.object({
    source: nullableField,
    medium: nullableField,
    campaign: nullableField,
    content: nullableField,
    referralCode: z.string().trim().max(60).regex(/^[a-z0-9-]+$/).nullable(),
    landingPath: z.string().trim().max(200).startsWith('/'),
});

export async function POST(request: Request) {
    const user = await stackServerApp.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = growthAttributionSchema.safeParse(
        await request.json().catch(() => null)
    );
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid attribution' }, { status: 400 });
    }

    const activation = await ensureAccountActivation(user);
    if (!activation?.account) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    await saveFirstTouchGrowthAttribution(activation.account.id, parsed.data);
    return new NextResponse(null, { status: 204 });
}

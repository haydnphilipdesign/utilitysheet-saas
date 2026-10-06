import { NextResponse } from 'next/server';
import { getOrCreateIntakeLink } from '@/lib/neon/queries';
import { intakeLinkUpdateBodySchema } from '@/lib/validation/schemas';
import { formErrorResponse, saveDefaultForm, sellerFormContext, sellerFormLinks, serializeSellerForm } from '@/lib/seller-forms/server';

// Legacy shape adapter to the authenticated workspace's default; one atomic save.
export async function GET() {
    try {
        const c = await sellerFormContext(); if ('error' in c) return c.error!;
        const form = await getOrCreateIntakeLink(c.state.account.id, c.organizationId);
        if (!form) return NextResponse.json({ error: 'Workspace form unavailable during rollout' }, { status: 409 });
        return NextResponse.json({ intakeLink: serializeSellerForm(form, await sellerFormLinks(c), new Set(c.brandProfiles.map(p => p.id))),
            brandProfiles: c.brandProfiles.map(p => ({ id: p.id, name: p.name, isDefault: p.is_default })),
            canCustomize: c.isPaid, companyName: c.state.account.company_name || '' });
    } catch (error) { return formErrorResponse(error); }
}
export async function POST(request: Request) {
    try {
        const c = await sellerFormContext(); if ('error' in c) return c.error!;
        const parsed = intakeLinkUpdateBodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: 'Invalid seller form settings', code: 'INVALID_INTAKE_LINK_UPDATE' }, { status: 400 });
        const { revision, ...patch } = parsed.data;
        return await saveDefaultForm(c, patch, revision);
    } catch (error) { return formErrorResponse(error); }
}

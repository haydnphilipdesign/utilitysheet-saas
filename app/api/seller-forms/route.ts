import { NextResponse } from 'next/server';
import {
    getOrCreateIntakeLink,
    listSellerForms,
    getSellerFormCount,
    saveSellerForm,
} from '@/lib/neon/queries';
import { sellerFormCapabilities } from '@/lib/seller-forms/capabilities';
import { sellerFormCreateBodySchema } from '@/lib/validation/schemas';
import {
    formConfiguration,
    normalizeFormPatch,
} from '@/lib/seller-forms/config';
import {
    formErrorResponse,
    ownedForm,
    sellerFormContext,
    serializeSellerForm,
    validateFormPatch,
} from '@/lib/seller-forms/server';

export async function GET() {
    try {
        const c = await sellerFormContext();
        if ('error' in c) return c.error!;
        await getOrCreateIntakeLink(c.state.account.id, c.organizationId);
        const forms = await listSellerForms(
            c.state.account.id,
            c.organizationId,
        );
        return NextResponse.json({
            forms: forms.map((f) =>
                serializeSellerForm(
                    f,
                    new Set(c.brandProfiles.map((p) => p.id)),
                ),
            ),
            defaultId: forms.find((f) => f.is_default)?.id || null,
            capabilities: sellerFormCapabilities(c.state.account.id, c.isPaid, forms.length, await getSellerFormCount(c.state.account.id)),
            isPaid: c.isPaid,
            workspaceName:
                c.state.activeOrganization?.name || 'Personal workspace',
            brandProfiles: c.brandProfiles.map((p) => ({
                id: p.id,
                name: p.name,
                isDefault: p.is_default,
            })),
        });
    } catch (error) {
        return formErrorResponse(error);
    }
}
export async function POST(request: Request) {
    try {
        const c = await sellerFormContext();
        if ('error' in c) return c.error!;
        const [forms, total] = await Promise.all([listSellerForms(c.state.account.id, c.organizationId), getSellerFormCount(c.state.account.id)]);
        const capabilities = sellerFormCapabilities(c.state.account.id, c.isPaid, forms.length, total);
        if (!capabilities.canCreate) return NextResponse.json({ error: capabilities.message, code: capabilities.reason === 'commercial' ? 'FORM_ALLOWANCE_REACHED' : capabilities.reason === 'technical' ? 'FORM_TECHNICAL_CAP_REACHED' : 'FORM_PILOT_UNAVAILABLE', capabilities }, { status: capabilities.reason === 'technical' ? 429 : 403 });
        const parsed = sellerFormCreateBodySchema.safeParse(
            await request.json().catch(() => null),
        );
        if (!parsed.success)
            return NextResponse.json(
                { error: 'Invalid seller form settings' },
                { status: 400 },
            );
        const { duplicateFromId, ...patch } = parsed.data;
        const source = duplicateFromId
            ? await ownedForm(c, duplicateFromId)
            : null;
        if (duplicateFromId && !source)
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const copied = source
            ? { ...formConfiguration(source), isActive: true }
            : {};
        const config = normalizeFormPatch(
            { ...copied, ...patch },
            source || undefined,
        );
        const invalid = await validateFormPatch(c, config, source || undefined);
        if (invalid) return invalid;
        const saved = await saveSellerForm(
            c.state.account.id,
            c.organizationId,
            null,
            null,
            config,
        );
        return saved
            ? NextResponse.json(
                  { form: serializeSellerForm(saved) },
                  { status: 201 },
              )
            : NextResponse.json({ error: 'Not found' }, { status: 404 });
    } catch (error) {
        return formErrorResponse(error);
    }
}

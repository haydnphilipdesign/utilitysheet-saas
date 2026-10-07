import { NextResponse } from 'next/server';
import {
    getOrCreateIntakeLink,
    getSellerFormLinkScope,
    getSharedSellerFormUsage,
    listSellerForms,
    listWorkspaceSellerForms,
    getSellerFormCount,
    saveSellerForm,
} from '@/lib/neon/queries';
import type { SellerFormLinkScope } from '@/lib/seller-forms/links';
import { sellerFormCapabilities } from '@/lib/seller-forms/capabilities';
import { sellerFormCreateBodySchema } from '@/lib/validation/schemas';
import {
    formConfiguration,
    normalizeFormPatch,
} from '@/lib/seller-forms/config';
import {
    formErrorResponse,
    usableForm,
    sellerFormContext,
    type FormContext,
    sellerFormLinks,
    serializeLinkBase,
    serializeSellerForm,
    validateFormPatch,
} from '@/lib/seller-forms/server';

/** A shared form does not use its creator's own allowance. */
const personalCount = (forms: Array<{ shared_owner_account_id?: string | null }>) =>
    forms.filter((f) => !f.shared_owner_account_id).length;

async function sharedUsage(c: FormContext) {
    if (!c.organizationId) return undefined;
    return { isTeams: c.isTeams, ...(await getSharedSellerFormUsage(c.organizationId)) };
}

export async function GET() {
    try {
        const c = await sellerFormContext();
        if ('error' in c) return c.error!;
        await getOrCreateIntakeLink(c.state.account.id, c.organizationId);
        const me = c.state.account.id;
        const [forms, links, shared] = await Promise.all([
            listWorkspaceSellerForms(me, c.organizationId),
            sellerFormLinks(c),
            sharedUsage(c),
        ]);
        // A teammate's shared form keeps its creator's link names.
        const scopes = new Map<string, SellerFormLinkScope | null>([[me, links]]);
        for (const creator of new Set(forms.map((f) => f.account_id))) {
            if (!scopes.has(creator))
                scopes.set(creator, await getSellerFormLinkScope(creator, c.organizationId));
        }
        const mine = forms.filter((f) => f.account_id === me);
        return NextResponse.json({
            forms: forms.map((f) =>
                serializeSellerForm(
                    f,
                    scopes.get(f.account_id) ?? null,
                    new Set(c.brandProfiles.map((p) => p.id)),
                    c,
                ),
            ),
            linkBase: serializeLinkBase(links),
            defaultId: mine.find((f) => f.is_default)?.id || null,
            capabilities: sellerFormCapabilities(me, c.isPaid, personalCount(mine), await getSellerFormCount(me), shared),
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
        const capabilities = sellerFormCapabilities(c.state.account.id, c.isPaid, personalCount(forms), total);
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
            ? await usableForm(c, duplicateFromId)
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
        // No current form: a new form's reviewed ending is checked by the atomic writer.
        const invalid = await validateFormPatch(c, config, source || undefined, null);
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
                  { form: serializeSellerForm(saved, await sellerFormLinks(c)) },
                  { status: 201 },
              )
            : NextResponse.json({ error: 'Not found' }, { status: 404 });
    } catch (error) {
        return formErrorResponse(error);
    }
}

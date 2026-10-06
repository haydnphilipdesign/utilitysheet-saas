import { NextResponse } from 'next/server';
import { saveSellerForm } from '@/lib/neon/queries';
import { sellerFormUpdateBodySchema } from '@/lib/validation/schemas';
import { normalizeFormPatch } from '@/lib/seller-forms/config';
import {
    formErrorResponse,
    ownedForm,
    sellerFormContext,
    sellerFormLinks,
    serializeSellerForm,
    validateFormPatch,
} from '@/lib/seller-forms/server';
type Params = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Params) {
    try {
        const c = await sellerFormContext();
        if ('error' in c) return c.error!;
        const form = await ownedForm(c, (await params).id);
        return form
            ? NextResponse.json({
                  form: serializeSellerForm(form, await sellerFormLinks(c)),
              })
            : NextResponse.json({ error: 'Not found' }, { status: 404 });
    } catch (error) {
        return formErrorResponse(error);
    }
}
export async function PATCH(request: Request, { params }: Params) {
    try {
        const c = await sellerFormContext();
        if ('error' in c) return c.error!;
        const form = await ownedForm(c, (await params).id);
        if (!form)
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const parsed = sellerFormUpdateBodySchema.safeParse(
            await request.json().catch(() => null),
        );
        if (!parsed.success)
            return NextResponse.json(
                { error: 'Invalid seller form settings' },
                { status: 400 },
            );
        const { revision, ...patch } = parsed.data;
        const invalid = await validateFormPatch(
            c,
            patch,
            form,
            patch.suffix !== undefined ? await sellerFormLinks(c) : null,
        );
        if (invalid) return invalid;
        const saved = await saveSellerForm(
            c.state.account.id,
            c.organizationId,
            form.id,
            revision,
            normalizeFormPatch(patch, form),
        );
        return saved
            ? NextResponse.json({
                  form: serializeSellerForm(saved, await sellerFormLinks(c)),
              })
            : NextResponse.json({ error: 'Not found' }, { status: 404 });
    } catch (error) {
        return formErrorResponse(error);
    }
}

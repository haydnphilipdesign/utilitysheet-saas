import { NextResponse } from 'next/server';
import { deleteSellerForm, saveSellerForm } from '@/lib/neon/queries';
import {
    sellerFormDeleteBodySchema,
    sellerFormUpdateBodySchema,
} from '@/lib/validation/schemas';
import { normalizeFormPatch } from '@/lib/seller-forms/config';
import {
    creatorFormLinks,
    editableForm,
    formErrorResponse,
    sellerFormContext,
    serializeSellerForm,
    usableForm,
    validateFormPatch,
} from '@/lib/seller-forms/server';
type Params = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Params) {
    try {
        const c = await sellerFormContext();
        if ('error' in c) return c.error!;
        const form = await usableForm(c, (await params).id);
        return form
            ? NextResponse.json({
                  form: serializeSellerForm(
                      form,
                      await creatorFormLinks(form),
                      undefined,
                      c,
                  ),
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
        const form = await editableForm(c, (await params).id);
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
        // The link name belongs to the creator alone, also on a shared form.
        if (
            patch.slug !== undefined &&
            patch.slug !== form.slug &&
            form.account_id !== c.state.account.id
        )
            return formErrorResponse({ code: 'SF411' });
        const invalid = await validateFormPatch(
            c,
            patch,
            form,
            patch.suffix !== undefined ? await creatorFormLinks(form) : null,
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
                  form: serializeSellerForm(
                      saved,
                      await creatorFormLinks(saved),
                      undefined,
                      c,
                  ),
              })
            : NextResponse.json({ error: 'Not found' }, { status: 404 });
    } catch (error) {
        return formErrorResponse(error);
    }
}
/** Hides the form for good. Its link stops and its names stay reserved. */
export async function DELETE(request: Request, { params }: Params) {
    try {
        const c = await sellerFormContext();
        if ('error' in c) return c.error!;
        const form = await editableForm(c, (await params).id);
        if (!form)
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const parsed = sellerFormDeleteBodySchema.safeParse(
            await request.json().catch(() => null),
        );
        if (!parsed.success)
            return NextResponse.json(
                { error: 'Invalid request' },
                { status: 400 },
            );
        const deleted = await deleteSellerForm(
            c.state.account.id,
            c.organizationId,
            form.id,
            parsed.data.revision,
        );
        return deleted
            ? NextResponse.json({ deleted: true, id: deleted.id })
            : NextResponse.json({ error: 'Not found' }, { status: 404 });
    } catch (error) {
        return formErrorResponse(error);
    }
}

import { NextResponse } from 'next/server';
import { setSellerFormShared } from '@/lib/neon/queries';
import { sellerFormShareBodySchema } from '@/lib/validation/schemas';
import {
    creatorFormLinks,
    formErrorResponse,
    sellerFormContext,
    serializeSellerForm,
    usableForm,
} from '@/lib/seller-forms/server';

/** Shares a form with the active workspace, or takes it back. */
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const c = await sellerFormContext();
        if ('error' in c) return c.error!;
        const form = await usableForm(c, (await params).id);
        if (!form || !c.organizationId)
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const parsed = sellerFormShareBodySchema.safeParse(
            await request.json().catch(() => null),
        );
        if (!parsed.success)
            return NextResponse.json(
                { error: 'Invalid request' },
                { status: 400 },
            );
        // Who may share or stop sharing is decided by set_seller_form_shared.
        const saved = await setSellerFormShared(
            c.state.account.id,
            c.organizationId,
            form.id,
            parsed.data.revision,
            parsed.data.shared,
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

import { NextResponse } from 'next/server';
import { setDefaultSellerForm } from '@/lib/neon/queries';
import {
    formErrorResponse,
    ownedForm,
    sellerFormContext,
    sellerFormLinks,
    serializeSellerForm,
} from '@/lib/seller-forms/server';
export async function POST(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const c = await sellerFormContext();
        if ('error' in c) return c.error!;
        const form = await ownedForm(c, (await params).id);
        if (!form)
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const saved = await setDefaultSellerForm(
            c.state.account.id,
            c.organizationId,
            form.id,
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

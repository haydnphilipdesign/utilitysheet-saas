import { NextResponse } from 'next/server';
import { saveSellerForm } from '@/lib/neon/queries';
import { validateIntakeSlug } from '@/lib/neon/queries/intake-links';
import { sellerFormLinkBaseBodySchema } from '@/lib/validation/schemas';
import {
    formErrorResponse,
    sellerFormContext,
    sellerFormLinks,
    serializeLinkBase,
} from '@/lib/seller-forms/server';

// Renames the shared base of the authenticated creator's current workspace.
// The base form is resolved server-side and never changes; its previous slugs
// stay published as aliases, so every link shared before keeps opening.
export async function PATCH(request: Request) {
    try {
        const c = await sellerFormContext();
        if ('error' in c) return c.error!;
        const parsed = sellerFormLinkBaseBodySchema.safeParse(
            await request.json().catch(() => null),
        );
        if (!parsed.success)
            return NextResponse.json(
                { error: 'Invalid link name', code: 'INVALID_LINK_BASE' },
                { status: 400 },
            );
        const { base, revision } = parsed.data;
        try {
            validateIntakeSlug(base);
        } catch (error) {
            return NextResponse.json(
                {
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Invalid link name',
                    code: 'INVALID_SLUG',
                },
                { status: 400 },
            );
        }
        const links = await sellerFormLinks(c);
        if (!links)
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (base === links.baseSlug)
            return NextResponse.json({ linkBase: serializeLinkBase(links) });
        if (!c.isPaid)
            return NextResponse.json(
                {
                    error: 'Upgrade required',
                    message: 'Custom links are available on Pro and Teams.',
                },
                { status: 403 },
            );
        const saved = await saveSellerForm(
            c.state.account.id,
            c.organizationId,
            links.rootFormId,
            revision,
            { slug: base },
        );
        if (!saved)
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json({
            linkBase: serializeLinkBase(await sellerFormLinks(c)),
        });
    } catch (error) {
        return formErrorResponse(error);
    }
}

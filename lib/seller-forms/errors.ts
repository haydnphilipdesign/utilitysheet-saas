import { NextResponse } from 'next/server';
export function formErrorResponse(error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === 'SF409')
        return NextResponse.json(
            {
                error: 'Form changed. Reload before saving or starting.',
                code: 'FORM_REVISION_CONFLICT',
            },
            { status: 409 },
        );
    if (code === 'SF403') return NextResponse.json({ error: 'Additional forms are temporarily unavailable for this account.', code: 'FORM_PILOT_UNAVAILABLE' }, { status: 403 });
    if (code === 'SF402') {
        let counts: { allowance?: number; usage?: number } = {};
        try { counts = JSON.parse((error as { detail?: string }).detail || '{}'); } catch { /* Counts are optional; never expose raw database detail. */ }
        const allowance = counts.allowance === 10 ? 10 : 1;
        return NextResponse.json({ error: allowance === 1 ? 'Free includes one customizable form per workspace. Upgrade to Pro for up to ten.' : 'This workspace has reached its allowance of ten forms. Edit or reuse an existing form.', code: 'FORM_ALLOWANCE_REACHED', allowance, usage: Number.isInteger(counts.usage) ? counts.usage : undefined }, { status: 403 });
    }
    if (code === 'SF429')
        return NextResponse.json(
            {
                error: 'The account form limit has been reached. Existing forms remain available.',
                code: 'FORM_TECHNICAL_CAP_REACHED',
            },
            { status: 429 },
        );
    if (code === 'SF423')
        return NextResponse.json(
            {
                error: 'That link ending is already used by another of your forms, or was shared before. Choose another.',
                code: 'SUFFIX_IN_USE',
            },
            { status: 409 },
        );
    if (code === 'SF422')
        return NextResponse.json(
            {
                error: 'This form uses the base link and has no link ending.',
                code: 'BASE_FORM_HAS_NO_ENDING',
            },
            { status: 400 },
        );
    if (code === '23505')
        return NextResponse.json(
            {
                error: 'That link is already published. Choose another.',
                code: 'SLUG_IN_USE',
            },
            { status: 409 },
        );
    console.error('Seller form operation failed', { code: code || 'unknown' });
    return NextResponse.json(
        { error: 'Unable to save seller form. Try again.' },
        { status: 500 },
    );
}

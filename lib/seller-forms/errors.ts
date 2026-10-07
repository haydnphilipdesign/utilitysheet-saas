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
    // Sharing and delete rules. See migrations-seller-form-sharing-and-delete.sql.
    const sharing: Record<string, [number, string, string]> = {
        SF411: [403, 'FORM_NOT_ALLOWED', 'You can’t change this form. Ask the person who created it or a workspace admin.'],
        SF412: [403, 'FORM_SHARING_NEEDS_TEAMS', 'Sharing a form with your team is part of the Teams plan.'],
        SF413: [403, 'FORM_SHARED_ALLOWANCE_REACHED', 'This workspace has shared as many forms as its plan allows. Stop sharing one first.'],
        SF414: [409, 'FORM_CREATOR_LEFT', 'The person who created this form has left the workspace, so it stays shared.'],
        SF415: [409, 'FORM_CREATOR_ALLOWANCE_REACHED', 'The person who created this form already has as many forms of their own as their plan allows. They need to delete one first.'],
        SF416: [409, 'FORM_IS_DEFAULT', 'Make another form the default before deleting this one.'],
    };
    if (code && sharing[code]) {
        const [status, name, message] = sharing[code];
        return NextResponse.json({ error: message, code: name }, { status });
    }
    // Only raised by a database that predates migrations-seller-form-default-base-link.sql.
    if (code === 'SF422')
        return NextResponse.json(
            {
                error: 'This form cannot have its own link ending yet. Try again later.',
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

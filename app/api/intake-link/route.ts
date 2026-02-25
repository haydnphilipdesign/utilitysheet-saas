import { NextResponse } from 'next/server';
import { getOrCreateAccount, getAccountOrganizations, getOrCreateIntakeLink, updateIntakeLinkSlug } from '@/lib/neon/queries';
import { stackServerApp } from '@/lib/stack/server';

type OrganizationSummary = { id: string; subscription_status?: string | null };

function getAppBaseUrl() {
    return (
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
        'http://localhost:3000'
    );
}

function canCustomizeSlug(subscriptionStatus: string, activeOrgStatus?: string | null) {
    if (subscriptionStatus === 'pro') return true;
    if (activeOrgStatus === 'team') return true;
    return false;
}

export async function GET() {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const account = await getOrCreateAccount(user.id, user.primaryEmail || '', user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        const intakeLink = await getOrCreateIntakeLink(account.id);
        if (!intakeLink) {
            return NextResponse.json({ error: 'Failed to load intake link' }, { status: 500 });
        }

        const organizations = await getAccountOrganizations(account.id);
        const activeOrg = (organizations as OrganizationSummary[]).find((o) => o.id === account.active_organization_id) || null;

        const baseUrl = getAppBaseUrl();
        const url = `${baseUrl}/i/${intakeLink.slug}`;
        const canCustomize = canCustomizeSlug(account.subscription_status, activeOrg?.subscription_status);

        return NextResponse.json({
            intakeLink: {
                slug: intakeLink.slug,
                url,
                is_active: intakeLink.is_active,
            },
            canCustomize,
            companyName: account.company_name || '',
        });
    } catch (error) {
        console.error('Error fetching intake link:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const account = await getOrCreateAccount(user.id, user.primaryEmail || '', user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        const organizations = await getAccountOrganizations(account.id);
        const activeOrg = (organizations as OrganizationSummary[]).find((o) => o.id === account.active_organization_id) || null;

        const allowed = canCustomizeSlug(account.subscription_status, activeOrg?.subscription_status);
        if (!allowed) {
            return NextResponse.json(
                { error: 'Upgrade required', message: 'Custom branded links are available on Pro and Teams.' },
                { status: 403 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const slug = String(body?.slug || '').trim();
        if (!slug) {
            return NextResponse.json({ error: 'Invalid slug', message: 'Slug is required.' }, { status: 400 });
        }

        const updated = await updateIntakeLinkSlug(account.id, slug);
        if (!updated) {
            return NextResponse.json({ error: 'Failed to update intake link' }, { status: 500 });
        }

        const baseUrl = getAppBaseUrl();
        const url = `${baseUrl}/i/${updated.slug}`;

        return NextResponse.json({
            intakeLink: {
                slug: updated.slug,
                url,
                is_active: updated.is_active,
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        const status = message.toLowerCase().includes('slug') ? 400 : 500;
        if (status === 400) {
            return NextResponse.json({ error: 'Invalid slug', message }, { status });
        }
        console.error('Error updating intake link:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

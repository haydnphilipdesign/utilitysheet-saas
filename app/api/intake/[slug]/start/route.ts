import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getIntakeLinkBySlug, getAccountById, getAccountOrganizations, getDefaultBrandProfile, getMonthlyUsage, createRequest, createEventLog } from '@/lib/neon/queries';
import { intakeStartRatelimit, checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';
import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';

type OrganizationSummary = { id: string; subscription_status?: string | null };

const intakeStartBodySchema = z.object({
    propertyAddress: z.string().trim().min(5).max(200),
});

export async function POST(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;

        const ipAddress =
            request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') ||
            'unknown';

        const rateLimitResult = await checkRateLimit(intakeStartRatelimit, `${slug}:${ipAddress}`);
        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Too many attempts. Please wait a moment and try again.' },
                { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
            );
        }

        const body = await request.json().catch(() => ({}));
        const parsed = intakeStartBodySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid request', details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const intakeLink = await getIntakeLinkBySlug(slug);
        if (!intakeLink || !intakeLink.is_active) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const account = await getAccountById(intakeLink.account_id);
        if (!account || account.role === 'banned') {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const organizations = await getAccountOrganizations(account.id);
        const activeOrg = (organizations as OrganizationSummary[]).find((o) => o.id === account.active_organization_id) || null;

        const usage = await getMonthlyUsage(account.id, activeOrg?.id);
        const isOverLimit = usage.used >= usage.limit;
        const shouldLock = usage.plan === 'free' && isOverLimit;

        const defaultBrand = await getDefaultBrandProfile(account.id, activeOrg?.id);

        const newRequest = await createRequest({
            accountId: account.id,
            organizationId: account.active_organization_id || undefined,
            brandProfileId: defaultBrand?.id,
            propertyAddress: parsed.data.propertyAddress,
            utilityCategories: UTILITY_CATEGORY_KEYS,
            isLocked: shouldLock,
            lockedReason: shouldLock ? 'monthly_limit' : undefined,
        });

        if (!newRequest) {
            return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
        }

        const userAgent = request.headers.get('user-agent') || null;
        await createEventLog({
            requestId: newRequest.id,
            eventType: 'request_created',
            eventData: {
                actor: 'seller',
                source: 'intake_link',
                slug,
                utility_categories: UTILITY_CATEGORY_KEYS,
            },
            ipAddress: ipAddress === 'unknown' ? null : ipAddress,
            userAgent,
        });

        return NextResponse.json({ sellerToken: newRequest.seller_token });
    } catch (error) {
        console.error('Error starting intake link:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

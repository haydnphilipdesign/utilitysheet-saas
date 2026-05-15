import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getIntakeLinkBySlug, getAccountById, getAccountOrganizations, getDefaultBrandProfile, getRequestBySellerToken, createRequest, createEventLog, getMonthlyUsage } from '@/lib/neon/queries';
import { intakeStartRatelimit, checkRateLimit, getRateLimitHeaders, isRateLimitUnavailable } from '@/lib/rate-limit';
import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import { buildStructuredPropertyAddress } from '@/lib/address/structured-address';
import { getClientIp } from '@/lib/network/client-ip';
import { formatCanonicalIntakeAddress, hasIntakeStreetNumber, validateIntakeAddress } from '@/lib/address/intake-validation';
import { normalizeAdvancedModuleExclusions, normalizeAdvancedModules } from '@/lib/packet/modules';
import { invalidRequestBodyResponse } from '@/lib/security/api-response';

type OrganizationSummary = { id: string; subscription_status?: string | null };

function parseCookies(header: string | null): Record<string, string> {
    if (!header) return {};
    const out: Record<string, string> = {};
    header.split(';').forEach((part) => {
        const idx = part.indexOf('=');
        if (idx === -1) return;
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (!key) return;
        out[key] = value;
    });
    return out;
}

function normalizeAddress(input: string) {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ');
}

function base64UrlEncode(input: string) {
    return Buffer.from(input, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function base64UrlDecode(input: string) {
    const padded = input.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (padded.length % 4)) % 4;
    const withPadding = padded + '='.repeat(padLength);
    return Buffer.from(withPadding, 'base64').toString('utf8');
}

const intakeStartBodySchema = z.object({
    propertyAddress: z.string().trim().min(5).max(200),
});

export async function POST(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;

        const ipAddress = getClientIp(request, 'unknown');

        const rateLimitResult = await checkRateLimit(intakeStartRatelimit, `${slug}:${ipAddress}`, { requirePersistent: process.env.NODE_ENV === 'production' });
        if (isRateLimitUnavailable(rateLimitResult)) {
            return NextResponse.json(
                { error: 'Temporarily unavailable. Please try again shortly.' },
                { status: 503 }
            );
        }

        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Too many attempts. Please wait a moment and try again.' },
                { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
            );
        }

        const body = await request.json().catch(() => ({}));
        const parsed = intakeStartBodySchema.safeParse(body);
        if (!parsed.success) {
            return invalidRequestBodyResponse('INVALID_INTAKE_START_REQUEST', 'Invalid intake request body');
        }
        const intakeValidation = validateIntakeAddress(parsed.data.propertyAddress);
        if (!intakeValidation.isComplete) {
            const missingFieldCounts = intakeValidation.missingFields.reduce<Record<string, number>>((acc, field) => {
                acc[field] = (acc[field] || 0) + 1;
                return acc;
            }, {});
            console.warn('[Intake start] Incomplete property address rejected', {
                slug,
                missingFields: intakeValidation.missingFields,
                missingFieldCounts,
            });
            return NextResponse.json(
                {
                    error: 'Incomplete address',
                    message: 'Please include house number, street address, city, state, and ZIP code.',
                    missingFields: intakeValidation.missingFields,
                },
                { status: 400 }
            );
        }
        const canonicalPropertyAddress = formatCanonicalIntakeAddress(intakeValidation.parsed);

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
        const isPaid = account.subscription_status === 'pro' || activeOrg?.subscription_status === 'team';
        if (!isPaid) {
            const usage = await getMonthlyUsage(account.id, activeOrg?.id);
            if (usage.used >= usage.limit) {
                return NextResponse.json(
                    {
                        error: 'Monthly limit reached',
                        code: 'MONTHLY_LIMIT_REACHED',
                        message: `This account has reached its ${usage.plan} plan limit of ${usage.limit} requests this month.`,
                    },
                    { status: 403 }
                );
            }
        }

        const normalizedAddress = normalizeAddress(canonicalPropertyAddress);
        const cookieName = `us_intake_${slug}`;
        const cookies = parseCookies(request.headers.get('cookie'));
        const existingCookie = cookies[cookieName];

        if (existingCookie) {
            try {
                const decoded = base64UrlDecode(existingCookie);
                const payload = JSON.parse(decoded) as { a?: unknown; t?: unknown };
                const a = typeof payload.a === 'string' ? payload.a : null;
                const t = typeof payload.t === 'string' ? payload.t : null;
                if (a && t && a === normalizedAddress) {
                    const existingRequest = await getRequestBySellerToken(t);
                    if (
                        existingRequest &&
                        existingRequest.account_id === account.id &&
                        normalizeAddress(existingRequest.property_address) === normalizedAddress &&
                        existingRequest.status !== 'submitted'
                    ) {
                        const res = NextResponse.json({ sellerToken: t }, { headers: getRateLimitHeaders(rateLimitResult) });
                        res.headers.append(
                            'Set-Cookie',
                            `${cookieName}=${existingCookie}; Path=/; Max-Age=${60 * 60 * 24 * 14}; SameSite=Lax; HttpOnly`
                        );
                        return res;
                    }
                }
            } catch {
                // ignore malformed cookie
            }
        }

        const defaultBrand = await getDefaultBrandProfile(account.id, activeOrg?.id);
        const structuredPropertyAddress = await buildStructuredPropertyAddress(canonicalPropertyAddress);
        const packetMode = isPaid && intakeLink.default_packet_mode === 'advanced' ? 'advanced' : 'simple';
        const advancedModules = packetMode === 'advanced'
            ? normalizeAdvancedModules(intakeLink.advanced_modules)
            : [];
        const advancedModuleExclusions = packetMode === 'advanced'
            ? normalizeAdvancedModuleExclusions(intakeLink.advanced_module_exclusions, advancedModules)
            : {};

        const newRequest = await createRequest({
            accountId: account.id,
            organizationId: account.active_organization_id || undefined,
            brandProfileId: defaultBrand?.id,
            propertyAddress: canonicalPropertyAddress,
            propertyAddressStructured: structuredPropertyAddress,
            utilityCategories: UTILITY_CATEGORY_KEYS,
            status: 'draft',
            meteredAt: null,
            packetMode,
            advancedModules,
            advancedModuleExclusions,
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
                submitted_property_address: parsed.data.propertyAddress,
                canonical_property_address: canonicalPropertyAddress,
                address_was_canonicalized: parsed.data.propertyAddress !== canonicalPropertyAddress,
                street_has_number: hasIntakeStreetNumber(intakeValidation.parsed.street),
                utility_categories: UTILITY_CATEGORY_KEYS,
                packet_mode: packetMode,
                advanced_modules: advancedModules,
                advanced_module_exclusions: advancedModuleExclusions,
            },
            ipAddress: ipAddress === 'unknown' ? null : ipAddress,
            userAgent,
        });

        const cookiePayload = base64UrlEncode(JSON.stringify({ a: normalizedAddress, t: newRequest.seller_token }));
        const response = NextResponse.json({ sellerToken: newRequest.seller_token }, { headers: getRateLimitHeaders(rateLimitResult) });
        response.headers.append(
            'Set-Cookie',
            `${cookieName}=${cookiePayload}; Path=/; Max-Age=${60 * 60 * 24 * 14}; SameSite=Lax; HttpOnly`
        );
        return response;
    } catch (error) {
        console.error('Error starting intake link:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}


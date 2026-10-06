/**
 * Public reusable-link handlers shared by the flat (`/i/base`) and nested
 * (`/i/base/ending`) shapes. The target form is always resolved server-side;
 * limits and draft resume key on that form, never on the URL text.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
    createEventLog,
    createRequest,
    getIntakeBrandProfile,
    getIntakeLinkByBaseSlug,
    getIntakeLinkBySuffix,
    getRequestBySellerToken,
    getSellerFormAliasSlugs,
    normalizeIntakeUtilityCategories,
} from '@/lib/neon/queries';
import type { IntakeLink } from '@/lib/neon/queries/intake-links';
import { intakeStartRatelimit, checkRateLimit, getRateLimitHeaders, isRateLimitUnavailable } from '@/lib/rate-limit';
import { buildStructuredPropertyAddress } from '@/lib/address/structured-address';
import { getClientIp } from '@/lib/network/client-ip';
import { formatCanonicalIntakeAddress, hasIntakeStreetNumber, validateIntakeAddress } from '@/lib/address/intake-validation';
import { invalidRequestBodyResponse } from '@/lib/security/api-response';
import { publicFormScope } from './public';
import { formRequestFields } from './config';
import { formErrorResponse } from './errors';
import { isValidLinkSuffix } from './links';

export interface IntakeTarget {
    slug: string;
    /** Present only for a nested link. */
    suffix?: string;
}

const LEGACY_COOKIE_PREFIX = 'us_intake_';
// Slugs never contain an underscore, so this cannot collide with a legacy name.
const FORM_COOKIE_PREFIX = 'us_intake_f_';
const MAX_LEGACY_RESUME_COOKIES = 5;
const COOKIE_ATTRIBUTES = `Path=/; Max-Age=${60 * 60 * 24 * 14}; SameSite=Lax; HttpOnly`;

/** Unknown, foreign and malformed links all resolve to null. */
async function resolveTarget(target: IntakeTarget): Promise<IntakeLink | null> {
    if (target.suffix === undefined) return getIntakeLinkByBaseSlug(target.slug);
    if (!isValidLinkSuffix(target.suffix)) return null;
    return getIntakeLinkBySuffix(target.slug, target.suffix);
}

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

export async function intakeMetadataResponse(target: IntakeTarget) {
    try {
        const intakeLink = await resolveTarget(target);
        if (!intakeLink || !intakeLink.is_active) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const scope = await publicFormScope(intakeLink);
        if (!scope) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const { account, organization: activeOrg } = scope;
        const brandProfile = await getIntakeBrandProfile(
            account.id,
            activeOrg?.id,
            intakeLink.default_brand_profile_id
        );
        const publicBrandProfile = brandProfile
            ? {
                name: brandProfile.name,
                logo_url: brandProfile.logo_url,
                primary_color: brandProfile.primary_color,
                contact_email: brandProfile.contact_email,
                contact_phone: brandProfile.contact_phone,
                contact_website: brandProfile.contact_website,
            }
            : null;

        return NextResponse.json({
            accepting: true,
            sellerIntro: intakeLink.seller_intro || null,
            configuration: formRequestFields(intakeLink, scope.isPaid),
            brandProfile: publicBrandProfile,
            utility_categories: normalizeIntakeUtilityCategories(intakeLink.default_utility_categories),
        });
    } catch (error) {
        console.error('Error fetching intake link:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function intakeStartResponse(request: Request, target: IntakeTarget) {
    try {
        const { slug } = target;
        const ipAddress = getClientIp(request, 'unknown');

        // One bounded lookup, then the limit. Every alias of a form shares its
        // bucket; invented bases and endings share one bucket per IP.
        const intakeLink = await resolveTarget(target);
        const rateLimitResult = await checkRateLimit(
            intakeStartRatelimit,
            intakeLink ? `form:${intakeLink.id}:${ipAddress}` : `unknown:${ipAddress}`,
            { requirePersistent: process.env.NODE_ENV === 'production' },
        );
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
        if (!intakeLink) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
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

        if (!intakeLink.is_active) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const scope = await publicFormScope(intakeLink);
        if (!scope) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const { account, organization: activeOrg, isPaid } = scope;
        // No plan-limit check here: Free submissions past the monthly limit are
        // saved locked by the seller submission route.

        const normalizedAddress = normalizeAddress(canonicalPropertyAddress);
        const cookieName = `${FORM_COOKIE_PREFIX}${intakeLink.id}`;
        const cookies = parseCookies(request.headers.get('cookie'));

        // Resume candidates: this form's own cookie, then cookies written under
        // one of this form's flat aliases before form-keyed cookies existed. A
        // sibling form's cookie is never read, even with the same base or address.
        const candidates: string[] = [];
        if (cookies[cookieName]) candidates.push(cookies[cookieName]);
        const legacyNames = Object.keys(cookies).filter(
            (name) => name.startsWith(LEGACY_COOKIE_PREFIX) && !name.startsWith(FORM_COOKIE_PREFIX),
        );
        if (legacyNames.length > 0) {
            // The bare link opens the default form, which may not own the slug in
            // the URL, so even this link's own slug cookie needs its alias proven.
            const flatName = `${LEGACY_COOKIE_PREFIX}${slug}`;
            const names = [
                ...legacyNames.filter((name) => name === flatName),
                ...legacyNames.filter((name) => name !== flatName),
            ].slice(0, MAX_LEGACY_RESUME_COOKIES);
            const aliases = new Set((await getSellerFormAliasSlugs(intakeLink.id, names.map(name => name.slice(LEGACY_COOKIE_PREFIX.length)))).map((alias) => `${LEGACY_COOKIE_PREFIX}${alias}`));
            names.filter((name) => aliases.has(name)).forEach((name) => candidates.push(cookies[name]));
        }

        for (const existingCookie of candidates) {
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
                        (existingRequest.organization_id || null) === (intakeLink.organization_id || null) &&
                        (existingRequest.source_form_id === intakeLink.id || (!existingRequest.source_form_id && intakeLink.is_referral_identity === true)) &&
                        normalizeAddress(existingRequest.property_address) === normalizedAddress &&
                        existingRequest.status !== 'submitted'
                    ) {
                        const res = NextResponse.json({ sellerToken: t }, { headers: getRateLimitHeaders(rateLimitResult) });
                        // Also moves a valid legacy resume onto the form-keyed cookie.
                        res.headers.append('Set-Cookie', `${cookieName}=${existingCookie}; ${COOKIE_ATTRIBUTES}`);
                        return res;
                    }
                }
            } catch {
                // ignore malformed cookie
            }
        }

        const defaultBrand = await getIntakeBrandProfile(
            account.id,
            activeOrg?.id,
            intakeLink.default_brand_profile_id
        );
        const utilityCategories = normalizeIntakeUtilityCategories(intakeLink.default_utility_categories);
        const structuredPropertyAddress = await buildStructuredPropertyAddress(canonicalPropertyAddress);
        const fields = formRequestFields(intakeLink, isPaid);
        const { packetMode, advancedModules, advancedModuleExclusions } = fields;

        const newRequest = await createRequest({
            ...fields,
            accountId: account.id,
            organizationId: activeOrg?.id || undefined,
            brandProfileId: defaultBrand?.id,
            propertyAddress: canonicalPropertyAddress,
            propertyAddressStructured: structuredPropertyAddress,
            utilityCategories,
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
                ...(target.suffix !== undefined ? { suffix: target.suffix } : {}),
                submitted_property_address: parsed.data.propertyAddress,
                canonical_property_address: canonicalPropertyAddress,
                address_was_canonicalized: parsed.data.propertyAddress !== canonicalPropertyAddress,
                street_has_number: hasIntakeStreetNumber(intakeValidation.parsed.street),
                utility_categories: utilityCategories,
                packet_mode: packetMode,
                advanced_modules: advancedModules,
                advanced_module_exclusions: advancedModuleExclusions,
            },
            ipAddress: ipAddress === 'unknown' ? null : ipAddress,
            userAgent,
        });

        const cookiePayload = base64UrlEncode(JSON.stringify({ a: normalizedAddress, t: newRequest.seller_token }));
        const response = NextResponse.json({ sellerToken: newRequest.seller_token }, { headers: getRateLimitHeaders(rateLimitResult) });
        response.headers.append('Set-Cookie', `${cookieName}=${cookiePayload}; ${COOKIE_ATTRIBUTES}`);
        return response;
    } catch (error) {
        if ((error as { code?: string })?.code === 'SF409') return formErrorResponse(error);
        console.error('Error starting intake link:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

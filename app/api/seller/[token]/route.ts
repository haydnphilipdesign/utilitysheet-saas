import { NextResponse } from 'next/server';
import { getRequestBySellerToken, getRequestByToken, getDefaultBrandProfile, getAccountById, getOrganizationById, getMonthlyUsage, createEventLog } from '@/lib/neon/queries';
import { sql } from '@/lib/neon/db';
import { hasValidContact, resolveContact } from '@/lib/providers/contact-service';
import { sendTCCompletionNotificationEmail, sendContactResolutionAlertEmail } from '@/lib/email/email-service';
import { formSubmissionRatelimit, checkRateLimit, getRateLimitHeaders, isRateLimitUnavailable } from '@/lib/rate-limit';
import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import { sellerSubmissionBodySchema } from '@/lib/validation/schemas';
import { getClientIpOrNull } from '@/lib/network/client-ip';
import { invalidRequestBodyResponse } from '@/lib/security/api-response';
import { markAiSuggestionSelection } from '@/lib/neon/queries/ai-telemetry';
import { buildSellerSubmittedEventSummary } from '@/lib/telemetry/seller-submission';
import {
    filterAdvancedPacketDataByExclusions,
    getAdvancedModuleVisibleFieldKeys,
    normalizeAdvancedModuleExclusions,
    normalizeAdvancedModules,
} from '@/lib/packet/modules';
import type {
    AdvancedModuleExclusions,
    AdvancedModuleKey,
    PacketMode,
    Request as StoredRequest,
    TrashPickupDay,
    UtilityCategory,
} from '@/types';

export const runtime = 'nodejs';

type SellerRequestRecord = StoredRequest & {
    utility_categories?: string[] | null;
    packet_mode?: PacketMode | null;
    advanced_modules?: AdvancedModuleKey[] | null;
    advanced_module_exclusions?: AdvancedModuleExclusions | null;
    advanced_packet_data?: Record<string, unknown> | null;
    metered_at?: string | null;
    is_locked?: boolean | null;
};

type SellerUtilityExtra = {
    tank?: string | null;
    auto_delivery?: string | null;
    trash_type?: string | null;
    notes?: string | null;
    has_recycling?: 'yes' | 'no' | 'not_sure' | null;
    trash_pickup_day?: TrashPickupDay | null;
    trash_pickup_days?: TrashPickupDay[] | null;
    recycling_pickup_day?: TrashPickupDay | null;
};

type SellerUtilityEntryInput = {
    entry_mode: string | null;
    display_name?: string | null;
    raw_text?: string | null;
    hidden?: boolean | null;
    contact_phone?: string | null;
    contact_url?: string | null;
    meter_number?: string | null;
    canonical_id?: string | null;
    confidence_score?: number | null;
    extra?: SellerUtilityExtra | null;
};

type ContactResolutionTarget = {
    category: UtilityCategory;
    providerName: string;
    hadSubmittedContact: boolean;
};

const DEMO_WORKSPACE_SLUG = 'utilitysheet-demo';
const DEMO_ADDRESS_PATTERN = /\b123\s+main\s+(?:street|st)\b.*\banytown\b.*\bpa\b.*\b18301\b/i;
const DEMO_PROVIDER_CONTACTS: Record<string, { phone: string; url: string }> = {
    'keystone electric co.': {
        phone: '555-0101',
        url: 'https://keystone-electric.example/start',
    },
    'valley natural gas': {
        phone: '555-0102',
        url: 'https://valley-natural-gas.example/start',
    },
    'anytown water authority': {
        phone: '555-0103',
        url: 'https://anytown-water.example/start',
    },
    'anytown sewer authority': {
        phone: '555-0104',
        url: 'https://anytown-sewer.example/start',
    },
    'greencart waste services': {
        phone: '555-0105',
        url: 'https://greencart-waste.example/start',
    },
    'blue ridge fiber': {
        phone: '555-0106',
        url: 'https://blue-ridge-fiber.example/start',
    },
};

const TRASH_PICKUP_DAYS = new Set<TrashPickupDay>([
    'mon',
    'tue',
    'wed',
    'thu',
    'fri',
    'sat',
    'sun',
    'varies',
    'not_sure',
]);

function normalizeTrashPickupDay(value: unknown): TrashPickupDay | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim().toLowerCase();
    if (normalized === '') return null;
    return TRASH_PICKUP_DAYS.has(normalized as TrashPickupDay)
        ? (normalized as TrashPickupDay)
        : undefined;
}

function normalizeTrashPickupDays(value: unknown): TrashPickupDay[] | undefined {
    if (value === undefined || value === null) return undefined;
    if (!Array.isArray(value)) return undefined;

    const days: TrashPickupDay[] = [];
    for (const item of value) {
        const normalized = normalizeTrashPickupDay(item);
        if (normalized && !days.includes(normalized)) {
            days.push(normalized);
        }
    }

    return days.length > 0 ? days : undefined;
}

function normalizeTrashUtilityExtra(extra: unknown): Record<string, unknown> {
    if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return {};
    const input = extra as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};

    const hasRecycling = input.has_recycling;
    if (typeof hasRecycling === 'string') {
        const next = hasRecycling.trim().toLowerCase();
        if (next === 'yes' || next === 'no' || next === 'not_sure') {
            normalized.has_recycling = next;
        }
    } else if (hasRecycling === null) {
        normalized.has_recycling = null;
    }

    const trashPickupDays = normalizeTrashPickupDays(input.trash_pickup_days);
    if (trashPickupDays !== undefined) {
        normalized.trash_pickup_days = trashPickupDays;
        normalized.trash_pickup_day = trashPickupDays[0] ?? null;
    } else {
        const trashPickupDay = normalizeTrashPickupDay(input.trash_pickup_day);
        if (trashPickupDay !== undefined) {
            normalized.trash_pickup_day = trashPickupDay;
        }
    }

    const recyclingPickupDay = normalizeTrashPickupDay(input.recycling_pickup_day);
    if (recyclingPickupDay !== undefined) {
        normalized.recycling_pickup_day = recyclingPickupDay;
    }

    if (normalized.has_recycling === 'no') {
        normalized.recycling_pickup_day = null;
    }

    return normalized;
}

type HistoricalContactMatch = {
    phone: string | null;
    url: string | null;
    occurrences: number;
};

function normalizeProviderNameForLookup(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
}

function hasAnyContact(phone: string | null | undefined, url: string | null | undefined): boolean {
    return Boolean((phone && phone.trim()) || (url && url.trim()));
}

function shouldTrustSubmittedContact(entryMode: string | null | undefined): boolean {
    return entryMode === 'free_text';
}

function normalizeUnknownRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
}

function mergeAdvancedPacketDataPreservingExcluded({
    existingData,
    submittedVisibleData,
    enabledModules,
    exclusions,
}: {
    existingData: Record<string, unknown>;
    submittedVisibleData: Record<string, unknown>;
    enabledModules: AdvancedModuleKey[];
    exclusions: AdvancedModuleExclusions;
}): Record<string, unknown> {
    const merged: Record<string, unknown> = {};

    for (const moduleKey of enabledModules) {
        const existingSection = normalizeUnknownRecord(existingData[moduleKey]);
        const submittedSection = normalizeUnknownRecord(submittedVisibleData[moduleKey]);
        const visibleKeys = new Set(getAdvancedModuleVisibleFieldKeys(moduleKey, exclusions));

        const nextSection: Record<string, unknown> = {};

        for (const [fieldKey, fieldValue] of Object.entries(submittedSection)) {
            if (visibleKeys.has(fieldKey)) {
                nextSection[fieldKey] = fieldValue;
            }
        }

        for (const [fieldKey, fieldValue] of Object.entries(existingSection)) {
            if (!visibleKeys.has(fieldKey)) {
                nextSection[fieldKey] = fieldValue;
            }
        }

        if (Object.keys(nextSection).length > 0) {
            merged[moduleKey] = nextSection;
        }
    }

    return merged;
}

async function findHistoricalContactMatch({
    requestId,
    accountId,
    organizationId,
    category,
    providerName,
}: {
    requestId: string;
    accountId: string;
    organizationId: string | null;
    category: UtilityCategory;
    providerName: string;
}): Promise<HistoricalContactMatch | null> {
    if (!sql) return null;

    const normalizedProviderName = normalizeProviderNameForLookup(providerName);
    if (!normalizedProviderName) return null;

    const result = await sql`
        SELECT
            NULLIF(TRIM(COALESCE(ue.contact_phone, '')), '') AS contact_phone,
            NULLIF(TRIM(COALESCE(ue.contact_url, '')), '') AS contact_url,
            COUNT(*) AS usage_count
        FROM utility_entries ue
        INNER JOIN requests r ON r.id = ue.request_id
        WHERE ue.request_id <> ${requestId}
        AND ue.category = ${category}
        AND LOWER(REGEXP_REPLACE(TRIM(COALESCE(ue.display_name, ue.raw_text, '')), '[[:space:]]+', ' ', 'g')) = ${normalizedProviderName}
        AND (
            NULLIF(TRIM(COALESCE(ue.contact_phone, '')), '') IS NOT NULL
            OR NULLIF(TRIM(COALESCE(ue.contact_url, '')), '') IS NOT NULL
        )
        AND r.account_id = ${accountId}
        AND r.organization_id IS NOT DISTINCT FROM ${organizationId}
        GROUP BY 1, 2
        ORDER BY COUNT(*) DESC
        LIMIT 1
    `;

    const row = (result as Array<{
        contact_phone: string | null;
        contact_url: string | null;
        usage_count: string | number;
    }>)[0];
    if (!row) return null;

    const occurrences = Number(row.usage_count || 0);
    // Require at least two historical matches before auto-filling.
    if (occurrences < 2) return null;

    return {
        phone: row.contact_phone,
        url: row.contact_url,
        occurrences,
    };
}

// GET /api/seller/[token] - Get request data for seller form
export async function GET(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        const requestData =
            (await getRequestBySellerToken(token)) ||
            (await getRequestByToken(token));

        if (!requestData) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }
        const requestRecord = requestData as SellerRequestRecord;

        // Enforce seller-token access when available (prevents packet token from granting write-side access)
        if (requestData.seller_token && requestData.seller_token !== requestData.public_token) {
            if (token !== requestData.seller_token) {
                return NextResponse.json({ error: 'Request not found' }, { status: 404 });
            }
        }

        // Log seller opened + transition status to in_progress on first open
        const ipAddress = getClientIpOrNull(request);
        const userAgent = request.headers.get('user-agent') || null;

        await createEventLog({
            requestId: requestData.id,
            eventType: 'seller_opened',
            eventData: { actor: 'seller' },
            ipAddress,
            userAgent,
        });

        if (sql) {
            await sql`
                UPDATE requests
                SET
                    status = 'in_progress',
                    last_activity_at = NOW()
                WHERE id = ${requestData.id}
                AND status IN ('sent', 'draft')
            `;
        }

        // Get associated brand profile if exists
        let brandProfile = null;
        if (requestData.brand_profile_id && sql) {
            const result = await sql`
                SELECT * FROM brand_profiles WHERE id = ${requestData.brand_profile_id}
            `;
            brandProfile = result[0] || null;
        }

        // Fallback to default brand if none assigned to request
        if (!brandProfile) {
            brandProfile = await getDefaultBrandProfile(requestData.account_id, requestData.organization_id ?? undefined);
        }

        const publicBrandProfile = brandProfile ? {
            name: brandProfile.name,
            logo_url: brandProfile.logo_url,
            primary_color: brandProfile.primary_color,
            contact_email: brandProfile.contact_email,
            contact_phone: brandProfile.contact_phone,
            contact_website: brandProfile.contact_website,
        } : null;
        const account = await getAccountById(requestData.account_id);
        const notificationPrefs = (account?.notification_preferences || {}) as {
            collect_electric_meter_number?: boolean;
        };
        const collectElectricMeterNumber = notificationPrefs.collect_electric_meter_number !== false;

        // Get AI suggestions for each category
        const utilityCategories =
            requestRecord.utility_categories ||
            UTILITY_CATEGORY_KEYS;
        const configuredAdvancedModules = requestRecord.packet_mode === 'advanced'
            ? normalizeAdvancedModules(requestRecord.advanced_modules || [])
            : [];
        const configuredAdvancedModuleExclusions = requestRecord.packet_mode === 'advanced'
            ? normalizeAdvancedModuleExclusions(
                requestRecord.advanced_module_exclusions || {},
                configuredAdvancedModules
            )
            : {};
        const filteredAdvancedPacketData = requestRecord.packet_mode === 'advanced'
            ? filterAdvancedPacketDataByExclusions(
                requestRecord.advanced_packet_data || {},
                configuredAdvancedModules,
                configuredAdvancedModuleExclusions
            )
            : {};

        return NextResponse.json({
            request: {
                property_address: requestData.property_address,
                utility_categories: utilityCategories,
                collect_electric_meter_number: collectElectricMeterNumber,
                status: requestData.status,
                packet_mode: requestRecord.packet_mode || 'simple',
                advanced_modules: configuredAdvancedModules,
                advanced_module_exclusions: configuredAdvancedModuleExclusions,
                advanced_packet_data: filteredAdvancedPacketData,
            },
            brandProfile: publicBrandProfile,
            suggestions: {},
        });
    } catch (error) {
        console.error('Error fetching seller data:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}

// POST /api/seller/[token] - Submit seller form
export async function POST(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;

        // Rate limit by token to prevent submission spam
        const rateLimitResult = await checkRateLimit(formSubmissionRatelimit, token, { requirePersistent: process.env.NODE_ENV === 'production' });
        if (isRateLimitUnavailable(rateLimitResult)) {
            return NextResponse.json(
                { error: 'Temporarily unavailable. Please try again shortly.' },
                { status: 503 }
            );
        }

        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Too many submissions. Please wait a moment before trying again.' },
                {
                    status: 429,
                    headers: getRateLimitHeaders(rateLimitResult),
                }
            );
        }

        const body = await request.json();
        const parsedBody = sellerSubmissionBodySchema.safeParse(body);
        if (!parsedBody.success) {
            return invalidRequestBodyResponse('INVALID_SELLER_SUBMISSION', 'Invalid submission');
        }

        const requestData =
            (await getRequestBySellerToken(token)) ||
            (await getRequestByToken(token));

        if (!requestData) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }
        const requestRecord = requestData as SellerRequestRecord;

        // Enforce seller-token access when available (prevents packet token from granting write-side access)
        if (requestData.seller_token && requestData.seller_token !== requestData.public_token) {
            if (token !== requestData.seller_token) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        if (!sql) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
        }

        const ipAddress = getClientIpOrNull(request);
        const userAgent = request.headers.get('user-agent') || null;

        const account = await getAccountById(requestData.account_id);
        const organization = requestData.organization_id ? await getOrganizationById(requestData.organization_id) : null;
        const isUtilitySheetDemoSubmission =
            organization?.slug === DEMO_WORKSPACE_SLUG &&
            DEMO_ADDRESS_PATTERN.test(requestData.property_address);
        const isPaid = account?.subscription_status === 'pro' || organization?.subscription_status === 'team';
        const notificationPrefs = (account?.notification_preferences || {}) as {
            seller_submissions?: boolean;
            seller_submission_pdf_attachment?: boolean;
            contact_resolution?: boolean;
            weekly_summary?: boolean;
            collect_electric_meter_number?: boolean;
        };
        const collectElectricMeterNumber = notificationPrefs.collect_electric_meter_number !== false;

        // Only apply free-plan overage locking for requests that have not yet been metered.
        // (Agent-created requests are metered on creation and quota-checked on creation.)
        const isUnmetered = requestRecord.metered_at == null;
        let shouldLock = false;
        if (!isPaid && isUnmetered) {
            const usage = await getMonthlyUsage(requestData.account_id, requestData.organization_id ?? undefined);
            if (usage.plan === 'free' && usage.used >= usage.limit) {
                shouldLock = true;
            }
        }

        const accessLocked = (Boolean(requestRecord.is_locked) || shouldLock) && !isPaid;

        const requestedCategories = new Set<string>(
            requestRecord.utility_categories || UTILITY_CATEGORY_KEYS
        );
        const packetMode = requestRecord.packet_mode === 'advanced' ? 'advanced' : 'simple';
        const configuredAdvancedModules = packetMode === 'advanced'
            ? normalizeAdvancedModules(requestRecord.advanced_modules || [])
            : [];
        const configuredAdvancedModuleExclusions = packetMode === 'advanced'
            ? normalizeAdvancedModuleExclusions(
                requestRecord.advanced_module_exclusions || {},
                configuredAdvancedModules
            )
            : {};
        const submittedVisibleAdvancedData = packetMode === 'advanced'
            ? filterAdvancedPacketDataByExclusions(
                parsedBody.data.advanced || {},
                configuredAdvancedModules,
                configuredAdvancedModuleExclusions
            )
            : {};
        const advancedPacketData = packetMode === 'advanced'
            ? mergeAdvancedPacketDataPreservingExcluded({
                existingData: normalizeUnknownRecord(requestRecord.advanced_packet_data || {}),
                submittedVisibleData: submittedVisibleAdvancedData,
                enabledModules: configuredAdvancedModules,
                exclusions: configuredAdvancedModuleExclusions,
            })
            : {};

        // Update request with applicability info
        await sql`
            UPDATE requests SET
            water_source = ${parsedBody.data.water_source || null},
            sewer_type = ${parsedBody.data.sewer_type || null},
            heating_type = ${parsedBody.data.primary_heating_type || null},
            advanced_packet_data = ${JSON.stringify(advancedPacketData)}::jsonb,
            status = 'submitted',
            last_activity_at = NOW(),
            metered_at = COALESCE(metered_at, NOW()),
            is_locked = CASE WHEN ${shouldLock} THEN TRUE ELSE is_locked END,
            locked_reason = CASE WHEN ${shouldLock} THEN 'monthly_limit' ELSE locked_reason END,
            locked_at = CASE WHEN ${shouldLock} THEN COALESCE(locked_at, NOW()) ELSE locked_at END
            WHERE id = ${requestData.id}
        `;

        // Delete existing entries and insert new ones
        await sql`DELETE FROM utility_entries WHERE request_id = ${requestData.id}`;

        // Track entries that may need contact resolution
        const contactResolutionTargets: ContactResolutionTarget[] = [];

        // Insert utility entries
        for (const [category, entry] of Object.entries(parsedBody.data.utilities || {})) {
            if (!requestedCategories.has(category)) {
                continue;
            }
            const typedCategory = category as UtilityCategory;

            const e = entry as SellerUtilityEntryInput;
            // Persist entry if not hidden - use 'unknown' if entry_mode is null
            if (!e.hidden) {
                const finalEntryMode = e.entry_mode || 'unknown';
                const finalRawText = e.raw_text || '';
                const meterNumberCandidate =
                    category === 'electric' && collectElectricMeterNumber
                        ? (typeof e.meter_number === 'string' ? e.meter_number.trim() : '')
                        : '';
                const finalMeterNumber = meterNumberCandidate || null;
                const baseExtra = (e.extra && typeof e.extra === 'object' && !Array.isArray(e.extra))
                    ? (e.extra as Record<string, unknown>)
                    : {};
                const finalExtra = typedCategory === 'trash'
                    ? normalizeTrashUtilityExtra(baseExtra)
                    : baseExtra;
                const trustSubmittedContact = shouldTrustSubmittedContact(finalEntryMode);
                const demoContact = isUtilitySheetDemoSubmission
                    ? DEMO_PROVIDER_CONTACTS[String(e.display_name || e.raw_text || '').trim().toLowerCase()]
                    : undefined;
                const submittedPhone = demoContact?.phone || (trustSubmittedContact
                    ? (e.contact_phone || null)
                    : null);
                const submittedUrl = demoContact?.url || (trustSubmittedContact
                    ? (e.contact_url || null)
                    : null);

                const finalCanonicalId = typeof e.canonical_id === 'string' && e.canonical_id.trim()
                    ? e.canonical_id.trim()
                    : null;
                const finalConfidenceScore = typeof e.confidence_score === 'number' && Number.isFinite(e.confidence_score)
                    ? Math.max(0, Math.min(1, e.confidence_score))
                    : null;

                await sql`
                    INSERT INTO utility_entries (
                        request_id,
                        category,
                        entry_mode,
                        display_name,
                        raw_text,
                        canonical_id,
                        confidence_score,
                        contact_phone,
                        contact_url,
                        meter_number,
                        extra
                    ) VALUES (
                        ${requestData.id},
                        ${typedCategory},
                        ${finalEntryMode},
                        ${e.display_name || null},
                        ${finalRawText || null},
                        ${finalCanonicalId},
                        ${finalConfidenceScore},
                        ${submittedPhone},
                        ${submittedUrl},
                        ${finalMeterNumber},
                        ${JSON.stringify(finalExtra)}::jsonb
                    )
                `;

                if (finalEntryMode === 'suggested_confirmed' || finalEntryMode === 'search_selected') {
                    await markAiSuggestionSelection({
                        requestId: requestData.id,
                        category: typedCategory,
                        selectedName: e.display_name || finalRawText || null,
                        finalEntryMode,
                        canonicalId: finalCanonicalId,
                        confidenceScore: finalConfidenceScore,
                    });
                }

                const providerName = String(e.display_name || e.raw_text || '').trim();
                const hadSubmittedContact = trustSubmittedContact && hasAnyContact(e.contact_phone, e.contact_url);
                if (providerName && finalEntryMode !== 'unknown') {
                    contactResolutionTargets.push({
                        category: typedCategory,
                        providerName,
                        hadSubmittedContact,
                    });
                }
            }
        }

        // Attempt contact resolution for missing contact info
        const unresolvedEntries: { category: string; displayName?: string }[] = [];
        const seenContactTargets = new Set<string>();

        if (!accessLocked && !isUtilitySheetDemoSubmission) {
            for (const target of contactResolutionTargets) {
                const normalizedProviderName = normalizeProviderNameForLookup(target.providerName);
                if (!normalizedProviderName) continue;

                const dedupeKey = `${target.category}:${normalizedProviderName}`;
                if (seenContactTargets.has(dedupeKey)) continue;
                seenContactTargets.add(dedupeKey);

                const historicalMatch = await findHistoricalContactMatch({
                    requestId: requestData.id,
                    accountId: requestData.account_id,
                    organizationId: requestData.organization_id ?? null,
                    category: target.category,
                    providerName: target.providerName,
                });

                if (historicalMatch && hasAnyContact(historicalMatch.phone, historicalMatch.url)) {
                    await sql`
                        UPDATE utility_entries
                        SET
                            contact_phone = COALESCE(${historicalMatch.phone}, contact_phone),
                            contact_url = COALESCE(${historicalMatch.url}, contact_url)
                        WHERE request_id = ${requestData.id}
                        AND category = ${target.category}
                        AND LOWER(REGEXP_REPLACE(TRIM(COALESCE(display_name, raw_text, '')), '[[:space:]]+', ' ', 'g')) = ${normalizedProviderName}
                    `;
                    continue;
                }

                // Preserve any contact the submitter explicitly provided.
                if (target.hadSubmittedContact) {
                    continue;
                }

                const contact = await resolveContact(target.providerName, {
                    category: target.category,
                    address: requestData.property_address,
                });
                if (hasValidContact(contact)) {
                    const resolvedPhone = contact?.customer_service_phone || null;
                    const resolvedUrl = contact?.start_stop_service_url || contact?.main_website || null;

                    await sql`
                        UPDATE utility_entries
                        SET
                            contact_phone = COALESCE(contact_phone, ${resolvedPhone}),
                            contact_url = COALESCE(contact_url, ${resolvedUrl})
                        WHERE request_id = ${requestData.id}
                        AND category = ${target.category}
                        AND LOWER(REGEXP_REPLACE(TRIM(COALESCE(display_name, raw_text, '')), '[[:space:]]+', ' ', 'g')) = ${normalizedProviderName}
                    `;
                } else {
                    unresolvedEntries.push({
                        category: target.category,
                        displayName: target.providerName,
                    });
                }
            }
        }

        // Log event
        await createEventLog({
            requestId: requestData.id,
            eventType: 'seller_submitted',
            eventData: buildSellerSubmittedEventSummary({
                ...parsedBody.data,
                packet_mode: packetMode,
                advanced_modules: configuredAdvancedModules,
                advanced_module_exclusions: configuredAdvancedModuleExclusions,
            }),
            ipAddress,
            userAgent,
        });

        if (account?.email) {
            // Send TC completion notification (if enabled, defaults to true)
            if (notificationPrefs.seller_submissions !== false) {
                const shouldAttachPdf = !accessLocked && notificationPrefs.seller_submission_pdf_attachment !== false;
                try {
                    await sendTCCompletionNotificationEmail({
                        tcEmail: account.email,
                        tcName: account.full_name || undefined,
                        propertyAddress: accessLocked ? 'Locked — upgrade to view' : requestData.property_address,
                        sellerName: accessLocked ? undefined : requestData.seller_name || undefined,
                        requestId: requestData.id,
                        attachPdf: shouldAttachPdf,
                    });
                } catch (emailError) {
                    console.error('Failed to send TC completion notification email:', emailError);
                }
            }

            // Send contact resolution alert (if enabled and there are unresolved entries)
            if (!accessLocked && notificationPrefs.contact_resolution !== false && unresolvedEntries.length > 0) {
                try {
                    await sendContactResolutionAlertEmail({
                        tcEmail: account.email,
                        tcName: account.full_name || undefined,
                        propertyAddress: requestData.property_address,
                        unresolvedEntries,
                        requestId: requestData.id,
                    });
                } catch (alertError) {
                    console.error('Failed to send contact resolution alert:', alertError);
                }
            }
        } else {
            console.warn('TC notification skipped: no account email found');
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error submitting seller form:', error);
        return NextResponse.json({ error: 'Failed to submit form' }, { status: 500 });
    }
}


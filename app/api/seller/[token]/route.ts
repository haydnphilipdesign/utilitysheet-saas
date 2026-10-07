import { NextResponse } from 'next/server';
import { getRequestBySellerToken, getRequestByToken, getBrandProfile, getDefaultBrandProfile, getAccountById, getOrganizationById, getOrganizationAdminRecipients, getOrganizationMemberRole, getReferralIdentityForm, getUtilityEntriesByRequestId, createEventLog } from '@/lib/neon/queries';
import { submitSellerRequest, type SellerSubmissionEntryRow } from '@/lib/neon/queries/seller-submission';
import { buildSellerPrefill } from '@/lib/seller-form/prefill';
import { NOTIFY_ADMINS_ON_SUBMISSION, buildSubmissionCandidates, buildSubmissionRecipients, normalizeWorkspaceNotificationSettings } from '@/lib/notifications/workspace-routing';
import type { SubmissionRecipientCandidate } from '@/lib/notifications/workspace-routing';
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
import { scheduleReferralCreditAward } from '@/lib/referrals/award-referral-credit';
import { errorNameOf, recordOperationalEvent, recordOperationalSuccess } from '@/lib/ops/events';
import {
    filterAdvancedPacketDataByExclusions,
    getAdvancedModuleVisibleFieldKeys,
    normalizeAdvancedModuleExclusions,
    normalizeConditionalAdvancedAnswers,
    normalizeAdvancedModules,
} from '@/lib/packet/modules';
import { normalizeHoaAnswers, resolveHoaSubmission } from '@/lib/packet/hoa';
import { resolveRequestQuestionSettings } from '@/lib/requests/question-settings';
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
    seller_edit_version?: number | null;
};

function readEditVersion(record: SellerRequestRecord): number {
    const version = Number(record.seller_edit_version ?? 0);
    return Number.isInteger(version) && version > 0 ? version : 0;
}

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
        AND r.deleted_at IS NULL
        AND COALESCE(r.is_demo, FALSE) = FALSE
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
        const editVersion = readEditVersion(requestRecord);

        // A submitted request is read-only for this link until a coordinator
        // reopens it, so nothing beyond what the notice needs is returned.
        // Test-drive requests keep their own idempotent flow.
        if (requestData.status === 'submitted' && requestRecord.is_demo !== true) {
            return NextResponse.json({
                request: {
                    property_address: requestData.property_address,
                    status: 'submitted',
                    edit_version: editVersion,
                    is_demo: false,
                },
                brandProfile: publicBrandProfile,
                suggestions: {},
            });
        }

        const account = await getAccountById(requestData.account_id);
        const notificationPrefs = (account?.notification_preferences || {}) as {
            collect_electric_meter_number?: boolean;
        };
        const { collectElectricMeterNumber, collectHoaQuestions } = resolveRequestQuestionSettings(requestRecord, notificationPrefs);

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

        // After a reopen the seller starts from the sheet as it is stored now,
        // including coordinator corrections.
        const prefill = editVersion > 0
            ? buildSellerPrefill(requestRecord, await getUtilityEntriesByRequestId(requestData.id), {
                requestedCategories: utilityCategories,
                collectElectricMeterNumber,
            })
            : undefined;

        return NextResponse.json({
            request: {
                seller_intro: requestData.seller_intro || null,
                property_address: requestData.property_address,
                utility_categories: utilityCategories,
                collect_electric_meter_number: collectElectricMeterNumber,
                collect_hoa_questions: collectHoaQuestions,
                status: requestData.status,
                edit_version: editVersion,
                prefill,
                packet_mode: requestRecord.packet_mode || 'simple',
                advanced_modules: configuredAdvancedModules,
                advanced_module_exclusions: configuredAdvancedModuleExclusions,
                advanced_packet_data: filteredAdvancedPacketData,
                // Prefills the seller's earlier HOA answers so a resubmission
                // does not wipe the association details they already typed.
                hoa: normalizeHoaAnswers(requestRecord),
                is_demo: requestRecord.is_demo === true,
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

        if (requestRecord.is_demo === true && requestRecord.status === 'submitted') {
            return NextResponse.json({ success: true, alreadySubmitted: true });
        }

        if (!sql) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
        }

        const ipAddress = getClientIpOrNull(request);
        const userAgent = request.headers.get('user-agent') || null;

        const account = await getAccountById(requestData.account_id);
        const organization = requestData.organization_id ? await getOrganizationById(requestData.organization_id) : null;
        const isTestDriveSubmission = requestRecord.is_demo === true;
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
        const { collectElectricMeterNumber, collectHoaQuestions } = resolveRequestQuestionSettings(requestRecord, notificationPrefs);

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
        // Normalized before the merge below, so stored excluded fields survive.
        const submittedVisibleAdvancedData = packetMode === 'advanced'
            ? normalizeConditionalAdvancedAnswers(
                filterAdvancedPacketDataByExclusions(
                    parsedBody.data.advanced || {},
                    configuredAdvancedModules,
                    configuredAdvancedModuleExclusions
                ),
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

        // Leave the stored HOA answers alone when this request has the questions
        // turned off, or when a seller form loaded before they shipped sends
        // no `has_hoa` key.
        const { update: updateHoa, answers: hoa } = resolveHoaSubmission(
            parsedBody.data,
            collectHoaQuestions
        );

        // Build every provider row first; nothing is written until the single
        // statement below.
        const entryRows: SellerSubmissionEntryRow[] = [];
        const contactResolutionTargets: ContactResolutionTarget[] = [];
        const suggestionSelections: Parameters<typeof markAiSuggestionSelection>[0][] = [];

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

                entryRows.push({
                    category: typedCategory,
                    entry_mode: finalEntryMode,
                    display_name: e.display_name || null,
                    raw_text: finalRawText || null,
                    canonical_id: finalCanonicalId,
                    confidence_score: finalConfidenceScore,
                    contact_phone: submittedPhone,
                    contact_url: submittedUrl,
                    meter_number: finalMeterNumber,
                    extra: finalExtra,
                });

                if (!isTestDriveSubmission && (finalEntryMode === 'suggested_confirmed' || finalEntryMode === 'search_selected')) {
                    suggestionSelections.push({
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

        const editVersion = parsedBody.data.edit_version ?? 0;

        // The request, its provider rows and the event are stored together or
        // not at all, and only for the current editing session of a request
        // that is not already submitted. A failure here stores nothing, so the
        // seller can retry. The same write meters a first submission and decides
        // the Free monthly limit, so simultaneous submissions cannot both pass.
        const persisted = await submitSellerRequest({
            requestId: requestData.id,
            editVersion,
            submissionKey: parsedBody.data.submission_key ?? null,
            waterSource: parsedBody.data.water_source || null,
            sewerType: parsedBody.data.sewer_type || null,
            heatingType: parsedBody.data.primary_heating_type || null,
            updateHoa,
            hoa,
            advancedPacketData,
            entries: entryRows,
            isTestDrive: isTestDriveSubmission,
            eventData: {
                ...buildSellerSubmittedEventSummary({
                    ...parsedBody.data,
                    // Only an answer that was actually asked and stored is counted.
                    has_hoa: updateHoa ? hoa.has_hoa : null,
                    packet_mode: packetMode,
                    advanced_modules: configuredAdvancedModules,
                    advanced_module_exclusions: configuredAdvancedModuleExclusions,
                }),
                edit_version: editVersion,
            },
            ipAddress,
            userAgent,
        });

        if (persisted.outcome === 'NOT_FOUND') {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }
        if (persisted.outcome === 'DUPLICATE') {
            // A retry of a submission that was stored but whose response was lost.
            return NextResponse.json({ success: true, alreadySubmitted: true });
        }
        if (persisted.outcome === 'ALREADY_SUBMITTED') {
            return NextResponse.json(
                { error: 'This form has already been submitted.', code: 'ALREADY_SUBMITTED' },
                { status: 409 }
            );
        }
        if (persisted.outcome === 'STALE_SESSION') {
            return NextResponse.json(
                { error: 'This form was updated after this page was opened. Reload to continue.', code: 'STALE_SESSION' },
                { status: 409 }
            );
        }

        // Everything below runs only for the accepted submission and can no
        // longer affect what was stored or the seller's response.
        const accessLocked = Boolean((persisted.request as SellerRequestRecord | null)?.is_locked) && !isPaid;

        for (const selection of suggestionSelections) {
            await markAiSuggestionSelection(selection).catch((selectionError) => {
                console.error('Failed to record suggestion selection:', selectionError);
            });
        }

        // Attempt contact resolution for missing contact info
        const unresolvedEntries: { category: string; displayName?: string }[] = [];
        const seenContactTargets = new Set<string>();

        if (!accessLocked && !isUtilitySheetDemoSubmission && !isTestDriveSubmission) {
            for (const target of contactResolutionTargets) {
                const normalizedProviderName = normalizeProviderNameForLookup(target.providerName);
                if (!normalizedProviderName) continue;

                const dedupeKey = `${target.category}:${normalizedProviderName}`;
                if (seenContactTargets.has(dedupeKey)) continue;
                seenContactTargets.add(dedupeKey);

                // On a resubmission after a reopen the contact came from the
                // stored sheet, possibly corrected by the coordinator. Keep it.
                if (editVersion > 0 && target.hadSubmittedContact) continue;

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

        if (!isTestDriveSubmission) {
            scheduleReferralCreditAward(requestData.account_id);
        }

        // Assemble submission-notification recipients. The request owner comes
        // first while they still belong to the request's workspace; when the
        // workspace enables admin routing, or the owner has left it, the
        // organization's current admins are added. Membership is read live, so
        // nobody who was removed is notified. Personal-preference and dedup
        // handling lives in buildSubmissionRecipients.
        let ownerIsMember = true;
        if (!isTestDriveSubmission && organization?.id) {
            try {
                ownerIsMember = Boolean(await getOrganizationMemberRole(organization.id, requestData.account_id));
            } catch (membershipError) {
                // Unknown membership: the workspace's sheet is not sent to someone who may have left.
                console.error('Failed to confirm request owner membership:', membershipError);
                ownerIsMember = false;
            }
        }

        let recipientCandidates: SubmissionRecipientCandidate[] = [];
        if (!isTestDriveSubmission) {
            const notifyAdmins = organization?.id
                ? normalizeWorkspaceNotificationSettings(organization.notification_settings)[NOTIFY_ADMINS_ON_SUBMISSION]
                : false;
            const admins = organization?.id && (notifyAdmins || !ownerIsMember)
                ? await getOrganizationAdminRecipients(organization.id).catch(() => [])
                : [];
            recipientCandidates = buildSubmissionCandidates({
                owner: { email: account?.email, name: account?.full_name, prefs: notificationPrefs },
                ownerIsMember,
                notifyAdmins,
                admins: admins.map((admin) => ({
                    email: admin.email,
                    name: admin.full_name,
                    prefs: admin.notification_preferences,
                })),
            });
        }

        const submissionRecipients = isTestDriveSubmission
            ? (account?.email
                ? [{ email: account.email, name: account.full_name || undefined, attachPdf: true }]
                : [])
            : buildSubmissionRecipients(recipientCandidates, { accessLocked });

        if (submissionRecipients.length > 0) {
            try {
                // Mirrors the packet page's rule: free-plan workspaces carry the
                // UtilitySheet referral footer, and paid workspaces carry it only
                // when their brand profile voluntarily keeps powered-by branding.
                let showReferralFooter = !isTestDriveSubmission && !isPaid;
                if (!isTestDriveSubmission && !showReferralFooter) {
                    const requestBrandProfile = requestData.brand_profile_id
                        ? await getBrandProfile(requestData.brand_profile_id).catch(() => null)
                        : null;
                    const resolvedBrandProfile = requestBrandProfile
                        || await getDefaultBrandProfile(requestData.account_id, requestData.organization_id ?? undefined).catch(() => null);
                    showReferralFooter = Boolean(resolvedBrandProfile?.show_powered_by);
                }
                const intakeLink = showReferralFooter && !isTestDriveSubmission
                    ? await getReferralIdentityForm(requestData.account_id).catch(() => null)
                    : null;

                // Per-recipient sends are independent: one failure must not block
                // the others, and none can block the seller submission response.
                const deliveryResults = await Promise.allSettled(
                    submissionRecipients.map((recipient) =>
                        sendTCCompletionNotificationEmail({
                            tcEmail: recipient.email,
                            tcName: recipient.name,
                            propertyAddress: accessLocked ? 'Locked — upgrade to view' : requestData.property_address,
                            sellerName: accessLocked ? undefined : requestData.seller_name || undefined,
                            requestId: requestData.id,
                            attachPdf: recipient.attachPdf,
                            showReferralFooter,
                            referralCode: intakeLink?.slug || null,
                            isTestDrive: isTestDriveSubmission,
                        })
                    )
                );

                // Best-effort observation of the completion email; it cannot affect the seller response.
                const failedDeliveries = deliveryResults.filter(
                    (result) => result.status === 'rejected' || !result.value.success
                ).length;
                if (failedDeliveries > 0) {
                    await recordOperationalEvent({
                        category: 'email',
                        code: 'completion_send_failed',
                        outcome: 'failure',
                        requestId: requestData.id,
                        metadata: { recipientCount: deliveryResults.length, failedCount: failedDeliveries },
                    });
                } else {
                    await recordOperationalSuccess({ category: 'email', code: 'completion_send_failed' });
                }

                if (isTestDriveSubmission) {
                    const firstResult = deliveryResults[0];
                    const deliverySucceeded = firstResult?.status === 'fulfilled'
                        && firstResult.value.success
                        && firstResult.value.attachmentStatus === 'attached';
                    await createEventLog({
                        requestId: requestData.id,
                        eventType: deliverySucceeded
                            ? 'test_drive_delivery_succeeded'
                            : 'test_drive_delivery_failed',
                        eventData: {
                            email_sent: firstResult?.status === 'fulfilled' && firstResult.value.success,
                            pdf_attached: firstResult?.status === 'fulfilled'
                                && firstResult.value.attachmentStatus === 'attached',
                            recipient: 'initiating_account_email',
                        },
                    }).catch((eventError) => {
                        console.error('Failed to record test-drive delivery outcome:', eventError);
                    });
                }
            } catch (emailError) {
                await recordOperationalEvent({
                    category: 'email',
                    code: 'completion_send_failed',
                    outcome: 'failure',
                    requestId: requestData.id,
                    metadata: { reasonCode: 'route_exception', errorName: errorNameOf(emailError) },
                });
                console.error('Failed to send TC completion notification email:', emailError);
                if (isTestDriveSubmission) {
                    await createEventLog({
                        requestId: requestData.id,
                        eventType: 'test_drive_delivery_failed',
                        eventData: {
                            email_sent: false,
                            pdf_attached: false,
                            recipient: 'initiating_account_email',
                        },
                    }).catch(() => undefined);
                }
            }
        } else {
            console.warn('TC notification skipped: no eligible recipients');
            if (isTestDriveSubmission) {
                await createEventLog({
                    requestId: requestData.id,
                    eventType: 'test_drive_delivery_failed',
                    eventData: {
                        email_sent: false,
                        pdf_attached: false,
                        recipient: 'initiating_account_email',
                    },
                }).catch(() => undefined);
            }
        }

        // Contact resolution alerts remain owner-only (they concern the owner's
        // provider-memory workflow), and stop once the owner has left the workspace.
        if (!isTestDriveSubmission && ownerIsMember && account?.email && !accessLocked && notificationPrefs.contact_resolution !== false && unresolvedEntries.length > 0) {
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

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error submitting seller form:', error);
        return NextResponse.json({ error: 'Failed to submit form' }, { status: 500 });
    }
}

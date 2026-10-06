import { FREE_MONTHLY_SUBMISSION_LIMIT } from '@/lib/constants';
import { getStatementExecutor, type SqlRow, type SqlStatement, type StatementExecutor } from '@/lib/neon/statements';
import type { HoaAnswers, Request } from '@/types';

/*
 * Seller submission and coordinator reopen.
 *
 * A submitted request is read-only for the seller link until a coordinator
 * reopens it. Each reopen (and each close-without-changes) starts a new editing
 * session, `requests.seller_edit_version`. A submission is accepted only for the
 * current session, so a tab or draft from an earlier one cannot overwrite the
 * sheet. See .ai/decisions/2026-10-06-read-only-after-submission-and-reopen.md.
 *
 * Every write here is one statement: the row is locked first, the decision is
 * made on the locked row, and the request, its provider rows and the event are
 * stored together or not at all. Nothing here ever writes the property address,
 * owner, workspace, tokens or question configuration.
 *
 * A submission also decides the Free monthly limit, which depends on the
 * owner's other requests. It therefore runs behind a per-owner advisory lock
 * taken as a separate first statement of the same transaction, the way the
 * reminder claim does. See .ai/decisions/2026-09-15-submission-based-free-metering.md.
 */

type Executable = { executor?: StatementExecutor };

const executor = (input: Executable) => input.executor ?? getStatementExecutor();

export interface SellerSubmissionEntryRow {
    category: string;
    entry_mode: string;
    display_name: string | null;
    raw_text: string | null;
    canonical_id: string | null;
    confidence_score: number | null;
    contact_phone: string | null;
    contact_url: string | null;
    meter_number: string | null;
    extra: Record<string, unknown>;
}

export type SellerSubmissionOutcome =
    | 'ACCEPTED'
    /** The same submission was already stored in this session; nothing is written again. */
    | 'DUPLICATE'
    | 'ALREADY_SUBMITTED'
    /** The request was reopened or closed since this form was loaded. */
    | 'STALE_SESSION'
    | 'NOT_FOUND';

export interface SubmitSellerRequestInput extends Executable {
    requestId: string;
    /** The editing session the seller form was loaded in. */
    editVersion: number;
    /** Random per-attempt key from the seller form; null for clients that send none. */
    submissionKey: string | null;
    waterSource: string | null;
    sewerType: string | null;
    heatingType: string | null;
    /** False leaves the stored HOA answers untouched. */
    updateHoa: boolean;
    hoa: HoaAnswers;
    advancedPacketData: Record<string, unknown>;
    entries: SellerSubmissionEntryRow[];
    /** Test-drive submissions are never metered. */
    isTestDrive: boolean;
    eventData: Record<string, unknown>;
    ipAddress: string | null;
    userAgent: string | null;
}

/**
 * The two statements run as one transaction. The advisory lock serializes
 * submissions for one owner; in READ COMMITTED the statement after it starts
 * from a fresh snapshot, so it counts whatever the previous holder committed.
 * Counting inside a single statement would not do that: two submissions for
 * different requests would each count from a snapshot without the other.
 * Do not run this at a stricter isolation level.
 */
export function sellerSubmissionStatements(input: Omit<SubmitSellerRequestInput, 'executor'>): SqlStatement[] {
    const lock: SqlStatement = {
        // Keyed on the stored owner, not on anything read before this transaction.
        text: `
            SELECT pg_advisory_xact_lock(hashtextextended('utilitysheet:free-usage:' || account_id::text, 0))
            FROM requests WHERE id = $1::uuid
        `,
        params: [input.requestId],
    };
    const submission: SqlStatement = {
        text: `
            WITH target AS (
                SELECT id, account_id, organization_id, status, deleted_at, is_demo, metered_at,
                    seller_edit_version, seller_submission_key
                FROM requests WHERE id = $1::uuid FOR UPDATE
            ),
            usage AS (
                -- Same definition as getMonthlyUsage: the owner's counted, unlocked
                -- submissions this UTC calendar month, deleted or not, in every
                -- workspace except one on Team (paid work never uses the Free allowance).
                SELECT COUNT(*)::int AS used
                FROM requests u
                WHERE u.account_id = (SELECT account_id FROM target)
                  AND u.metered_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
                  AND COALESCE(u.is_demo, FALSE) = FALSE
                  AND u.is_locked = FALSE
                  AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = u.organization_id AND o.subscription_status = 'team')
            ),
            decision AS (
                SELECT t.id, t.seller_edit_version AS current_edit_version,
                    -- Only a first counted submission can be locked: never a test
                    -- drive, a resubmission after a reopen, or a paid owner or workspace.
                    (
                        NOT $19::boolean
                        AND NOT COALESCE(t.is_demo, FALSE)
                        AND t.metered_at IS NULL
                        AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = t.account_id AND a.subscription_status = 'pro')
                        AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = t.organization_id AND o.subscription_status = 'team')
                        AND (SELECT used FROM usage) >= $20::int
                    ) AS should_lock,
                    CASE
                        WHEN t.deleted_at IS NOT NULL THEN 'NOT_FOUND'
                        WHEN t.status = 'submitted'
                            AND t.seller_edit_version = $2::int
                            AND $3::text IS NOT NULL
                            AND t.seller_submission_key = $3::text THEN 'DUPLICATE'
                        WHEN t.status = 'submitted' THEN 'ALREADY_SUBMITTED'
                        WHEN t.seller_edit_version <> $2::int THEN 'STALE_SESSION'
                        ELSE 'ACCEPTED'
                    END AS outcome
                FROM target t
            ),
            updated AS (
                UPDATE requests r SET
                    water_source = $4::text,
                    sewer_type = $5::text,
                    heating_type = $6::text,
                    has_hoa = CASE WHEN $7::boolean THEN $8::text ELSE r.has_hoa END,
                    hoa_name = CASE WHEN $7::boolean THEN $9::text ELSE r.hoa_name END,
                    hoa_management_company = CASE WHEN $7::boolean THEN $10::text ELSE r.hoa_management_company END,
                    hoa_management_contact = CASE WHEN $7::boolean THEN $11::text ELSE r.hoa_management_contact END,
                    hoa_management_phone = CASE WHEN $7::boolean THEN $12::text ELSE r.hoa_management_phone END,
                    hoa_management_email = CASE WHEN $7::boolean THEN $13::text ELSE r.hoa_management_email END,
                    hoa_dues_amount = CASE WHEN $7::boolean THEN $14::text ELSE r.hoa_dues_amount END,
                    hoa_dues_frequency = CASE WHEN $7::boolean THEN $15::text ELSE r.hoa_dues_frequency END,
                    hoa_portal_or_payment = CASE WHEN $7::boolean THEN $16::text ELSE r.hoa_portal_or_payment END,
                    advanced_packet_data = $17::jsonb,
                    status = 'submitted',
                    seller_submission_key = $3::text,
                    last_activity_at = NOW(),
                    -- Set once. A resubmission after a reopen is never counted again.
                    metered_at = CASE WHEN $19::boolean OR COALESCE(r.is_demo, FALSE) THEN r.metered_at ELSE COALESCE(r.metered_at, NOW()) END,
                    -- A lock is only ever added here, never removed.
                    is_locked = CASE WHEN d.should_lock THEN TRUE ELSE r.is_locked END,
                    locked_reason = CASE WHEN d.should_lock THEN 'monthly_limit' ELSE r.locked_reason END,
                    locked_at = CASE WHEN d.should_lock THEN COALESCE(r.locked_at, NOW()) ELSE r.locked_at END
                FROM decision d
                WHERE r.id = d.id AND d.outcome = 'ACCEPTED'
                RETURNING r.*
            ),
            deleted_entries AS (
                DELETE FROM utility_entries
                WHERE request_id IN (SELECT id FROM updated)
            ),
            inserted_entries AS (
                INSERT INTO utility_entries (
                    request_id, category, entry_mode, display_name, raw_text,
                    canonical_id, confidence_score, contact_phone, contact_url, meter_number, extra
                )
                SELECT
                    u.id, e.category, e.entry_mode, e.display_name, e.raw_text,
                    e.canonical_id, e.confidence_score, e.contact_phone, e.contact_url, e.meter_number,
                    COALESCE(e.extra, '{}'::jsonb)
                FROM updated u
                CROSS JOIN LATERAL jsonb_to_recordset($18::jsonb) AS e(
                    category text, entry_mode text, display_name text, raw_text text,
                    canonical_id text, confidence_score numeric, contact_phone text, contact_url text,
                    meter_number text, extra jsonb
                )
                RETURNING id
            ),
            inserted_event AS (
                INSERT INTO event_logs (request_id, event_type, event_data, ip_address, user_agent)
                SELECT u.id, 'seller_submitted', $21::jsonb, $22::text, $23::text
                FROM updated u
                RETURNING id
            )
            SELECT d.outcome, d.current_edit_version,
                (SELECT to_jsonb(u) FROM updated u) AS request,
                (SELECT COUNT(*) FROM inserted_entries)::int AS entry_count,
                (SELECT COUNT(*) FROM inserted_event)::int AS event_count
            FROM decision d
        `,
        params: [
            input.requestId,
            input.editVersion,
            input.submissionKey,
            input.waterSource,
            input.sewerType,
            input.heatingType,
            input.updateHoa,
            input.hoa.has_hoa,
            input.hoa.hoa_name,
            input.hoa.hoa_management_company,
            input.hoa.hoa_management_contact,
            input.hoa.hoa_management_phone,
            input.hoa.hoa_management_email,
            input.hoa.hoa_dues_amount,
            input.hoa.hoa_dues_frequency,
            input.hoa.hoa_portal_or_payment,
            JSON.stringify(input.advancedPacketData || {}),
            JSON.stringify(input.entries),
            input.isTestDrive,
            FREE_MONTHLY_SUBMISSION_LIMIT,
            JSON.stringify(input.eventData || {}),
            input.ipAddress,
            input.userAgent,
        ],
    };

    return [lock, submission];
}

export async function submitSellerRequest(
    input: SubmitSellerRequestInput
): Promise<{ outcome: SellerSubmissionOutcome; request: Request | null; currentEditVersion: number | null }> {
    const results = await executor(input).transaction(sellerSubmissionStatements(input));

    return readOutcome<SellerSubmissionOutcome>(results[1] ?? []);
}

export type ReopenOutcome =
    | 'OK'
    | 'NOT_FOUND'
    /** Test-drive requests are created and finished by the coordinator alone. */
    | 'TEST_REQUEST'
    /** An over-limit sheet stays locked; reopening is not a way around the limit. */
    | 'LOCKED'
    | 'NOT_SUBMITTED'
    /** Close-without-changes only applies to a request a coordinator reopened. */
    | 'NOT_REOPENED';

interface ReopenInput extends Executable {
    requestId: string;
    actorAccountId: string;
    ipAddress: string | null;
    userAgent: string | null;
}

/**
 * Lets the seller correct a submitted sheet. Changes `status`, the editing
 * session and the retry key only. Stored answers, `metered_at`, the lock and
 * everything else stay as they are, and no email is sent.
 */
export async function reopenSubmittedRequest(
    input: ReopenInput
): Promise<{ outcome: ReopenOutcome; request: Request | null; currentEditVersion: number | null }> {
    return changeEditingSession(input, {
        allowedOutcome: `
            WHEN t.status <> 'submitted' THEN 'NOT_SUBMITTED'`,
        nextStatus: 'in_progress',
        eventType: 'request_reopened',
    });
}

/**
 * Closes a reopened request without a new submission, restoring the stored
 * sheet as it was. Starts a new session too, so a seller tab left open from the
 * reopened session cannot submit afterwards.
 */
export async function cancelRequestReopen(
    input: ReopenInput
): Promise<{ outcome: ReopenOutcome; request: Request | null; currentEditVersion: number | null }> {
    return changeEditingSession(input, {
        allowedOutcome: `
            WHEN t.status = 'submitted' OR t.seller_edit_version = 0 OR t.metered_at IS NULL THEN 'NOT_REOPENED'`,
        nextStatus: 'submitted',
        eventType: 'request_reopen_cancelled',
    });
}

async function changeEditingSession(
    input: ReopenInput,
    change: { allowedOutcome: string; nextStatus: 'in_progress' | 'submitted'; eventType: string }
) {
    const rows = await executor(input).run({
        text: `
            WITH target AS (
                SELECT id, status, deleted_at, is_demo, is_locked, metered_at, seller_edit_version
                FROM requests WHERE id = $1::uuid FOR UPDATE
            ),
            decision AS (
                SELECT t.id, t.seller_edit_version AS current_edit_version,
                    CASE
                        WHEN t.deleted_at IS NOT NULL THEN 'NOT_FOUND'
                        WHEN COALESCE(t.is_demo, FALSE) THEN 'TEST_REQUEST'
                        WHEN t.is_locked THEN 'LOCKED'${change.allowedOutcome}
                        ELSE 'OK'
                    END AS outcome
                FROM target t
            ),
            updated AS (
                UPDATE requests r SET
                    status = $2::text,
                    seller_edit_version = r.seller_edit_version + 1,
                    seller_submission_key = NULL,
                    last_activity_at = NOW()
                FROM decision d
                WHERE r.id = d.id AND d.outcome = 'OK'
                RETURNING r.*
            ),
            inserted_event AS (
                INSERT INTO event_logs (request_id, event_type, event_data, ip_address, user_agent)
                SELECT u.id, $3::text,
                    jsonb_build_object('actor', 'agent', 'account_id', $4::text, 'edit_version', u.seller_edit_version),
                    $5::text, $6::text
                FROM updated u
                RETURNING id
            )
            SELECT d.outcome,
                COALESCE((SELECT u.seller_edit_version FROM updated u), d.current_edit_version) AS current_edit_version,
                (SELECT to_jsonb(u) FROM updated u) AS request,
                (SELECT COUNT(*) FROM inserted_event)::int AS event_count
            FROM decision d
        `,
        params: [
            input.requestId,
            change.nextStatus,
            change.eventType,
            input.actorAccountId,
            input.ipAddress,
            input.userAgent,
        ],
    });

    return readOutcome<ReopenOutcome>(rows);
}

function readOutcome<TOutcome extends string>(rows: SqlRow[]) {
    const row = rows[0];
    if (!row) {
        return { outcome: 'NOT_FOUND' as TOutcome, request: null, currentEditVersion: null };
    }
    const request = typeof row.request === 'string' ? JSON.parse(row.request) : row.request;
    return {
        outcome: row.outcome as TOutcome,
        request: (request as Request | null) ?? null,
        currentEditVersion: row.current_edit_version === null || row.current_edit_version === undefined
            ? null
            : Number(row.current_edit_version),
    };
}

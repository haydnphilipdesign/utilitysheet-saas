import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import {
    PROVIDER_RESOLUTION_INCIDENT_ID,
} from './provider-resolution-core';
import {
    assertRepairApplyAuthorized,
    buildIncidentContactRepairPlan,
    parseProviderResolutionDecisions,
    summarizeIncidentContactRepairs,
    type CurrentIncidentEntry,
} from './provider-resolution-repair-core';

interface CurrentEntryRow {
    entry_id: string;
    request_id: string;
    category: string;
    updated_at: string | Date;
    provider_name: string | null;
    contact_phone: string | null;
    contact_url: string | null;
}

function getArgValue(args: string[], name: string): string | null {
    const index = args.indexOf(name);
    if (index === -1) return null;
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
        throw new Error(`${name} requires a value`);
    }
    return value;
}

function toIso(value: string | Date): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error('Database returned an invalid updated_at timestamp');
    }
    return date.toISOString();
}

async function main() {
    const args = process.argv.slice(2);
    const decisionsPath = getArgValue(args, '--decisions');
    if (!decisionsPath) {
        throw new Error('--decisions <path> is required');
    }
    const apply = args.includes('--apply');
    const confirm = getArgValue(args, '--confirm');
    const adminId = getArgValue(args, '--admin-id');
    assertRepairApplyAuthorized({
        apply,
        confirm,
        adminId,
        adminWritesDisabled: process.env.ADMIN_WRITES_DISABLED === 'true',
    });

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL is required. Load the intended environment before running.');
    }

    const rawDecisions = JSON.parse(await readFile(path.resolve(decisionsPath), 'utf8'));
    const decisions = parseProviderResolutionDecisions(rawDecisions);
    const selectedIds = decisions.entries
        .filter((entry) => entry.action === 'fill_missing')
        .map((entry) => entry.entryId);

    const sql = neon(databaseUrl);
    const currentRows = selectedIds.length === 0
        ? []
        : await sql`
            SELECT
                ue.id AS entry_id,
                ue.request_id,
                ue.category,
                ue.updated_at,
                COALESCE(NULLIF(ue.display_name, ''), NULLIF(ue.raw_text, '')) AS provider_name,
                ue.contact_phone,
                ue.contact_url
            FROM utility_entries ue
            WHERE ue.id = ANY(${selectedIds}::uuid[])
            ORDER BY ue.id
        ` as unknown as CurrentEntryRow[];

    const current: CurrentIncidentEntry[] = currentRows.map((row) => ({
        entryId: row.entry_id,
        requestId: row.request_id,
        category: row.category,
        updatedAt: toIso(row.updated_at),
        providerName: row.provider_name || '',
        contactPhone: row.contact_phone,
        contactUrl: row.contact_url,
    }));
    const repairs = buildIncidentContactRepairPlan(decisions, current);
    const summary = summarizeIncidentContactRepairs(repairs);

    console.log(
        `incident=${PROVIDER_RESOLUTION_INCIDENT_ID} mode=${apply ? 'apply' : 'dry-run'}`
    );
    console.log(
        `selected=${summary.selected} eligible=${summary.selected} stale=0`
    );
    console.log(
        `phone_fields=${summary.phoneFields} url_fields=${summary.urlFields} requests=${summary.requests}`
    );

    if (!apply) {
        const outputDirectory = path.resolve('.incident-reports');
        const generatedAt = new Date().toISOString();
        const outputPath = path.join(
            outputDirectory,
            `${PROVIDER_RESOLUTION_INCIDENT_ID}-repair-dry-run-${generatedAt.replace(/[:.]/g, '-')}.json`
        );
        await mkdir(outputDirectory, { recursive: true });
        await writeFile(
            outputPath,
            JSON.stringify({
                incidentId: PROVIDER_RESOLUTION_INCIDENT_ID,
                generatedAt,
                entries: repairs.map((repair) => ({
                    entryId: repair.entryId,
                    requestId: repair.requestId,
                    category: repair.category,
                    changedFields: repair.changedFields,
                })),
            }, null, 2),
            { encoding: 'utf8', flag: 'wx' }
        );
        console.log(`dry_run_artifact=${outputPath}`);
        console.log('No production data changed.');
        return;
    }

    if (repairs.length === 0) {
        console.log('No eligible repairs selected; no production data changed.');
        return;
    }

    const adminRows = await sql`
        SELECT id
        FROM accounts
        WHERE id = ${adminId}
          AND role = 'admin'
        LIMIT 1
    `;
    if (adminRows.length !== 1) {
        throw new Error('--admin-id does not identify an active UtilitySheet Admin account');
    }

    const repairPayload = repairs.map((repair) => ({
        entry_id: repair.entryId,
        expected_updated_at: repair.expectedUpdatedAt,
        expected_provider_name: repair.expectedProviderName,
        expected_phone: repair.expectedPhone,
        expected_url: repair.expectedUrl,
        proposed_phone: repair.proposedPhone,
        proposed_url: repair.proposedUrl,
    }));

    const appliedRows = await sql`
        WITH input AS (
            SELECT *
            FROM jsonb_to_recordset(${JSON.stringify(repairPayload)}::jsonb) AS x(
                entry_id uuid,
                expected_updated_at timestamptz,
                expected_provider_name text,
                expected_phone text,
                expected_url text,
                proposed_phone text,
                proposed_url text
            )
        ),
        eligible AS (
            SELECT ue.id
            FROM utility_entries ue
            JOIN input i ON i.entry_id = ue.id
            WHERE ue.updated_at = i.expected_updated_at
              AND COALESCE(NULLIF(ue.display_name, ''), NULLIF(ue.raw_text, ''))
                    IS NOT DISTINCT FROM i.expected_provider_name
              AND ue.contact_phone IS NOT DISTINCT FROM i.expected_phone
              AND ue.contact_url IS NOT DISTINCT FROM i.expected_url
              AND (i.proposed_phone IS NULL OR ue.contact_phone IS NULL)
              AND (i.proposed_url IS NULL OR ue.contact_url IS NULL)
        ),
        guard AS (
            SELECT
                (SELECT COUNT(*) FROM input) AS requested,
                (SELECT COUNT(*) FROM eligible) AS eligible
        ),
        updated AS (
            UPDATE utility_entries ue
            SET
                contact_phone = COALESCE(ue.contact_phone, i.proposed_phone),
                contact_url = COALESCE(ue.contact_url, i.proposed_url),
                updated_at = NOW()
            FROM input i
            JOIN eligible e ON e.id = i.entry_id
            CROSS JOIN guard g
            WHERE ue.id = i.entry_id
              AND g.requested = g.eligible
            RETURNING
                ue.id,
                ue.request_id,
                ue.category,
                i.proposed_phone IS NOT NULL AS phone_changed,
                i.proposed_url IS NOT NULL AS url_changed
        ),
        audit_rows AS (
            INSERT INTO admin_audit_logs (
                admin_id,
                target_user_id,
                action,
                metadata
            )
            SELECT
                ${adminId}::uuid,
                r.account_id,
                'incident_provider_contact_repair',
                jsonb_build_object(
                    'incident_id', ${PROVIDER_RESOLUTION_INCIDENT_ID},
                    'request_id', u.request_id,
                    'utility_entry_id', u.id,
                    'category', u.category,
                    'changed_fields', to_jsonb(array_remove(ARRAY[
                        CASE WHEN u.phone_changed THEN 'contact_phone'::text END,
                        CASE WHEN u.url_changed THEN 'contact_url'::text END
                    ], NULL))
                )
            FROM updated u
            JOIN requests r ON r.id = u.request_id
            RETURNING id
        ),
        event_rows AS (
            INSERT INTO event_logs (request_id, event_type, event_data)
            SELECT
                u.request_id,
                'submitted_sheet_edited',
                jsonb_build_object(
                    'actor', 'admin_incident_repair',
                    'incident_id', ${PROVIDER_RESOLUTION_INCIDENT_ID},
                    'utility_entry_id', u.id,
                    'category', u.category,
                    'changed_fields', to_jsonb(array_remove(ARRAY[
                        CASE WHEN u.phone_changed THEN 'contact_phone'::text END,
                        CASE WHEN u.url_changed THEN 'contact_url'::text END
                    ], NULL))
                )
            FROM updated u
            RETURNING id
        )
        SELECT id, request_id, category
        FROM updated
        ORDER BY id
    `;

    if (appliedRows.length !== repairs.length) {
        throw new Error(
            `Repair guard applied ${appliedRows.length} of ${repairs.length}; expected all-or-none`
        );
    }
    console.log(`applied=${appliedRows.length}`);
    console.log('Production contact repair completed with audit events.');
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Incident repair failed.');
    process.exitCode = 1;
});

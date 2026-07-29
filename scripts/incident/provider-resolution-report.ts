import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import {
    searchProvidersFresh,
    type ProviderSearchDiagnostic,
} from '@/lib/providers/suggestion-service';
import {
    resolveContactFresh,
    type ContactResolutionDiagnostic,
} from '@/lib/providers/contact-service';
import type { UtilityCategory } from '@/types';
import {
    PROVIDER_RESOLUTION_INCIDENT_ID,
    classifyIncidentEntry,
    renderIncidentReviewHtml,
    type IncidentEntry,
    type IncidentReviewRow,
} from './provider-resolution-core';

interface IncidentBoundsRow {
    started_at: string | Date | null;
    ended_at: string | Date | null;
}

interface IncidentEntryRow {
    entry_id: string;
    request_id: string;
    property_address: string;
    category: string;
    entry_mode: string | null;
    provider_name: string | null;
    contact_phone: string | null;
    contact_url: string | null;
    updated_at: string | Date;
}

function parseLimit(args: string[]): number | null {
    const index = args.indexOf('--limit');
    if (index === -1) return null;
    const value = Number(args[index + 1]);
    if (!Number.isInteger(value) || value < 1 || value > 500) {
        throw new Error('--limit must be an integer between 1 and 500');
    }
    return value;
}

function toIso(value: string | Date | null): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isUtilityCategory(value: string): value is UtilityCategory {
    return (UTILITY_CATEGORY_KEYS as readonly string[]).includes(value);
}

async function mapWithConcurrency<T, R>(
    values: T[],
    concurrency: number,
    worker: (value: T, index: number) => Promise<R>
): Promise<R[]> {
    const results = new Array<R>(values.length);
    let nextIndex = 0;

    async function runWorker() {
        while (nextIndex < values.length) {
            const index = nextIndex++;
            results[index] = await worker(values[index], index);
        }
    }

    await Promise.all(
        Array.from(
            { length: Math.min(concurrency, Math.max(values.length, 1)) },
            () => runWorker()
        )
    );
    return results;
}

function emptySearch(category: UtilityCategory): ProviderSearchDiagnostic {
    return {
        suggestions: [],
        outcome: {
            category,
            source: 'fallback',
            reasonCode: 'fallback_used',
            upstreamReasonCode: 'ai_empty',
            attemptCount: 0,
            latencyMs: 0,
            suggestionCount: 0,
            localityState: null,
            localityZip3: null,
            localityCity: null,
            servedPipeline: 'new',
        },
    };
}

function emptyContact(): ContactResolutionDiagnostic {
    return {
        contact: null,
        failure: 'provider_error',
        groundingSourceUrls: [],
    };
}

async function main() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL is required. Load the intended environment before running.');
    }
    if (!process.env.GOOGLE_AI_API_KEY && !process.env.GEMINI_API_KEY) {
        throw new Error('GOOGLE_AI_API_KEY or GEMINI_API_KEY is required.');
    }

    const args = process.argv.slice(2);
    const limit = parseLimit(args);
    const sql = neon(databaseUrl);

    const boundsRows = await sql`
        WITH last_bad AS (
            SELECT MAX(created_at) AS at
            FROM ai_generation_runs
            WHERE model = 'gemini-3.5-flash-lite'
        )
        SELECT
            (
                SELECT MIN(created_at)
                FROM ai_generation_runs
                WHERE model = 'gemini-3.5-flash-lite'
            ) AS started_at,
            (
                SELECT MIN(r.created_at)
                FROM ai_generation_runs r
                CROSS JOIN last_bad
                WHERE r.model = 'gemini-3.1-flash-lite'
                  AND r.created_at > last_bad.at
            ) AS ended_at
    `;
    const bounds = boundsRows[0] as unknown as IncidentBoundsRow | undefined;
    const startedAt = toIso(bounds?.started_at || null);
    const endedAt = toIso(bounds?.ended_at || null);
    if (!startedAt || !endedAt) {
        throw new Error('Unable to derive complete incident bounds from AI telemetry.');
    }

    const rows = await sql`
        WITH submissions AS (
            SELECT request_id, MIN(created_at) AS submitted_at
            FROM event_logs
            WHERE event_type = 'seller_submitted'
            GROUP BY request_id
        )
        SELECT
            ue.id AS entry_id,
            r.id AS request_id,
            r.property_address,
            ue.category,
            ue.entry_mode,
            COALESCE(NULLIF(ue.display_name, ''), NULLIF(ue.raw_text, '')) AS provider_name,
            ue.contact_phone,
            ue.contact_url,
            ue.updated_at
        FROM requests r
        JOIN submissions s ON s.request_id = r.id
        JOIN utility_entries ue ON ue.request_id = r.id
        WHERE r.status = 'submitted'
          AND r.deleted_at IS NULL
          AND COALESCE(r.is_demo, FALSE) = FALSE
          AND s.submitted_at >= ${startedAt}
          AND s.submitted_at < ${endedAt}
          AND (
              ue.entry_mode IN ('suggested_confirmed', 'search_selected')
              OR (ue.contact_phone IS NULL AND ue.contact_url IS NULL)
          )
        ORDER BY s.submitted_at ASC, r.id ASC, ue.category ASC
    ` as unknown as IncidentEntryRow[];

    const selectedRows = limit ? rows.slice(0, limit) : rows;
    console.log(
        `incident=${PROVIDER_RESOLUTION_INCIDENT_ID} mode=read-only entries=${selectedRows.length}`
    );

    const reviewRows = await mapWithConcurrency(selectedRows, 2, async (row, index) => {
        if (!isUtilityCategory(row.category)) {
            throw new Error(`Unsupported utility category on entry ${row.entry_id}`);
        }
        const entry: IncidentEntry = {
            entryId: row.entry_id,
            requestId: row.request_id,
            propertyAddress: row.property_address,
            category: row.category,
            entryMode: row.entry_mode,
            providerName: row.provider_name || '',
            contactPhone: row.contact_phone,
            contactUrl: row.contact_url,
            updatedAt: toIso(row.updated_at) || '',
        };

        let search = emptySearch(entry.category);
        let contact = emptyContact();
        if (entry.providerName.trim().length >= 2) {
            [search, contact] = await Promise.all([
                searchProvidersFresh(
                    entry.providerName,
                    entry.category,
                    entry.propertyAddress
                ),
                resolveContactFresh(entry.providerName, {
                    category: entry.category,
                    address: entry.propertyAddress,
                }),
            ]);
        }

        console.log(`resolved=${index + 1}/${selectedRows.length}`);
        const reviewRow: IncidentReviewRow = {
            entry,
            search,
            contact,
            proposal: classifyIncidentEntry({ entry, search, contact }),
        };
        return reviewRow;
    });

    const generatedAt = new Date().toISOString();
    const report = {
        incidentId: PROVIDER_RESOLUTION_INCIDENT_ID,
        generatedAt,
        startedAt,
        endedAt,
        rows: reviewRows,
    };
    const outputDirectory = path.resolve('.incident-reports');
    const outputPath = path.join(
        outputDirectory,
        `${PROVIDER_RESOLUTION_INCIDENT_ID}-${generatedAt.replace(/[:.]/g, '-')}.html`
    );
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(outputPath, renderIncidentReviewHtml(report), {
        encoding: 'utf8',
        flag: 'wx',
    });

    const automatic = reviewRows.filter(
        (row) => row.proposal.disposition === 'automatic_contact_repair'
    ).length;
    const confirmation = reviewRows.filter(
        (row) => row.proposal.disposition === 'needs_customer_confirmation'
    ).length;
    console.log(
        `automatic_candidates=${automatic} needs_confirmation=${confirmation} unchanged=${reviewRows.length - automatic - confirmation}`
    );
    console.log(`report=${outputPath}`);
    console.log('No production customer records or caches changed.');
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Incident report failed.');
    process.exitCode = 1;
});

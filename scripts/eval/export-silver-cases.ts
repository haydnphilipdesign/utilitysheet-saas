import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { buildSilverCases, type SilverRow } from './eval-core';

/**
 * Builds the "silver" evaluation cases from past seller answers. Read-only.
 *
 * The query returns four request fields and nothing else: city, state, ZIP and
 * the provider name a seller confirmed or typed. It never selects a street
 * address, a seller or customer name, an email, a phone number or any
 * account, workspace or request identifier. Requests a coordinator edited
 * after submission, demo requests and deleted requests are left out.
 *
 * The output holds provider names typed by sellers, so it is written to the
 * ignored `.eval/` folder and must be read before it is ever committed.
 */

const DEFAULT_OUT = path.join('.eval', 'cases', 'silver.json');

function readOut(args: string[]): string {
    const index = args.indexOf('--out');
    return index !== -1 && args[index + 1] ? args[index + 1] : DEFAULT_OUT;
}

async function main(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL is not set.');
    }
    const outPath = path.resolve(readOut(process.argv.slice(2)));
    const sql = neon(databaseUrl);

    const [rows] = await sql.transaction([
        sql`
            SELECT
                r.property_address_structured->>'city' AS city,
                r.property_address_structured->>'state' AS state,
                r.property_address_structured->>'zip' AS zip,
                e.category,
                e.entry_mode,
                e.display_name
            FROM utility_entries e
            JOIN requests r ON r.id = e.request_id
            WHERE r.status = 'submitted'
              AND r.deleted_at IS NULL
              AND COALESCE(r.is_demo, FALSE) = FALSE
              AND r.property_address_structured IS NOT NULL
              AND e.entry_mode IN ('suggested_confirmed', 'search_selected', 'free_text')
              AND BTRIM(COALESCE(e.display_name, '')) <> ''
              AND NOT EXISTS (
                  SELECT 1 FROM event_logs l
                  WHERE l.request_id = r.id AND l.event_type = 'submitted_sheet_edited'
              )
        `,
    ], { readOnly: true });

    const cases = buildSilverCases(rows as SilverRow[]);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, `${JSON.stringify(cases, null, 2)}\n`, 'utf8');

    const localities = new Set(cases.map((item) => `${item.state}:${item.zip}:${item.city.toLowerCase()}`));
    const byOrigin = { suggested: 0, typed: 0, mixed: 0 };
    for (const item of cases) byOrigin[item.origin || 'mixed']++;
    console.log(`Read ${rows.length} seller answers.`);
    console.log(`Wrote ${cases.length} cases in ${localities.size} localities to ${outPath}`);
    console.log(`Picked from suggestions: ${byOrigin.suggested}; typed or searched: ${byOrigin.typed}; both: ${byOrigin.mixed}`);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});

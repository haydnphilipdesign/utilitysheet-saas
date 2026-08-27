import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { Resend } from 'resend';
import Stripe from 'stripe';
import { z } from 'zod';
import {
    buildProviderIncidentEmail,
    type ProviderIncidentSegment,
} from '@/lib/email/provider-incident-update';
import { segmentProviderIncidentRecipients } from './provider-incident-recipient-core';

const INCIDENT_ID = 'provider-resolution-2026-07';
const FROM = 'Haydn at UtilitySheet <noreply@utilitysheet.com>';
const REPLY_TO = 'Haydn@multimedium.dev';
const SEND_DELAY_MS = 600;
const REPORTING_ACCOUNT_SCHEMA = z.string().uuid();
const SEGMENTS: ProviderIncidentSegment[] = [
    'reporting_customer',
    'affected_paid',
    'paid_goodwill',
    'affected_non_billed',
];

interface RecipientRow {
    account_id: string;
    email: string;
    full_name: string | null;
    paid: boolean;
    affected: boolean;
}

interface BillingRow {
    stripe_customer_id: string;
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

function sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function commaSeparated(value: string | undefined): string[] {
    return (value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

async function sendTestVariants(testEmail: string): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        throw new Error('RESEND_API_KEY is required for --test.');
    }
    const parsedEmail = z.string().email().safeParse(testEmail);
    if (!parsedEmail.success) {
        throw new Error('--test requires a valid email address.');
    }

    const resend = new Resend(apiKey);
    for (const [index, segment] of SEGMENTS.entries()) {
        const email = buildProviderIncidentEmail({
            segment,
            firstName: 'Haydn',
            state: {
                hotfixDeployed: true,
                creditApplied: true,
                reviewComplete: true,
            },
        });
        const result = await resend.emails.send({
            from: FROM,
            to: parsedEmail.data,
            replyTo: REPLY_TO,
            subject: `[TEST ${segment}] ${email.subject}`,
            text: email.text,
            html: email.html,
        });
        if (result.error) {
            throw new Error(`Test variant ${segment} failed.`);
        }
        console.log(`test_variant=${segment} status=sent`);
        if (index < SEGMENTS.length - 1) await sleep(SEND_DELAY_MS);
    }
}

async function verifyAllPaidCreditsApplied(
    sql: NeonQueryFunction<false, false>,
    stripeKey: string
): Promise<number> {
    const billingRows = await sql`
        SELECT stripe_customer_id
        FROM accounts
        WHERE subscription_status = 'pro'
          AND stripe_customer_id IS NOT NULL
          AND subscription_id IS NOT NULL
        UNION ALL
        SELECT stripe_customer_id
        FROM organizations
        WHERE subscription_status = 'team'
          AND stripe_customer_id IS NOT NULL
          AND subscription_id IS NOT NULL
        ORDER BY stripe_customer_id
    ` as unknown as BillingRow[];
    const stripe = new Stripe(stripeKey, {
        apiVersion: '2026-08-26.dahlia',
    });

    for (const row of billingRows) {
        let startingAfter: string | undefined;
        let found = false;
        do {
            const page = await stripe.customers.listBalanceTransactions(
                row.stripe_customer_id,
                {
                    limit: 100,
                    ...(startingAfter ? { starting_after: startingAfter } : {}),
                }
            );
            found = page.data.some(
                (transaction) => transaction.metadata?.incident_id === INCIDENT_ID
            );
            if (found || !page.has_more || page.data.length === 0) break;
            startingAfter = page.data[page.data.length - 1].id;
        } while (!found);
        if (!found) {
            throw new Error(
                'Customer send blocked: at least one active billing entity is missing the incident credit.'
            );
        }
    }

    return billingRows.length;
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const send = args.includes('--send');
    const testEmail = getArgValue(args, '--test');
    if (send && testEmail) {
        throw new Error('--send and --test cannot be combined.');
    }
    if (testEmail) {
        await sendTestVariants(testEmail);
        console.log('Test variants sent. No customer recipients were contacted.');
        return;
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL is required.');
    }
    const reportingAccountRaw = getArgValue(args, '--reporting-account-id');
    const reportingAccount = REPORTING_ACCOUNT_SCHEMA.safeParse(reportingAccountRaw);
    if (!reportingAccount.success) {
        throw new Error('--reporting-account-id requires a valid UUID.');
    }

    const sql = neon(databaseUrl);
    const rows = await sql`
        WITH last_bad AS (
            SELECT MAX(created_at) AS at
            FROM ai_generation_runs
            WHERE model = 'gemini-3.5-flash-lite'
        ),
        incident_bounds AS (
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
        ),
        submissions AS (
            SELECT request_id, MIN(created_at) AS submitted_at
            FROM event_logs
            WHERE event_type = 'seller_submitted'
            GROUP BY request_id
        ),
        affected_requests AS (
            SELECT DISTINCT r.account_id, r.organization_id
            FROM requests r
            JOIN submissions s ON s.request_id = r.id
            CROSS JOIN incident_bounds b
            WHERE r.status = 'submitted'
              AND r.deleted_at IS NULL
              AND COALESCE(r.is_demo, FALSE) = FALSE
              AND b.started_at IS NOT NULL
              AND b.ended_at IS NOT NULL
              AND s.submitted_at >= b.started_at
              AND s.submitted_at < b.ended_at
        )
        SELECT
            a.id AS account_id,
            a.email,
            a.full_name,
            (
                a.subscription_status = 'pro'
                AND a.stripe_customer_id IS NOT NULL
                AND a.subscription_id IS NOT NULL
            ) AS paid,
            EXISTS (
                SELECT 1
                FROM affected_requests ar
                WHERE ar.account_id = a.id
            ) AS affected
        FROM accounts a
        WHERE (
                a.subscription_status = 'pro'
                AND a.stripe_customer_id IS NOT NULL
                AND a.subscription_id IS NOT NULL
              )
           OR a.id = ${reportingAccount.data}
           OR EXISTS (
                SELECT 1
                FROM affected_requests ar
                WHERE ar.account_id = a.id
           )
        UNION ALL
        SELECT
            a.id AS account_id,
            a.email,
            a.full_name,
            TRUE AS paid,
            EXISTS (
                SELECT 1
                FROM affected_requests ar
                WHERE ar.organization_id = o.id
            ) AS affected
        FROM organizations o
        JOIN organization_members om
          ON om.organization_id = o.id
         AND om.role = 'admin'
        JOIN accounts a ON a.id = om.account_id
        WHERE o.subscription_status = 'team'
          AND o.stripe_customer_id IS NOT NULL
          AND o.subscription_id IS NOT NULL
        ORDER BY account_id
    ` as unknown as RecipientRow[];

    const excludedEmails = commaSeparated(process.env.PROVIDER_INCIDENT_EXCLUDED_EMAILS);
    const recipients = segmentProviderIncidentRecipients({
        reportingAccountId: reportingAccount.data,
        excludedEmails,
        excludedDomains: [
            'example.com',
            'utilitysheet.test',
            ...commaSeparated(process.env.PROVIDER_INCIDENT_EXCLUDED_DOMAINS),
        ],
        candidates: rows.map((row) => ({
            accountId: row.account_id,
            email: row.email,
            fullName: row.full_name,
            paid: row.paid,
            affected: row.affected,
        })),
    });

    const counts = Object.fromEntries(
        SEGMENTS.map((segment) => [
            segment,
            recipients.filter((recipient) => recipient.segment === segment).length,
        ])
    ) as Record<ProviderIncidentSegment, number>;
    console.log(`incident=${INCIDENT_ID} mode=${send ? 'send' : 'dry-run'}`);
    for (const segment of SEGMENTS) {
        console.log(`${segment}=${counts[segment]}`);
    }
    console.log(`total=${recipients.length} excluded_or_deduplicated=${rows.length - recipients.length}`);

    if (!send) {
        console.log('No emails sent.');
        return;
    }

    if (
        getArgValue(args, '--confirm') !== INCIDENT_ID ||
        !args.includes('--hotfix-deployed') ||
        !args.includes('--credits-applied')
    ) {
        throw new Error(
            `Customer send requires --confirm ${INCIDENT_ID} --hotfix-deployed --credits-applied.`
        );
    }
    if (excludedEmails.length === 0) {
        throw new Error(
            'Customer send requires PROVIDER_INCIDENT_EXCLUDED_EMAILS to be configured and reviewed.'
        );
    }
    if (counts.reporting_customer !== 1) {
        throw new Error('Customer send requires exactly one reporting customer.');
    }
    const apiKey = process.env.RESEND_API_KEY;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey || !stripeKey) {
        throw new Error('RESEND_API_KEY and STRIPE_SECRET_KEY are required for --send.');
    }
    const paidEntities = await verifyAllPaidCreditsApplied(sql, stripeKey);
    console.log(`verified_paid_credit_entities=${paidEntities}`);

    const resend = new Resend(apiKey);
    const reviewComplete = args.includes('--review-complete');
    let sent = 0;
    for (const [index, recipient] of recipients.entries()) {
        const email = buildProviderIncidentEmail({
            segment: recipient.segment,
            firstName: recipient.firstName,
            state: {
                hotfixDeployed: true,
                creditApplied: true,
                reviewComplete,
            },
        });
        const result = await resend.emails.send({
            from: FROM,
            to: recipient.email,
            replyTo: REPLY_TO,
            subject: email.subject,
            text: email.text,
            html: email.html,
        });
        if (result.error) {
            throw new Error(
                `Customer send stopped after ${sent} messages; segment ${recipient.segment} failed.`
            );
        }
        sent += 1;
        console.log(`sent=${sent}/${recipients.length} segment=${recipient.segment}`);
        if (index < recipients.length - 1) await sleep(SEND_DELAY_MS);
    }
    console.log(`Customer send complete. sent=${sent}`);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Incident email operation failed.');
    process.exitCode = 1;
});

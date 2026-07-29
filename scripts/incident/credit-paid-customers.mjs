import { neon } from '@neondatabase/serverless';
import Stripe from 'stripe';
import {
    INCIDENT_ID,
    applyCustomerCreditPlan,
    assertCustomerCreditApplyAuthorized,
    buildCustomerCreditPlan,
    summarizeCustomerCreditPlan,
} from './customer-credit-core.mjs';

function getArgValue(args, name) {
    const index = args.indexOf(name);
    if (index === -1) return null;
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
        throw new Error(`${name} requires a value`);
    }
    return value;
}

function getIntegerArg(args, name) {
    const raw = getArgValue(args, name);
    if (raw === null) return null;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) {
        throw new Error(`${name} must be a non-negative integer`);
    }
    return value;
}

async function main() {
    const databaseUrl = process.env.DATABASE_URL;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!databaseUrl || !stripeKey) {
        throw new Error(
            'DATABASE_URL and STRIPE_SECRET_KEY are required. Load the intended environment before running.'
        );
    }

    const args = process.argv.slice(2);
    const apply = args.includes('--apply');
    const confirm = getArgValue(args, '--confirm');
    const expectedCount = getIntegerArg(args, '--expected-count');
    const expectedTotalCents = getIntegerArg(args, '--expected-total-cents');
    const sql = neon(databaseUrl);
    const stripe = new Stripe(stripeKey, {
        apiVersion: '2025-12-15.clover',
    });

    const entityRows = await sql`
        SELECT
            'account' AS entity_type,
            id AS entity_id,
            stripe_customer_id,
            subscription_id
        FROM accounts
        WHERE subscription_status = 'pro'
          AND stripe_customer_id IS NOT NULL
          AND subscription_id IS NOT NULL
        UNION ALL
        SELECT
            'organization' AS entity_type,
            id AS entity_id,
            stripe_customer_id,
            subscription_id
        FROM organizations
        WHERE subscription_status = 'team'
          AND stripe_customer_id IS NOT NULL
          AND subscription_id IS NOT NULL
        ORDER BY entity_type, entity_id
    `;
    const entities = entityRows.map((row) => ({
        entityType: String(row.entity_type),
        entityId: String(row.entity_id),
        stripeCustomerId: String(row.stripe_customer_id),
        subscriptionId: String(row.subscription_id),
    }));

    const plan = await buildCustomerCreditPlan({ stripe, entities });
    const summary = summarizeCustomerCreditPlan(plan);
    assertCustomerCreditApplyAuthorized({
        apply,
        confirm,
        expectedCount,
        expectedTotalCents,
        summary,
    });

    console.log(`incident=${INCIDENT_ID} mode=${apply ? 'apply' : 'dry-run'}`);
    console.log(
        `eligible=${summary.eligible} already_applied=${summary.alreadyApplied} pending=${summary.pending}`
    );
    console.log(
        `total_eligible_cents=${summary.totalEligibleCents} total_pending_cents=${summary.totalPendingCents}`
    );

    if (!apply) {
        console.log('No Stripe credits created.');
        return;
    }

    const appliedIds = await applyCustomerCreditPlan({ stripe, plan });
    console.log(
        `applied=${appliedIds.length} previously_applied=${summary.alreadyApplied}`
    );
    console.log('Stripe customer-balance credits completed.');
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Incident credit operation failed.');
    process.exitCode = 1;
});

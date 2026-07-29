export const INCIDENT_ID = 'provider-resolution-2026-07';
export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

export function monthlySubscriptionAmount(subscription) {
    if (!ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
        throw new Error(`Subscription ${subscription.id} is not active or trialing`);
    }

    let total = 0;
    for (const item of subscription.items?.data || []) {
        const recurring = item.price?.recurring;
        const unitAmount = item.price?.unit_amount;
        const quantity = item.quantity;
        if (
            item.price?.currency !== 'usd' ||
            !Number.isInteger(unitAmount) ||
            recurring?.interval !== 'month' ||
            recurring?.interval_count !== 1 ||
            !Number.isInteger(quantity) ||
            quantity < 1
        ) {
            throw new Error(
                `Subscription ${subscription.id} is not a fixed monthly USD subscription`
            );
        }
        total += unitAmount * quantity;
    }

    if (total <= 0) {
        throw new Error(`Subscription ${subscription.id} has no creditable monthly amount`);
    }
    return total;
}

export function buildIncidentIdempotencyKey({ incidentId, entityType, entityId }) {
    return `incident-credit-${incidentId}-${entityType}-${entityId}`;
}

export function hasIncidentCredit(balanceTransactions, incidentId = INCIDENT_ID) {
    return balanceTransactions.some(
        (transaction) => transaction.metadata?.incident_id === incidentId
    );
}

export async function listAllBalanceTransactions(stripe, customerId) {
    const transactions = [];
    let startingAfter;

    while (true) {
        const page = await stripe.customers.listBalanceTransactions(customerId, {
            limit: 100,
            ...(startingAfter ? { starting_after: startingAfter } : {}),
        });
        transactions.push(...page.data);
        if (!page.has_more || page.data.length === 0) break;
        startingAfter = page.data[page.data.length - 1].id;
    }
    return transactions;
}

export async function buildCustomerCreditPlan({ stripe, entities }) {
    const plan = [];
    for (const entity of entities) {
        const subscription = await stripe.subscriptions.retrieve(entity.subscriptionId, {
            expand: ['items.data.price'],
        });
        const amountCents = monthlySubscriptionAmount(subscription);
        const transactions = await listAllBalanceTransactions(
            stripe,
            entity.stripeCustomerId
        );
        plan.push({
            ...entity,
            amountCents,
            alreadyApplied: hasIncidentCredit(transactions),
            idempotencyKey: buildIncidentIdempotencyKey({
                incidentId: INCIDENT_ID,
                entityType: entity.entityType,
                entityId: entity.entityId,
            }),
        });
    }
    return plan;
}

export function summarizeCustomerCreditPlan(plan) {
    const pending = plan.filter((row) => !row.alreadyApplied);
    return {
        eligible: plan.length,
        alreadyApplied: plan.length - pending.length,
        pending: pending.length,
        totalEligibleCents: plan.reduce((sum, row) => sum + row.amountCents, 0),
        totalPendingCents: pending.reduce((sum, row) => sum + row.amountCents, 0),
    };
}

export function assertCustomerCreditApplyAuthorized({
    apply,
    confirm,
    expectedCount,
    expectedTotalCents,
    summary,
}) {
    if (!apply) return;
    if (confirm !== INCIDENT_ID) {
        throw new Error(`Apply requires --confirm ${INCIDENT_ID}`);
    }
    if (!Number.isInteger(expectedCount) || expectedCount !== summary.eligible) {
        throw new Error(
            `Expected count ${expectedCount ?? 'missing'} does not match live count ${summary.eligible}`
        );
    }
    if (
        !Number.isInteger(expectedTotalCents) ||
        expectedTotalCents !== summary.totalEligibleCents
    ) {
        throw new Error(
            `Expected total ${expectedTotalCents ?? 'missing'} does not match live total ${summary.totalEligibleCents}`
        );
    }
}

export async function applyCustomerCreditPlan({ stripe, plan }) {
    const applied = [];
    for (const row of plan) {
        if (row.alreadyApplied) continue;
        const transaction = await stripe.customers.createBalanceTransaction(
            row.stripeCustomerId,
            {
                amount: -row.amountCents,
                currency: 'usd',
                description: 'UtilitySheet July 2026 service credit',
                metadata: {
                    incident_id: INCIDENT_ID,
                    entity_type: row.entityType,
                    entity_id: row.entityId,
                    subscription_id: row.subscriptionId,
                },
            },
            { idempotencyKey: row.idempotencyKey }
        );
        applied.push(transaction.id);
    }
    return applied;
}

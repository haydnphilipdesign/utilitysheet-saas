/**
 * Honest billing context for Admin detail pages.
 *
 * UtilitySheet stores an entitlement (what the product grants) and, separately,
 * identifiers of Stripe records. Neither proves that a payment is current.
 * These helpers describe exactly what is stored and link to the Stripe record
 * when the identifier and dashboard mode are trustworthy. They never call Stripe.
 */

export type StripeMode = 'live' | 'test';

/**
 * The mode of the Stripe key this deployment uses, taken from the key prefix.
 * Returns null when no key is configured or the prefix is unrecognized, in
 * which case no dashboard link is offered rather than guessing.
 */
export function getStripeModeFromKey(secretKey: string | undefined | null): StripeMode | null {
    if (!secretKey) return null;
    if (/^(sk|rk)_live_/.test(secretKey)) return 'live';
    if (/^(sk|rk)_test_/.test(secretKey)) return 'test';
    return null;
}

const CUSTOMER_ID = /^cus_[A-Za-z0-9]{6,64}$/;
const SUBSCRIPTION_ID = /^sub_[A-Za-z0-9]{6,64}$/;

function dashboardUrl(mode: StripeMode, path: string) {
    return `https://dashboard.stripe.com/${mode === 'test' ? 'test/' : ''}${path}`;
}

export type StripeRecordLink = { label: string; id: string; href: string | null };

/** Links only well-formed identifiers, and only when the dashboard mode is known. */
export function buildStripeRecordLinks(input: {
    customerId?: string | null;
    subscriptionId?: string | null;
    mode: StripeMode | null;
}): StripeRecordLink[] {
    const links: StripeRecordLink[] = [];
    const customerId = input.customerId?.trim();
    const subscriptionId = input.subscriptionId?.trim();

    if (customerId) {
        links.push({
            label: 'Stripe customer',
            id: customerId,
            href: input.mode && CUSTOMER_ID.test(customerId) ? dashboardUrl(input.mode, `customers/${customerId}`) : null,
        });
    }
    if (subscriptionId) {
        links.push({
            label: 'Stripe subscription',
            id: subscriptionId,
            href: input.mode && SUBSCRIPTION_ID.test(subscriptionId)
                ? dashboardUrl(input.mode, `subscriptions/${subscriptionId}`)
                : null,
        });
    }
    return links;
}

export type BillingEvidence = {
    /** Short statement of what the stored data supports. */
    summary: string;
    /** What it does not establish, or where the billing relationship actually lives. */
    caveat: string;
    /** `review` only when stored data is internally inconsistent enough to be worth a look. */
    tone: 'neutral' | 'review';
};

/**
 * Describes account-level billing evidence. A missing Stripe ID is normal for
 * complimentary overrides and Team-managed accounts and is not reported as a fault.
 */
export function describeAccountBilling(input: {
    entitlement: 'free' | 'pro' | 'canceled' | string;
    teamManaged: boolean;
    customerId?: string | null;
    subscriptionId?: string | null;
}): BillingEvidence {
    const hasSubscriptionId = Boolean(input.subscriptionId?.trim());

    if (input.teamManaged) {
        return {
            summary: 'Access comes from the active Team workspace.',
            caveat: 'Billing, if any, belongs to the workspace, not this account. See the workspace for its Stripe records.',
            tone: 'neutral',
        };
    }

    if (input.entitlement === 'pro') {
        return hasSubscriptionId
            ? {
                summary: 'Pro entitlement with a stored Stripe subscription ID.',
                caveat: 'A stored ID does not prove the subscription is active or paid. Confirm its current status in Stripe.',
                tone: 'neutral',
            }
            : {
                summary: 'Pro entitlement with no stored Stripe subscription.',
                caveat: 'This is expected for a complimentary or Admin override. It is counted as paid-plan access but is not evidence of payment.',
                tone: 'neutral',
            };
    }

    if (hasSubscriptionId) {
        return {
            summary: `${input.entitlement === 'canceled' ? 'Canceled' : 'Free'} entitlement with a stored Stripe subscription ID.`,
            caveat: 'The stored ID may belong to an ended subscription, or access and billing may disagree. Check the subscription in Stripe before changing anything.',
            tone: 'review',
        };
    }

    return {
        summary: `${input.entitlement === 'canceled' ? 'Canceled' : 'Free'} entitlement with no stored Stripe subscription.`,
        caveat: 'No billing relationship is recorded for this account.',
        tone: 'neutral',
    };
}

export function describeWorkspaceBilling(input: {
    entitlement: 'free' | 'team' | 'canceled' | string | null;
    subscriptionId?: string | null;
    seatQuantity?: number | null;
    memberCount?: number;
}): BillingEvidence {
    const hasSubscriptionId = Boolean(input.subscriptionId?.trim());
    const entitlement = input.entitlement || 'free';

    if (entitlement === 'team') {
        const members = input.memberCount ?? 0;
        const membersNote = members > 0
            ? ` Its ${members} ${members === 1 ? 'member counts' : 'members each count'} toward paid-plan access, but this is one subscription.`
            : '';
        return hasSubscriptionId
            ? {
                summary: 'Team entitlement with a stored Stripe subscription ID.',
                caveat: `A stored ID does not prove the subscription is active or paid. Confirm its current status in Stripe.${membersNote}`,
                tone: 'neutral',
            }
            : {
                summary: 'Team entitlement with no stored Stripe subscription.',
                caveat: `No Stripe subscription is recorded for this workspace, so its Team access is not evidence of payment.${membersNote}`,
                tone: 'review',
            };
    }

    return hasSubscriptionId
        ? {
            summary: `${entitlement === 'canceled' ? 'Canceled' : 'Free'} workspace with a stored Stripe subscription ID.`,
            caveat: 'The stored ID may belong to an ended subscription. Check it in Stripe before changing anything.',
            tone: 'review',
        }
        : {
            summary: `${entitlement === 'canceled' ? 'Canceled' : 'Free'} workspace with no stored Stripe subscription.`,
            caveat: 'No billing relationship is recorded for this workspace.',
            tone: 'neutral',
        };
}

/** Shared wording for the account-based count, used wherever it is displayed. */
export const PAID_PLAN_ACCESS_LABEL = 'Paid-plan access';
export const PAID_PLAN_ACCESS_EXPLANATION =
    'Customer accounts with Pro access or an active Team workspace. Complimentary overrides count, and every member of a Team workspace counts separately. This is not a count of paying subscriptions and must not be used to derive revenue.';

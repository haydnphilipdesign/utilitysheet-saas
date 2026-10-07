import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe/client';

// Billing now, or able to bill again without a new checkout. `incomplete` is left
// out on purpose: a first payment that failed inside Checkout must not lock the
// customer out of trying again.
const LIVE_STATUSES = new Set<Stripe.Subscription.Status>([
    'active',
    'trialing',
    'past_due',
    'unpaid',
    'paused',
]);

/**
 * The customer's subscription that a new checkout would duplicate, if any.
 * Throws when Stripe cannot be read, so callers refuse instead of guessing.
 */
export async function findLiveSubscription(stripeCustomerId: string): Promise<Stripe.Subscription | null> {
    if (!stripe) {
        throw new Error('Stripe is not configured; subscriptions cannot be checked');
    }

    const subscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: 'all',
        limit: 100,
    });

    return subscriptions.data.find((subscription) => LIVE_STATUSES.has(subscription.status)) || null;
}

/** When a subscription that is set to cancel will end, or null when it renews. */
export function getSubscriptionCancelAt(
    subscription: Pick<Stripe.Subscription, 'cancel_at' | 'cancel_at_period_end'>,
    periodEnd: Date | null
): Date | null {
    if (subscription.cancel_at) {
        return new Date(subscription.cancel_at * 1000);
    }

    return subscription.cancel_at_period_end ? periodEnd : null;
}

/**
 * Account-related database queries
 */
import { sql } from '@/lib/neon/db';

/**
 * Get or create an account for an authenticated user
 */
export async function getOrCreateAccount(authUserId: string, email: string, fullName?: string) {
    if (!sql) return null;

    // Try to find existing account
    let result = await sql`
        SELECT * FROM accounts WHERE auth_user_id = ${authUserId}
    `;

    if (result.length > 0) {
        return result[0];
    }

    // Create new account
    result = await sql`
        INSERT INTO accounts (auth_user_id, email, full_name, notification_preferences)
        VALUES (${authUserId}, ${email}, ${fullName || null}, '{}'::jsonb)
        RETURNING *
    `;

    return result[0] || null;
}

/**
 * Update account information
 */
export async function updateAccount(accountId: string, data: { fullName?: string; notificationPreferences?: any }) {
    if (!sql) return null;

    const result = await sql`
        UPDATE accounts
        SET full_name = COALESCE(${data.fullName}, full_name),
            notification_preferences = COALESCE(${data.notificationPreferences}, notification_preferences)
        WHERE id = ${accountId}
        RETURNING *
    `;

    return result[0] || null;
}

/**
 * Get account by ID
 */
export async function getAccountById(accountId: string) {
    if (!sql) return null;

    const result = await sql`
        SELECT * FROM accounts WHERE id = ${accountId}
    `;

    return result[0] || null;
}

/**
 * Get account by Stripe customer ID
 */
export async function getAccountByStripeCustomerId(stripeCustomerId: string) {
    if (!sql) return null;

    const result = await sql`
        SELECT * FROM accounts WHERE stripe_customer_id = ${stripeCustomerId}
    `;

    return result[0] || null;
}

/**
 * Update Stripe customer ID for an account
 */
export async function updateAccountStripeCustomer(accountId: string, stripeCustomerId: string) {
    if (!sql) return null;

    const result = await sql`
        UPDATE accounts
        SET stripe_customer_id = ${stripeCustomerId}
        WHERE id = ${accountId}
        RETURNING *
    `;

    return result[0] || null;
}

/**
 * Update subscription status for an account
 */
export async function updateAccountSubscription(
    accountId: string,
    data: {
        subscriptionStatus: string;
        subscriptionId: string | null;
        subscriptionEndsAt: Date | null;
    }
) {
    if (!sql) return null;

    const result = await sql`
        UPDATE accounts
        SET 
            subscription_status = ${data.subscriptionStatus},
            subscription_id = ${data.subscriptionId},
            subscription_ends_at = ${data.subscriptionEndsAt?.toISOString() || null}
        WHERE id = ${accountId}
        RETURNING *
    `;

    return result[0] || null;
}

/**
 * Get all accounts with weekly_summary notification enabled
 */
export async function getAccountsWithWeeklySummaryEnabled() {
    if (!sql) return [];

    const result = await sql`
        SELECT * FROM accounts 
        WHERE notification_preferences->>'weekly_summary' = 'true'
        AND email IS NOT NULL
    `;

    return result;
}

/**
 * Get monthly usage for an account (counts requests created this month)
 */
export async function getMonthlyUsage(
    accountId: string,
    organizationId?: string
): Promise<{ used: number; limit: number; plan: string }> {
    if (!sql) return { used: 0, limit: 3, plan: 'free' };

    // Count requests created in the current calendar month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const query = organizationId
        ? sql`
            SELECT COUNT(*) as count 
            FROM requests 
            WHERE organization_id = ${organizationId}
                AND created_at >= ${startOfMonth.toISOString()}
        `
        : sql`
            SELECT COUNT(*) as count 
            FROM requests 
            WHERE account_id = ${accountId} 
                AND organization_id IS NULL
                AND created_at >= ${startOfMonth.toISOString()}
        `;

    const result = await query;
    const used = Number(result[0]?.count) || 0;

    // Fetch subscription status from account
    const accountResult = await sql`
        SELECT subscription_status FROM accounts WHERE id = ${accountId}
    `;
    const subscriptionStatus = accountResult[0]?.subscription_status || 'free';

    // Pro users get unlimited requests
    if (subscriptionStatus === 'pro') {
        return {
            used,
            limit: 999999, // Effectively unlimited
            plan: 'pro',
        };
    }

    // Free plan = 3 requests per month
    return {
        used,
        limit: 3,
        plan: 'free',
    };
}

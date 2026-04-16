/**
 * Account-related database queries
 */
import { sql } from '@/lib/neon/db';

function normalizeTimestamp(value?: Date | string | null) {
    if (!value) return null;

    const normalized = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(normalized.getTime())) {
        return null;
    }

    return normalized.toISOString();
}

export async function ensureAccountRecord(
    authUserId: string,
    email: string,
    fullName?: string,
    signedUpAt?: Date | string | null
) {
    if (!sql) return { account: null, created: false };
    const createdAt = normalizeTimestamp(signedUpAt);

    let result = await sql`
        SELECT * FROM accounts WHERE auth_user_id = ${authUserId}
    `;

    if (result.length > 0) {
        const existing = result[0];
        const shouldUpdateEmail = email.trim().length > 0 && existing.email !== email;
        const shouldUpdateFullName = Boolean(fullName?.trim()) && existing.full_name !== fullName;

        if (shouldUpdateEmail || shouldUpdateFullName) {
            result = await sql`
                UPDATE accounts
                SET email = CASE WHEN ${shouldUpdateEmail} THEN ${email} ELSE email END,
                    full_name = CASE WHEN ${shouldUpdateFullName} THEN ${fullName || null} ELSE full_name END
                WHERE auth_user_id = ${authUserId}
                RETURNING *
            `;
        }

        return { account: (result[0] || existing), created: false };
    }

    result = await sql`
        INSERT INTO accounts (auth_user_id, email, full_name, notification_preferences, created_at)
        VALUES (${authUserId}, ${email}, ${fullName || null}, '{}'::jsonb, COALESCE(${createdAt}, NOW()))
        RETURNING *
    `;

    return { account: result[0] || null, created: true };
}

/**
 * Get or create an account for an authenticated user
 */
export async function getOrCreateAccount(authUserId: string, email: string, fullName?: string, signedUpAt?: Date | string | null) {
    const result = await ensureAccountRecord(authUserId, email, fullName, signedUpAt);
    return result.account;
}

/**
 * Update account information
 */
export async function updateAccount(
    accountId: string,
    data: { fullName?: string; notificationPreferences?: Record<string, boolean> | null }
) {
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
 * Mark onboarding as completed for an account
 */
export async function setOnboardingCompleted(accountId: string) {
    if (!sql) return null;

    const result = await sql`
        UPDATE accounts
        SET onboarding_completed_at = COALESCE(onboarding_completed_at, NOW()),
            updated_at = NOW()
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

export async function getAccountsByAuthUserIds(authUserIds: string[]) {
    if (!sql || authUserIds.length === 0) return [];

    const result = await sql`
        SELECT id, auth_user_id, email, onboarding_completed_at, created_at
        FROM accounts
        WHERE auth_user_id = ANY(${authUserIds}::text[])
    `;

    return result as Array<{
        id: string;
        auth_user_id: string | null;
        email: string;
        onboarding_completed_at: string | null;
        created_at: string;
    }>;
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

    // Count metered requests in the current calendar month.
    // Drafts are not metered and do not count against plan limits.
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Usage is tracked per account (subscription lives on accounts), regardless of organization context.
    // Free plan limits apply to *unlocked* requests; over-limit submissions are stored as locked.
    const query = sql`
        SELECT COUNT(*) as count
        FROM requests
        WHERE account_id = ${accountId}
            AND metered_at IS NOT NULL
            AND metered_at >= ${startOfMonth.toISOString()}
            AND (is_demo = FALSE OR is_demo IS NULL)
            AND is_locked = FALSE
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

    // Team users (org subscription) also get unlimited requests
    if (organizationId) {
        const orgResult = await sql`
            SELECT subscription_status
            FROM organizations
            WHERE id = ${organizationId}
        `;
        const orgStatus = orgResult[0]?.subscription_status || 'free';

        if (orgStatus === 'team') {
            return {
                used,
                limit: 999999,
                plan: 'team',
            };
        }
    }

    // Free plan = 3 requests per month
    return {
        used,
        limit: 3,
        plan: 'free',
    };
}

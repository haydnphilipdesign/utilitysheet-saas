import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Initialize Redis client - returns null if not configured
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    : null;

interface RateLimitPolicy {
    limiter: Ratelimit | null;
    limit: number;
    windowMs: number;
    prefix: string;
}

interface RateLimitOptions {
    requirePersistent?: boolean;
}

/**
 * Check if rate limiting is configured
 */
export function isRateLimitConfigured(): boolean {
    return !!redis;
}

/**
 * Rate limiter for AI-powered endpoints (e.g., provider suggestions)
 * Limit: 20 requests per minute per identifier
 */
export const aiRatelimit: RateLimitPolicy = {
    limiter: redis
        ? new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(20, "60 s"),
            analytics: true,
            prefix: "ratelimit:ai",
        })
        : null,
    limit: 20,
    windowMs: 60 * 1000,
    prefix: 'ratelimit:ai',
};

/**
 * Rate limiter for form submissions
 * Limit: 5 submissions per minute per token
 */
export const formSubmissionRatelimit: RateLimitPolicy = {
    limiter: redis
        ? new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(5, "60 s"),
            analytics: true,
            prefix: "ratelimit:form",
        })
        : null,
    limit: 5,
    windowMs: 60 * 1000,
    prefix: 'ratelimit:form',
};

/**
 * Rate limiter for request creation
 * Limit: 10 requests per minute per user
 */
export const requestCreationRatelimit: RateLimitPolicy = {
    limiter: redis
        ? new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(10, "60 s"),
            analytics: true,
            prefix: "ratelimit:create",
        })
        : null,
    limit: 10,
    windowMs: 60 * 1000,
    prefix: 'ratelimit:create',
};

/**
 * Rate limiter for public intake link starts
 * Limit: 10 starts per minute per identifier (typically IP+slug)
 */
export const intakeStartRatelimit: RateLimitPolicy = {
    limiter: redis
        ? new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(10, "60 s"),
            analytics: true,
            prefix: "ratelimit:intake",
        })
        : null,
    limit: 10,
    windowMs: 60 * 1000,
    prefix: 'ratelimit:intake',
};

/**
 * Rate limiter for packet PDF generation (public token route)
 * Limit: 5 requests per minute per identifier
 */
export const packetPdfRatelimit: RateLimitPolicy = {
    limiter: redis
        ? new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(5, "60 s"),
            analytics: true,
            prefix: "ratelimit:packet-pdf",
        })
        : null,
    limit: 5,
    windowMs: 60 * 1000,
    prefix: 'ratelimit:packet-pdf',
};

/**
 * Rate limiter for reminder emails
 * Limit: 3 reminders per 15 minutes per identifier
 */
export const reminderRatelimit: RateLimitPolicy = {
    limiter: redis
        ? new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(3, "15 m"),
            analytics: true,
            prefix: "ratelimit:reminder",
        })
        : null,
    limit: 3,
    windowMs: 15 * 60 * 1000,
    prefix: 'ratelimit:reminder',
};

/**
 * Rate limiter for organization invite creation
 * Limit: 10 invites per hour per identifier
 */
export const organizationInviteRatelimit: RateLimitPolicy = {
    limiter: redis
        ? new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(10, "1 h"),
            analytics: true,
            prefix: "ratelimit:org-invite",
        })
        : null,
    limit: 10,
    windowMs: 60 * 60 * 1000,
    prefix: 'ratelimit:org-invite',
};

/**
 * Rate limiter for brand asset upload/delete APIs
 * Limit: 20 requests per minute per user
 */
export const brandingUploadRatelimit: RateLimitPolicy = {
    limiter: redis
        ? new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(20, "60 s"),
            analytics: true,
            prefix: "ratelimit:branding-upload",
        })
        : null,
    limit: 20,
    windowMs: 60 * 1000,
    prefix: 'ratelimit:branding-upload',
};

/**
 * Rate limiter for anonymous growth referral events (packet page impressions/clicks)
 * Limit: 30 events per minute per identifier (typically IP)
 */
export const growthReferralEventRatelimit: RateLimitPolicy = {
    limiter: redis
        ? new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(30, "60 s"),
            analytics: true,
            prefix: "ratelimit:growth-referral",
        })
        : null,
    limit: 30,
    windowMs: 60 * 1000,
    prefix: 'ratelimit:growth-referral',
};

export const accountSecurityRatelimit: RateLimitPolicy = {
    limiter: redis
        ? new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(12, "15 m"),
            analytics: true,
            prefix: "ratelimit:account-security",
        })
        : null,
    limit: 12,
    windowMs: 15 * 60 * 1000,
    prefix: "account-security",
};

export const accountExportRatelimit: RateLimitPolicy = {
    limiter: redis
        ? new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(3, "1 h"),
            analytics: true,
            prefix: "ratelimit:account-export",
        })
        : null,
    limit: 3,
    windowMs: 60 * 60 * 1000,
    prefix: "account-export",
};

const memoryRateLimit = new Map<string, { count: number; resetAt: number }>();

/**
 * Result type for rate limit checks
 */
export interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
    reason: 'ok' | 'limited' | 'unavailable';
}

/**
 * Check rate limit for a given identifier
 * Returns success: true if not rate limited, false if limited
 * Also returns limit info for response headers
 */
export async function checkRateLimit(
    policy: RateLimitPolicy,
    identifier: string,
    options: RateLimitOptions = {}
): Promise<RateLimitResult> {
    if (!policy.limiter && options.requirePersistent) {
        return {
            success: false,
            limit: policy.limit,
            remaining: 0,
            reset: Math.ceil((Date.now() + policy.windowMs) / 1000),
            reason: 'unavailable',
        };
    }

    if (policy.limiter) {
        const result = await policy.limiter.limit(identifier);
        return {
            success: result.success,
            limit: result.limit,
            remaining: result.remaining,
            reset: result.reset,
            reason: result.success ? 'ok' : 'limited',
        };
    }

    const now = Date.now();
    const key = `${policy.prefix}:${identifier}`;
    const current = memoryRateLimit.get(key);

    let windowEntry = current;
    if (!windowEntry || windowEntry.resetAt <= now) {
        windowEntry = {
            count: 0,
            resetAt: now + policy.windowMs,
        };
    }

    windowEntry.count += 1;
    memoryRateLimit.set(key, windowEntry);

    if (memoryRateLimit.size > 10_000) {
        for (const [bucketKey, bucket] of memoryRateLimit.entries()) {
            if (bucket.resetAt <= now) {
                memoryRateLimit.delete(bucketKey);
            }
        }
    }

    return {
        success: windowEntry.count <= policy.limit,
        limit: policy.limit,
        remaining: Math.max(0, policy.limit - windowEntry.count),
        reset: Math.ceil(windowEntry.resetAt / 1000),
        reason: windowEntry.count <= policy.limit ? 'ok' : 'limited',
    };
}

export function isRateLimitUnavailable(result: RateLimitResult): boolean {
    return result.reason === 'unavailable';
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
    if (result.limit <= 0) {
        return {};
    }

    return {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.reset.toString(),
    };
}

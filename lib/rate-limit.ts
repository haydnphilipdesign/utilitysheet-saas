import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Initialize Redis client - returns null if not configured
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    : null;

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
export const aiRatelimit = redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, "60 s"),
        analytics: true,
        prefix: "ratelimit:ai",
    })
    : null;

/**
 * Rate limiter for form submissions
 * Limit: 5 submissions per minute per token
 */
export const formSubmissionRatelimit = redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "60 s"),
        analytics: true,
        prefix: "ratelimit:form",
    })
    : null;

/**
 * Rate limiter for request creation
 * Limit: 10 requests per minute per user
 */
export const requestCreationRatelimit = redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "60 s"),
        analytics: true,
        prefix: "ratelimit:create",
    })
    : null;

/**
 * Result type for rate limit checks
 */
export interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
}

/**
 * Check rate limit for a given identifier
 * Returns success: true if not rate limited, false if limited
 * Also returns limit info for response headers
 */
export async function checkRateLimit(
    limiter: Ratelimit | null,
    identifier: string
): Promise<RateLimitResult> {
    // If rate limiting not configured, allow all requests
    if (!limiter) {
        return {
            success: true,
            limit: -1,
            remaining: -1,
            reset: -1,
        };
    }

    const result = await limiter.limit(identifier);
    return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
    };
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
    if (result.limit === -1) {
        return {};
    }

    return {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.reset.toString(),
    };
}

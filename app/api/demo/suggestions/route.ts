import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { getAllSuggestions } from '@/lib/providers/suggestion-service';
import { UtilityCategory } from '@/types';
import { aiRatelimit, checkRateLimit, getRateLimitHeaders, isRateLimitUnavailable } from '@/lib/rate-limit';
import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import { getClientIp } from '@/lib/network/client-ip';
import { clearDemoChallengeCookie, createDemoChallenge, isDemoChallengeConfigured, verifyDemoChallenge } from '@/lib/security/demo-challenge';
import { enforceMaxRequestBodyBytes, invalidRequestBodyResponse } from '@/lib/security/api-response';

const DEMO_REQUEST_BODY_LIMIT_BYTES = 8 * 1024;
const demoSuggestionsBodySchema = z.object({
    address: z.string().trim().min(10).max(200),
    challengeToken: z.string().trim().min(10).max(200),
});

function getRequesterFingerprint(request: Request): string {
    const origin = (request.headers.get('origin') || 'unknown').slice(0, 200);
    const userAgent = (request.headers.get('user-agent') || 'unknown').slice(0, 500);
    return createHash('sha256').update(`${origin}|${userAgent}`).digest('hex').slice(0, 16);
}

export async function GET(request: Request) {
    const ip = getClientIp(request);
    const limiterKey = `${ip}:${getRequesterFingerprint(request)}:challenge`;
    const rateLimitResult = await checkRateLimit(aiRatelimit, limiterKey, { requirePersistent: process.env.NODE_ENV === 'production' });

    if (isRateLimitUnavailable(rateLimitResult)) {
        return NextResponse.json(
            { error: 'Temporarily unavailable. Please try again shortly.' },
            { status: 503 }
        );
    }

    if (!rateLimitResult.success) {
        return NextResponse.json(
            { error: 'Rate limit exceeded. Please slow down.' },
            { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
        );
    }

    if (process.env.NODE_ENV === 'production' && !isDemoChallengeConfigured()) {
        return NextResponse.json(
            { error: 'Server misconfigured' },
            { status: 503 }
        );
    }

    const challenge = createDemoChallenge(request.headers.get('user-agent'));
    const response = NextResponse.json(
        {
            challengeToken: challenge.nonce,
            expiresAt: challenge.expiresAt,
        },
        { headers: getRateLimitHeaders(rateLimitResult) }
    );
    response.headers.append('Set-Cookie', challenge.cookie);
    return response;
}

// Public API endpoint for demo - fetches AI suggestions for any address
export async function POST(request: Request) {
    try {
        const ip = getClientIp(request);
        const payloadTooLarge = enforceMaxRequestBodyBytes(request, DEMO_REQUEST_BODY_LIMIT_BYTES);
        if (payloadTooLarge) {
            return payloadTooLarge;
        }

        const rateLimitKey = `${ip}:${getRequesterFingerprint(request)}:suggestions`;
        const rateLimitResult = await checkRateLimit(aiRatelimit, rateLimitKey, { requirePersistent: process.env.NODE_ENV === 'production' });
        if (isRateLimitUnavailable(rateLimitResult)) {
            return NextResponse.json(
                { error: 'Temporarily unavailable. Please try again shortly.' },
                { status: 503 }
            );
        }

        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please slow down.' },
                {
                    status: 429,
                    headers: getRateLimitHeaders(rateLimitResult),
                }
            );
        }

        if (process.env.NODE_ENV === 'production' && !isDemoChallengeConfigured()) {
            return NextResponse.json(
                { error: 'Server misconfigured' },
                { status: 503 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const parsedBody = demoSuggestionsBodySchema.safeParse(body);
        if (!parsedBody.success) {
            return invalidRequestBodyResponse('INVALID_DEMO_REQUEST', 'Invalid demo request body');
        }

        const verification = verifyDemoChallenge(request, parsedBody.data.challengeToken);
        if (!verification.valid) {
            const response = NextResponse.json(
                { error: 'Challenge validation failed', code: 'CHALLENGE_FAILED' },
                { status: 403 }
            );
            response.headers.append('Set-Cookie', clearDemoChallengeCookie());
            return response;
        }

        // Default categories for demo
        const categories: UtilityCategory[] = UTILITY_CATEGORY_KEYS;

        // Fetch real AI suggestions
        const suggestions = await getAllSuggestions(parsedBody.data.address, categories);

        const response = NextResponse.json(
            { suggestions },
            { headers: getRateLimitHeaders(rateLimitResult) }
        );
        response.headers.append('Set-Cookie', clearDemoChallengeCookie());
        return response;
    } catch (error) {
        console.error('Demo suggestions error:', error);
        return NextResponse.json(
            { error: 'Failed to get suggestions' },
            { status: 500 }
        );
    }
}


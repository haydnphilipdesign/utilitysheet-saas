import { NextResponse } from 'next/server';
import { sql, isDbConfigured } from '@/lib/neon/db';
import { isRateLimitConfigured } from '@/lib/rate-limit';
import { isGeminiConfigured } from '@/lib/ai/gemini-client';

interface HealthCheck {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    checks: {
        database: boolean;
        ai: boolean;
        rateLimit: boolean;
    };
    version: string;
}

/**
 * Health check endpoint for monitoring
 * 
 * Returns 200 if all critical services are healthy
 * Returns 503 if any critical service is down
 * 
 * No authentication required
 */
export async function GET() {
    const checks = {
        database: false,
        ai: false,
        rateLimit: false,
    };

    // Check database connectivity
    if (isDbConfigured() && sql) {
        try {
            await sql`SELECT 1 as health_check`;
            checks.database = true;
        } catch {
            checks.database = false;
        }
    }

    // Check AI service configuration
    checks.ai = isGeminiConfigured();

    // Check rate limiting configuration
    checks.rateLimit = isRateLimitConfigured();

    // Determine overall status
    // Database is critical; AI and rate limiting are optional
    const isCriticalHealthy = checks.database;
    const isFullyHealthy = checks.database && checks.ai && checks.rateLimit;

    const healthCheck: HealthCheck = {
        status: isCriticalHealthy ? (isFullyHealthy ? 'healthy' : 'degraded') : 'unhealthy',
        timestamp: new Date().toISOString(),
        checks,
        version: process.env.npm_package_version || '0.1.0',
    };

    const httpStatus = isCriticalHealthy ? 200 : 503;

    return NextResponse.json(healthCheck, {
        status: httpStatus,
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
    });
}

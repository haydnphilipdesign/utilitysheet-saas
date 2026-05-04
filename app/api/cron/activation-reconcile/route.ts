import { NextResponse } from 'next/server';

import { reconcileAuthUsers } from '@/lib/activation/reconcile-auth-users';

export async function GET(request: Request) {
    const startTime = Date.now();
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
        console.error(JSON.stringify({
            level: 'error',
            message: 'Activation reconcile cron missing CRON_SECRET',
            route: '/api/cron/activation-reconcile',
        }));
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await reconcileAuthUsers({
            execute: true,
            scanAll: true,
            includeUnverified: false,
            limit: 200,
        });

        console.log(JSON.stringify({
            level: 'info',
            message: 'Activation reconcile cron completed',
            route: '/api/cron/activation-reconcile',
            scanned: result.scanned,
            eligible: result.eligibleCount,
            created: result.createdCount,
            skipped: result.skipped.length,
            failures: result.failures.length,
            durationMs: Date.now() - startTime,
        }));

        return NextResponse.json({
            success: true,
            scanned: result.scanned,
            eligible: result.eligibleCount,
            created: result.createdCount,
            skipped: result.skipped.length,
            failures: result.failures,
            durationMs: Date.now() - startTime,
        });
    } catch (error) {
        console.error(JSON.stringify({
            level: 'error',
            message: 'Activation reconcile cron failed',
            route: '/api/cron/activation-reconcile',
            error: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - startTime,
        }));
        return NextResponse.json(
            { error: 'Internal server error', durationMs: Date.now() - startTime },
            { status: 500 }
        );
    }
}

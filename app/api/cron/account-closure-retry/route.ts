import { NextResponse } from 'next/server';

import { runAccountClosure } from '@/lib/account/closure';
import { listStalledAccountClosures } from '@/lib/neon/queries';

const STALLED_AFTER_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 20;

/**
 * Finishes account closures that stopped part-way (for example, when Stack
 * Auth was unavailable). Closures that keep failing are logged for support.
 */
export async function GET(request: Request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.error(JSON.stringify({
            level: 'error',
            message: 'Account closure retry cron missing CRON_SECRET',
            route: '/api/cron/account-closure-retry',
        }));
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const stalled = await listStalledAccountClosures({
            olderThanMinutes: STALLED_AFTER_MINUTES,
            maxAttempts: MAX_ATTEMPTS,
            limit: BATCH_SIZE,
        });

        const summary = { scanned: stalled.length, closed: 0, stillClosing: 0, reverted: 0, stuck: 0 };
        for (const closure of stalled) {
            if (closure.exhausted) {
                summary.stuck += 1;
                console.error(JSON.stringify({
                    level: 'error',
                    message: 'Account closure stuck; needs support review',
                    route: '/api/cron/account-closure-retry',
                    accountId: closure.accountId,
                    step: closure.step,
                    attempts: closure.attemptCount,
                }));
                continue;
            }
            const result = await runAccountClosure(closure.accountId);
            if (result.status === 'closed') summary.closed += 1;
            else if (result.status === 'reverted') summary.reverted += 1;
            else summary.stillClosing += 1;
        }

        console.log(JSON.stringify({
            level: 'info',
            message: 'Account closure retry cron completed',
            route: '/api/cron/account-closure-retry',
            ...summary,
        }));
        return NextResponse.json(summary);
    } catch {
        console.error(JSON.stringify({
            level: 'error',
            message: 'Account closure retry cron failed',
            route: '/api/cron/account-closure-retry',
        }));
        return NextResponse.json({ error: 'Account closure retry failed' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { finishJobRun, startJobRun, type JobRunHandle } from '@/lib/ops/events';
import { getDueAutomaticReminderCandidates } from '@/lib/neon/queries/automatic-reminders';
import { executeSellerReminder, prepareSellerReminder } from '@/lib/reminders/seller-reminder';

const RESEND_PACING_DELAY_MS = 250;
const AUTOMATIC_REMINDER_USER_AGENT = 'UtilitySheet automatic reminder';

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends the one automatic seller reminder for accounts that turned on
 * "Remind sellers automatically". Uses the same claim, cooldown and outcome
 * record as manual reminders, so the two paths cannot double-send.
 */
export async function GET(request: Request) {
    const startTime = Date.now();
    let jobRun: JobRunHandle | null = null;

    try {
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
            console.error('CRON_SECRET environment variable not configured');
            return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
        }
        if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        jobRun = await startJobRun('seller_auto_reminders');
        const candidates = await getDueAutomaticReminderCandidates(25);

        let sent = 0;
        let skipped = 0;
        let failed = 0;

        for (let index = 0; index < candidates.length; index += 1) {
            const candidate = candidates[index];
            if (index > 0) {
                await sleep(RESEND_PACING_DELAY_MS);
            }

            const prepared = await prepareSellerReminder({
                requestId: candidate.request_id,
                adminPolicy: false,
                fallbackAgentName: candidate.owner_full_name || undefined,
            });
            if (!prepared.ok) {
                skipped += 1;
                continue;
            }

            const result = await executeSellerReminder({
                operationId: crypto.randomUUID(),
                prepared: prepared.prepared,
                actor: {
                    type: 'agent',
                    accountId: candidate.owner_account_id,
                    ipAddress: null,
                    userAgent: AUTOMATIC_REMINDER_USER_AGENT,
                    automatic: true,
                },
            });

            if (result.status === 'accepted' || result.status === 'accepted_unrecorded') {
                sent += 1;
            } else if (result.status === 'blocked') {
                // Another reminder is in flight or just went out; this request is covered.
                skipped += 1;
            } else {
                // Recorded as failed or unknown; either one keeps this request out of later runs.
                failed += 1;
            }
        }

        const summary = { processed: candidates.length, sent, skipped, failed };
        await finishJobRun(jobRun, failed > 0 ? 'partial' : 'success', summary);
        return NextResponse.json({ success: true, ...summary, durationMs: Date.now() - startTime });
    } catch (error) {
        if (jobRun) await finishJobRun(jobRun, 'failed');
        console.error('Automatic seller reminders cron failed:', error instanceof Error ? error.name : 'unknown');
        return NextResponse.json(
            { error: 'Internal server error', durationMs: Date.now() - startTime },
            { status: 500 }
        );
    }
}

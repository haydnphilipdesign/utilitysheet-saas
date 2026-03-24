import { NextResponse } from 'next/server';
import {
    getDueActivationOutreachCandidates,
    getOrCreateIntakeLink,
    recordActivationOutreachAttempt,
} from '@/lib/neon/queries';
import { sendActivationReminderEmail } from '@/lib/email/email-service';

function getAppBaseUrl() {
    return (
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
        'http://localhost:3000'
    );
}

export async function GET(request: Request) {
    const startTime = Date.now();

    try {
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret) {
            console.error('CRON_SECRET environment variable not configured');
            return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
        }

        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const candidates = await getDueActivationOutreachCandidates(50);
        if (candidates.length === 0) {
            return NextResponse.json({
                success: true,
                processed: 0,
                sent: 0,
                failed: 0,
                durationMs: Date.now() - startTime,
            });
        }

        const baseUrl = getAppBaseUrl();
        let sent = 0;
        let failed = 0;

        for (const candidate of candidates) {
            const intakeLink = await getOrCreateIntakeLink(candidate.account_id);
            if (!intakeLink) {
                failed += 1;
                await recordActivationOutreachAttempt({
                    accountId: candidate.account_id,
                    authUserId: candidate.auth_user_id,
                    email: candidate.email,
                    stage: candidate.stage,
                    status: 'failed',
                    metadata: { reason: 'missing_intake_link' },
                });
                continue;
            }

            const result = await sendActivationReminderEmail({
                toEmail: candidate.email,
                fullName: candidate.full_name || undefined,
                stage: candidate.stage,
                setupUrl: `${baseUrl}/onboarding`,
                dashboardUrl: `${baseUrl}/dashboard`,
                sellerLinkUrl: `${baseUrl}/i/${intakeLink.slug}`,
            });

            if (result.success) {
                sent += 1;
                await recordActivationOutreachAttempt({
                    accountId: candidate.account_id,
                    authUserId: candidate.auth_user_id,
                    email: candidate.email,
                    stage: candidate.stage,
                    status: 'sent',
                    metadata: { trigger: 'cron' },
                    sentAt: new Date(),
                });
            } else {
                failed += 1;
                await recordActivationOutreachAttempt({
                    accountId: candidate.account_id,
                    authUserId: candidate.auth_user_id,
                    email: candidate.email,
                    stage: candidate.stage,
                    status: 'failed',
                    metadata: { trigger: 'cron', reason: result.error || 'send_failed' },
                });
            }
        }

        return NextResponse.json({
            success: true,
            processed: candidates.length,
            sent,
            failed,
            durationMs: Date.now() - startTime,
        });
    } catch (error) {
        console.error('Activation re-engagement cron failed:', error);
        return NextResponse.json(
            { error: 'Internal server error', durationMs: Date.now() - startTime },
            { status: 500 }
        );
    }
}

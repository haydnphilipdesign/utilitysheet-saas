import { NextResponse } from 'next/server';
import { getAccountsWithWeeklySummaryEnabled, getWeeklyStats } from '@/lib/neon/queries';
import { sendWeeklySummaryEmail } from '@/lib/email/email-service';

// Concurrency limit to avoid overwhelming external services
const BATCH_SIZE = 10;

/**
 * Process a chunk of accounts in parallel
 */
async function processAccountBatch(accounts: any[]): Promise<{ email: string; success: boolean; error?: string }[]> {
    const results = await Promise.allSettled(
        accounts.map(async (account) => {
            if (!account.email) {
                return { email: 'unknown', success: false, error: 'No email' };
            }

            // Get weekly stats for this account
            const stats = await getWeeklyStats(
                account.id,
                account.active_organization_id || undefined
            );

            // Send the email
            const result = await sendWeeklySummaryEmail({
                tcEmail: account.email,
                tcName: account.full_name || undefined,
                stats,
            });

            return {
                email: account.email,
                success: result.success,
                error: result.error,
            };
        })
    );

    return results.map((result, index) => {
        if (result.status === 'fulfilled') {
            return result.value;
        }
        return {
            email: accounts[index]?.email || 'unknown',
            success: false,
            error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
        };
    });
}

/**
 * Weekly Summary Cron Job
 * 
 * This endpoint is called by Vercel Cron every Monday at 9am UTC.
 * It sends a weekly activity summary email to all users who have
 * enabled the weekly_summary notification preference.
 * 
 * Optimized to process accounts in parallel batches for better performance.
 * 
 * To manually trigger: 
 * curl -H "Authorization: Bearer CRON_SECRET" https://your-app.vercel.app/api/cron/weekly-summary
 */
export async function GET(request: Request) {
    const startTime = Date.now();

    try {
        // Verify the cron secret to prevent unauthorized access
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        // SECURITY: Require CRON_SECRET to be configured
        if (!cronSecret) {
            console.error('CRON_SECRET environment variable not configured');
            return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
        }

        if (authHeader !== `Bearer ${cronSecret}`) {
            console.warn('Unauthorized cron request attempt');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('Starting weekly summary cron job...');

        // Get all accounts with weekly summary enabled
        const accounts = await getAccountsWithWeeklySummaryEnabled();
        console.log(`Found ${accounts.length} accounts with weekly summary enabled`);

        if (accounts.length === 0) {
            return NextResponse.json({
                success: true,
                sent: 0,
                failed: 0,
                durationMs: Date.now() - startTime,
            });
        }

        // Process accounts in parallel batches
        const allResults: { email: string; success: boolean; error?: string }[] = [];

        for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
            const batch = accounts.slice(i, i + BATCH_SIZE);
            console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} accounts)...`);

            const batchResults = await processAccountBatch(batch);
            allResults.push(...batchResults);
        }

        const successCount = allResults.filter(r => r.success).length;
        const failureCount = allResults.filter(r => !r.success).length;
        const durationMs = Date.now() - startTime;

        console.log(`Weekly summary cron completed in ${durationMs}ms: ${successCount} sent, ${failureCount} failed`);

        return NextResponse.json({
            success: true,
            sent: successCount,
            failed: failureCount,
            durationMs,
            details: allResults,
        });
    } catch (error) {
        console.error('Weekly summary cron job failed:', error);
        return NextResponse.json(
            { error: 'Internal server error', durationMs: Date.now() - startTime },
            { status: 500 }
        );
    }
}


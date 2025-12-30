import { NextResponse } from 'next/server';
import { getAccountsWithWeeklySummaryEnabled, getWeeklyStats } from '@/lib/neon/queries';
import { sendWeeklySummaryEmail } from '@/lib/email/email-service';

/**
 * Weekly Summary Cron Job
 * 
 * This endpoint is called by Vercel Cron every Monday at 9am UTC.
 * It sends a weekly activity summary email to all users who have
 * enabled the weekly_summary notification preference.
 * 
 * To manually trigger: 
 * curl -H "Authorization: Bearer CRON_SECRET" https://your-app.vercel.app/api/cron/weekly-summary
 */
export async function GET(request: Request) {
    try {
        // Verify the cron secret to prevent unauthorized access
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        // In production, require the cron secret
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            console.log('Unauthorized cron request');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('Starting weekly summary cron job...');

        // Get all accounts with weekly summary enabled
        const accounts = await getAccountsWithWeeklySummaryEnabled();
        console.log(`Found ${accounts.length} accounts with weekly summary enabled`);

        const results: { email: string; success: boolean; error?: string }[] = [];

        // Send email to each account
        for (const account of accounts) {
            if (!account.email) {
                console.log(`Skipping account ${account.id}: no email`);
                continue;
            }

            try {
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

                results.push({
                    email: account.email,
                    success: result.success,
                    error: result.error,
                });

                console.log(`Sent weekly summary to ${account.email}: ${result.success ? 'success' : result.error}`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                results.push({
                    email: account.email,
                    success: false,
                    error: errorMessage,
                });
                console.error(`Failed to send weekly summary to ${account.email}:`, error);
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;

        console.log(`Weekly summary cron completed: ${successCount} sent, ${failureCount} failed`);

        return NextResponse.json({
            success: true,
            sent: successCount,
            failed: failureCount,
            details: results,
        });
    } catch (error) {
        console.error('Weekly summary cron job failed:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

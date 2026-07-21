import { NextResponse } from 'next/server';
import { getAccountSecurityContext, accountSecurityErrorResponse } from '@/lib/account/security';
import { getAccountDataExport, recordAccountSecurityEvent } from '@/lib/neon/queries';
import { accountExportRatelimit, checkRateLimit, getRateLimitHeaders, isRateLimitUnavailable } from '@/lib/rate-limit';

export async function GET() {
    try {
        const context = await getAccountSecurityContext({ requireRecentAuth: true });
        const rateLimit = await checkRateLimit(accountExportRatelimit, context.user.id, {
            requirePersistent: process.env.NODE_ENV === 'production',
        });
        if (isRateLimitUnavailable(rateLimit)) {
            return NextResponse.json({ error: 'Account export is temporarily unavailable.' }, { status: 503 });
        }
        if (!rateLimit.success) {
            return NextResponse.json(
                { error: 'Too many export requests. Please try again later.' },
                { status: 429, headers: getRateLimitHeaders(rateLimit) },
            );
        }

        const exportData = await getAccountDataExport(context.account.id as string);
        if (!exportData) {
            return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
        }

        await recordAccountSecurityEvent({
            accountId: context.account.id as string,
            action: 'account_data_exported',
        });

        const body = JSON.stringify({
            schemaVersion: 1,
            generatedAt: new Date().toISOString(),
            scope: 'personal-account-and-account-owned-records',
            exclusions: [
                'passwords and authentication secrets',
                'Stack, Stripe, and capability tokens',
                'raw IP addresses and user-agent strings',
                'other workspace members personal records',
            ],
            data: exportData,
        }, null, 2);

        return new NextResponse(body, {
            status: 200,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Disposition': `attachment; filename="utilitysheet-account-export-${new Date().toISOString().slice(0, 10)}.json"`,
                'Cache-Control': 'private, no-store, max-age=0',
                Pragma: 'no-cache',
                ...getRateLimitHeaders(rateLimit),
            },
        });
    } catch (error) {
        const response = accountSecurityErrorResponse(error);
        if (response) return response;
        console.error('Account export failed', error);
        return NextResponse.json({ error: 'Account export failed.' }, { status: 500 });
    }
}

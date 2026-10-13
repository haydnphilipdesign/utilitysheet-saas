import { NextResponse } from 'next/server';
import { MAINTENANCE_CODE, MAINTENANCE_HEADER, retryAfterSecondsFor } from '@/lib/maintenance/config';
import { resolveMaintenanceStatus } from '@/lib/maintenance/state';

/** The endpoints paused together by maintenance mode. */
export type MaintenanceSurface =
    | 'seller_submission'
    | 'seller_suggestions'
    | 'seller_suggestion_search'
    | 'seller_send_link'
    | 'packet_pdf';

// Shown as-is by pages loaded before this build, so each one stands on its own.
const MESSAGES: Record<MaintenanceSurface, string> = {
    seller_submission: 'We’re doing a short planned update, so this form can’t be sent right now. Your answers have not been sent yet. Please try again a little later.',
    seller_suggestions: 'Provider suggestions are paused for a short planned update. Please try again a little later.',
    seller_suggestion_search: 'Provider lookup is paused for a short planned update. Please try again a little later.',
    seller_send_link: 'Emailing this link is paused for a short planned update. This page’s web address is your link, so you can bookmark or copy it to come back later.',
    packet_pdf: 'PDF downloads are paused for a short planned update. Please try again a little later.',
};

function wantsHtml(request: Request | undefined): boolean {
    const accept = request?.headers.get('accept') ?? '';
    return accept.includes('text/html');
}

function maintenancePage(message: string): string {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Paused for maintenance | UtilitySheet</title>
<style>
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f8fafc;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
main{max-width:28rem;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;text-align:center}
h1{font-size:1.25rem;margin:0 0 12px}
p{font-size:.95rem;line-height:1.5;color:#475569;margin:0}
@media (prefers-color-scheme:dark){body{background:#0f172a;color:#f8fafc}main{background:#1e293b;border-color:#334155}p{color:#cbd5e1}}
</style>
</head>
<body>
<main>
<h1>Paused for maintenance</h1>
<p>${message}</p>
</main>
</body>
</html>`;
}

/**
 * The refusal for a paused endpoint, or null during ordinary operation.
 *
 * Call it first in the handler: before parameters, lookups, the rate limiter,
 * the request body and every side effect. The only thing read is the switch
 * itself: the environment setting, then the Admin switch (cached briefly).
 */
export async function maintenanceResponse(surface: MaintenanceSurface, request?: Request): Promise<NextResponse | null> {
    const now = Date.now();
    const status = await resolveMaintenanceStatus(now);
    if (!status.maintenance) return null;

    const headers = {
        'Retry-After': String(retryAfterSecondsFor(status.expectedBackAt, now)),
        'Cache-Control': 'no-store',
        [MAINTENANCE_HEADER]: '1',
    };

    // Only the PDF is reachable as a link; a person following it should not see JSON.
    if (surface === 'packet_pdf' && wantsHtml(request)) {
        return new NextResponse(maintenancePage(MESSAGES[surface]), {
            status: 503,
            headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
        });
    }

    return NextResponse.json(
        {
            error: MESSAGES[surface],
            code: MAINTENANCE_CODE,
            maintenance: true,
            surface,
            expectedBackAt: status.expectedBackAt,
        },
        { status: 503, headers }
    );
}

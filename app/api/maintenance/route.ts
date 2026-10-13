import { NextResponse } from 'next/server';
import { resolveMaintenanceStatus } from '@/lib/maintenance/state';

export const dynamic = 'force-dynamic';

// GET /api/maintenance - whether the paused endpoints are refusing requests on this deployment.
// Always 200 and never cached by clients. It reads the switch only (the environment setting,
// then the Admin switch, which each server instance caches briefly): no limiter and no session.
export async function GET() {
    const { maintenance, expectedBackAt } = await resolveMaintenanceStatus();
    return NextResponse.json({ maintenance, expectedBackAt }, { headers: { 'Cache-Control': 'no-store' } });
}

import { NextResponse } from 'next/server';
import { getMaintenanceStatus } from '@/lib/maintenance/config';

export const dynamic = 'force-dynamic';

// GET /api/maintenance - whether the paused endpoints are refusing requests on this deployment.
// Always 200 and never cached. It reads configuration only: no limiter, database or session.
export async function GET() {
    return NextResponse.json(getMaintenanceStatus(), { headers: { 'Cache-Control': 'no-store' } });
}

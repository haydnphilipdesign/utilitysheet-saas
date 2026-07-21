import { NextResponse } from 'next/server';
import { getAccountSecurityContext, accountSecurityErrorResponse } from '@/lib/account/security';
import { getAccountClosureReadiness, recordAccountSecurityEvent } from '@/lib/neon/queries';

export async function GET() {
    try {
        const context = await getAccountSecurityContext({ requireRecentAuth: true });
        const readiness = await getAccountClosureReadiness(
            context.account.id as string,
            context.user.primaryEmail!,
        );
        if (!readiness) {
            return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
        }

        const workspaces = readiness.workspaces as Array<Record<string, unknown>>;
        const blockers: string[] = [];
        const personal = readiness.personalSubscription as Record<string, unknown>;
        if (personal.subscription_status === 'pro' && personal.subscription_id) {
            blockers.push('Your personal Pro subscription must be canceled and become inactive first.');
        }
        for (const workspace of workspaces) {
            const name = String(workspace.name || 'Workspace');
            const isTeamBilled = workspace.subscription_status === 'team' && Boolean(workspace.subscription_id);
            const memberCount = Number(workspace.member_count) || 0;
            const adminCount = Number(workspace.admin_count) || 0;
            const isAdmin = workspace.role === 'admin';
            if (isAdmin && memberCount > 1 && adminCount <= 1) {
                blockers.push(`${name} needs another admin before your membership can be resolved.`);
            }
            if (isTeamBilled && memberCount <= 1) {
                blockers.push(`${name}'s Team subscription must become inactive before closure.`);
            }
            if (memberCount > 1 && (Number(workspace.owned_profile_count) > 0 || Number(workspace.owned_request_count) > 0)) {
                blockers.push(`${name} has shared assets that require an approved transfer policy.`);
            }
        }
        if (Number((readiness.referralRecords as Record<string, unknown>).unapplied_earned_count) > 0) {
            blockers.push('Unapplied referral credits require an approved forfeiture/retention policy.');
        }

        await recordAccountSecurityEvent({
            accountId: context.account.id as string,
            action: 'closure_readiness_viewed',
            metadata: { blockerCount: blockers.length, workspaceCount: workspaces.length },
        });

        return NextResponse.json({
            executableClosureAvailable: false,
            readyForFutureClosure: blockers.length === 0,
            blockers,
            ...readiness,
        }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (error) {
        const response = accountSecurityErrorResponse(error);
        if (response) return response;
        console.error('Closure readiness failed', error);
        return NextResponse.json({ error: 'Closure readiness could not be loaded.' }, { status: 500 });
    }
}

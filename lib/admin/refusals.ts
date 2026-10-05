/**
 * Operator-facing explanations for outcomes decided inside the atomic write
 * statements (lib/neon/queries/admin-writes.ts). The SQL decision is
 * authoritative; this module only words it.
 */
import type {
    AccountPlanOutcome,
    AccountRoleOutcome,
    RequestSellerOutcome,
    RequestStatusOutcome,
} from '@/lib/neon/queries/admin-writes';

/** A deliberate, operator-safe refusal (policy block, stale edit, no-op, missing target). */
export class AdminActionRefusal extends Error {
    constructor(public readonly code: string, message: string) {
        super(message);
        this.name = 'AdminActionRefusal';
    }
}

export const STALE_EDIT_MESSAGE =
    'This record changed after you opened it. Nothing was saved. Refresh the page and review it again.';

const ACTOR_NOT_ADMIN = new AdminActionRefusal('UNAUTHORIZED', 'Admin access required');

export function accountRoleRefusal(
    outcome: Exclude<AccountRoleOutcome, 'OK'>,
    kind: 'role' | 'ban' | 'unban',
    attemptedRole: string
): AdminActionRefusal {
    switch (outcome) {
        case 'NOT_FOUND':
            return new AdminActionRefusal('NOT_FOUND', 'User not found');
        case 'ACTOR_NOT_ADMIN':
            return ACTOR_NOT_ADMIN;
        case 'ACCOUNT_NOT_ACTIVE':
            return new AdminActionRefusal(
                'ACCOUNT_NOT_ACTIVE',
                'This account is closing or closed. Account controls are read-only.'
            );
        case 'STALE':
            return new AdminActionRefusal('STALE', STALE_EDIT_MESSAGE);
        case 'NO_OP':
            if (kind === 'ban') return new AdminActionRefusal('NO_OP_BAN', 'User is already banned.');
            if (kind === 'unban') return new AdminActionRefusal('NO_OP_UNBAN', 'User is not banned.');
            return new AdminActionRefusal('NO_OP_ROLE', `User already has role "${attemptedRole}".`);
        case 'ADMIN_PROMOTION_DISABLED':
            return new AdminActionRefusal(
                'ADMIN_PROMOTION_DISABLED',
                'Admin promotion is disabled in this user management flow.'
            );
        case 'SELF_BLOCKED':
            return kind === 'ban'
                ? new AdminActionRefusal('SELF_BAN_BLOCKED', 'You cannot ban your own account.')
                : new AdminActionRefusal('SELF_ROLE_CHANGE_BLOCKED', 'You cannot remove your own admin access.');
        case 'LAST_ADMIN_PROTECTED':
            return new AdminActionRefusal(
                'LAST_ADMIN_PROTECTED',
                kind === 'ban'
                    ? 'Cannot ban the last admin account.'
                    : 'Cannot remove admin access from the last admin account.'
            );
    }
}

export function accountPlanRefusal(
    outcome: Exclude<AccountPlanOutcome, 'OK'>,
    attemptedPlan: string
): AdminActionRefusal {
    switch (outcome) {
        case 'NOT_FOUND':
            return new AdminActionRefusal('NOT_FOUND', 'User not found');
        case 'ACTOR_NOT_ADMIN':
            return ACTOR_NOT_ADMIN;
        case 'ACCOUNT_NOT_ACTIVE':
            return new AdminActionRefusal(
                'ACCOUNT_NOT_ACTIVE',
                'This account is closing or closed. Account controls are read-only.'
            );
        case 'ORG_TEAM_MANAGED_PLAN':
            return new AdminActionRefusal('ORG_TEAM_MANAGED_PLAN', 'Plan is managed by the active Teams organization.');
        case 'STALE':
            return new AdminActionRefusal('STALE', STALE_EDIT_MESSAGE);
        case 'NO_OP':
            return new AdminActionRefusal('NO_OP_PLAN', `User already has "${attemptedPlan}" plan.`);
    }
}

export const REQUEST_STATUS_REFUSALS: Record<Exclude<RequestStatusOutcome, 'OK'>, string> = {
    NOT_FOUND: 'Request not found',
    ACTOR_NOT_ADMIN: 'Admin access required',
    REQUEST_DELETED: 'This request was deleted. Deleted requests cannot be corrected here.',
    STALE: STALE_EDIT_MESSAGE,
    NO_OP: 'The request already has that status.',
    UNMETERED_SUBMITTED_REVIEW:
        'This request shows Submitted without a recorded first submission (a test drive or an older record). It needs manual review and cannot be changed with this control.',
    SUBMISSION_REQUIRES_SELLER:
        'Submitted cannot be set by hand. A submission is recorded only when the seller completes the form, which is what meters usage and produces the packet.',
    SUBMITTED_LOCKED:
        'This request has a recorded submission and cannot be reopened here. Correct its details with submitted-sheet editing instead.',
    METERED_RESTORE_ONLY:
        'This request has a recorded submission, so its status can only be restored to Submitted.',
};

export function requestStatusRefusal(outcome: Exclude<RequestStatusOutcome, 'OK'>): AdminActionRefusal {
    return new AdminActionRefusal(outcome === 'ACTOR_NOT_ADMIN' ? 'UNAUTHORIZED' : outcome, REQUEST_STATUS_REFUSALS[outcome]);
}

export function requestSellerRefusal(outcome: Exclude<RequestSellerOutcome, 'OK'>): AdminActionRefusal {
    switch (outcome) {
        case 'NOT_FOUND':
            return new AdminActionRefusal('NOT_FOUND', 'Request not found');
        case 'ACTOR_NOT_ADMIN':
            return ACTOR_NOT_ADMIN;
        case 'REQUEST_DELETED':
            return new AdminActionRefusal('REQUEST_DELETED', 'This request was deleted. Deleted requests cannot be edited here.');
        case 'STALE':
            return new AdminActionRefusal('STALE', STALE_EDIT_MESSAGE);
        case 'NO_OP':
            return new AdminActionRefusal('NO_OP', 'Seller contact details are unchanged.');
    }
}

/**
 * Status choices the correction control may offer for a request. Mirrors the
 * SQL decision so the dialog can explain itself; the server remains authoritative.
 */
export function allowedStatusCorrections(request: {
    status: string;
    isMetered: boolean;
    isDeleted: boolean;
}): { options: Array<'draft' | 'sent' | 'in_progress' | 'submitted'>; explanation: string } {
    if (request.isDeleted) {
        return { options: [], explanation: REQUEST_STATUS_REFUSALS.REQUEST_DELETED };
    }
    if (!request.isMetered) {
        if (request.status === 'submitted') {
            return { options: [], explanation: REQUEST_STATUS_REFUSALS.UNMETERED_SUBMITTED_REVIEW };
        }
        return {
            options: (['draft', 'sent', 'in_progress'] as const).filter((status) => status !== request.status),
            explanation:
                'Corrections move a request between Draft, Sent and In progress. Submitted is recorded only when the seller completes the form.',
        };
    }
    if (request.status === 'submitted') {
        return { options: [], explanation: REQUEST_STATUS_REFUSALS.SUBMITTED_LOCKED };
    }
    return { options: ['submitted'], explanation: REQUEST_STATUS_REFUSALS.METERED_RESTORE_ONLY };
}

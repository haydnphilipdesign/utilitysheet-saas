export type AdminWorkspaceInvitation = {
    id: string;
    email: string;
    role: 'admin' | 'member';
    created_at: string;
    expires_at: string;
    accepted_at: string | null;
    inviter_name: string | null;
    inviter_email: string | null;
};

export type AdminInvitationStatus = 'accepted' | 'pending' | 'expired';

export function getAdminInvitationStatus(
    invitation: Pick<AdminWorkspaceInvitation, 'accepted_at' | 'expires_at'>,
    now: Date = new Date(),
): AdminInvitationStatus {
    if (invitation.accepted_at) return 'accepted';
    return new Date(invitation.expires_at).getTime() > now.getTime() ? 'pending' : 'expired';
}

export function countAdminInvitations(invitations: AdminWorkspaceInvitation[], now: Date = new Date()) {
    const counts: Record<AdminInvitationStatus, number> = { accepted: 0, pending: 0, expired: 0 };
    for (const invitation of invitations) counts[getAdminInvitationStatus(invitation, now)] += 1;
    return counts;
}

/**
 * Seats as the customer's own Billing page counts them: members plus pending
 * invitations. Seats only mean something on a Team workspace.
 */
export function summarizeWorkspaceSeats(input: {
    entitlement: string | null;
    seatQuantity: number | null;
    memberCount: number;
    pendingInvitations: number;
}) {
    const seats = input.seatQuantity || 0;
    const inUse = input.memberCount + input.pendingInvitations;
    const isTeam = input.entitlement === 'team';
    const members = `${input.memberCount} ${input.memberCount === 1 ? 'member' : 'members'}`;
    const pending = `${input.pendingInvitations} pending ${input.pendingInvitations === 1 ? 'invitation' : 'invitations'}`;

    return {
        seats,
        inUse,
        detail: `${members} and ${pending}`,
        /** More people than paid seats. Nobody loses access; the customer is paying for fewer seats than they use. */
        membersOverSeats: isTeam && input.memberCount > seats,
    };
}

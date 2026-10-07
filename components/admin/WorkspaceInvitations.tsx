import { Badge } from '@/components/ui/badge';
import { formatAdminDate } from '@/lib/admin/date-format';
import {
    countAdminInvitations,
    getAdminInvitationStatus,
    type AdminInvitationStatus,
    type AdminWorkspaceInvitation,
} from '@/lib/admin/workspace-team';

const STATUS_LABELS: Record<AdminInvitationStatus, string> = {
    accepted: 'Accepted',
    pending: 'Pending',
    expired: 'Expired',
};

const STATUS_VARIANTS: Record<AdminInvitationStatus, 'default' | 'secondary' | 'outline'> = {
    accepted: 'default',
    pending: 'secondary',
    expired: 'outline',
};

/** Every invitation a workspace has sent, newest first. Read-only. */
export function WorkspaceInvitations({ invitations, now = new Date() }: {
    invitations: AdminWorkspaceInvitation[];
    now?: Date;
}) {
    const counts = countAdminInvitations(invitations, now);

    return (
        <div>
            <h3 className="text-lg font-medium mb-1">Invitations ({invitations.length})</h3>
            <p className="mb-4 text-sm text-muted-foreground">
                {invitations.length
                    ? `${counts.accepted} accepted, ${counts.pending} pending, ${counts.expired} expired. Only pending invitations hold a seat.`
                    : 'This workspace has not invited anyone.'}
            </p>
            {invitations.length > 0 && (
                <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/50 text-left">
                                <th className="p-4 font-medium">Invited email</th>
                                <th className="p-4 font-medium">Role</th>
                                <th className="p-4 font-medium">Status</th>
                                <th className="p-4 font-medium">First sent</th>
                                <th className="p-4 font-medium">Invited by</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invitations.map((invitation) => {
                                const status = getAdminInvitationStatus(invitation, now);
                                return (
                                    <tr key={invitation.id} className="border-b last:border-0 hover:bg-muted/50">
                                        <td className="p-4 font-medium">{invitation.email}</td>
                                        <td className="p-4">
                                            <Badge variant={invitation.role === 'admin' ? 'default' : 'outline'}>{invitation.role}</Badge>
                                        </td>
                                        <td className="p-4">
                                            <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
                                            <span className="mt-1 block text-xs text-muted-foreground">
                                                {status === 'accepted'
                                                    ? `Joined ${formatAdminDate(invitation.accepted_at)}`
                                                    : status === 'pending'
                                                        ? `Expires ${formatAdminDate(invitation.expires_at)}`
                                                        : `Expired ${formatAdminDate(invitation.expires_at)}`}
                                            </span>
                                        </td>
                                        <td className="p-4 text-muted-foreground">{formatAdminDate(invitation.created_at)}</td>
                                        <td className="p-4 text-muted-foreground">
                                            {invitation.inviter_name || invitation.inviter_email || 'No longer on record'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

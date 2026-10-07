'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

type PendingInvitation = {
    id: string;
    workspaceName: string;
    invitedByName: string | null;
    url: string;
};

/** Tells a signed-in person about a workspace invitation they have not accepted yet. */
export function PendingInvitationBanner() {
    const [invitations, setInvitations] = useState<PendingInvitation[]>([]);

    useEffect(() => {
        let cancelled = false;
        fetch('/api/organization/invites/mine')
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => {
                if (cancelled || !Array.isArray(data?.invitations)) return;
                setInvitations(data.invitations.filter((invitation: PendingInvitation) => (
                    typeof invitation?.url === 'string' && invitation.url.startsWith('/invite/')
                )));
            })
            // The invitation email still works; this is only a second way in.
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []);

    if (invitations.length === 0) return null;

    return (
        <div className="mb-6 space-y-2">
            {invitations.map((invitation) => (
                <div
                    key={invitation.id}
                    role="status"
                    className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                    <div className="flex min-w-0 items-start gap-3">
                        <Users className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                        <p className="min-w-0 break-words text-sm text-foreground">
                            <span className="font-medium">
                                {invitation.invitedByName ? `${invitation.invitedByName} invited you` : 'You’ve been invited'} to
                                join {invitation.workspaceName}.
                            </span>{' '}
                            <span className="text-muted-foreground">You haven’t joined yet.</span>
                        </p>
                    </div>
                    <Link href={invitation.url} className="shrink-0">
                        <Button size="sm" className="w-full sm:w-auto">View invitation</Button>
                    </Link>
                </div>
            ))}
        </div>
    );
}

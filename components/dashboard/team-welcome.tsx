'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type TeamWelcomeWorkspace = {
    id: string;
    name?: string | null;
    role?: 'admin' | 'member' | null;
    subscription_status?: string | null;
};

const seenKey = (workspaceId: string) => `utilitysheet:team-welcome-seen:${workspaceId}`;

const subscribeToNothing = () => () => undefined;

function joinNames(names: string[]) {
    if (names.length <= 1) return names[0] || '';
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Shown once to someone who joined a Teams workspace as a member: what is
 * shared, what stays theirs, and who runs the workspace.
 */
export function TeamWelcome({ workspace, hasOtherWorkspaces }: {
    workspace: TeamWelcomeWorkspace | null;
    hasOtherWorkspaces: boolean;
}) {
    const workspaceId = workspace?.id || null;
    const applies = Boolean(workspaceId) && workspace?.role === 'member' && workspace?.subscription_status === 'team';
    // Read from the browser only; the server render and the first paint show nothing.
    const seenBefore = useSyncExternalStore(
        subscribeToNothing,
        () => {
            if (!workspaceId) return true;
            try {
                return window.localStorage.getItem(seenKey(workspaceId)) === '1';
            } catch {
                // Without storage the welcome simply shows again next time.
                return false;
            }
        },
        () => true,
    );
    const [dismissedId, setDismissedId] = useState<string | null>(null);
    const [admins, setAdmins] = useState<string[]>([]);
    const visible = applies && !seenBefore && dismissedId !== workspaceId;

    useEffect(() => {
        if (!visible) return;

        let cancelled = false;
        fetch('/api/organization/members')
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => {
                if (cancelled || !Array.isArray(data?.members)) return;
                setAdmins(data.members
                    .filter((member: { member_role?: string }) => member.member_role === 'admin')
                    .map((member: { full_name?: string | null; email?: string }) => member.full_name || member.email || '')
                    .filter(Boolean)
                    .slice(0, 3));
            })
            // The welcome reads fine without names.
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [visible, workspaceId]);

    if (!visible || !workspaceId) return null;

    const dismiss = () => {
        try {
            window.localStorage.setItem(seenKey(workspaceId), '1');
        } catch {
            // Hidden for this visit either way.
        }
        setDismissedId(workspaceId);
    };

    return (
        <section
            aria-labelledby="team-welcome-title"
            className="rounded-lg border border-primary/30 bg-primary/5 p-4 sm:p-5"
        >
            <div className="flex items-start gap-3">
                <Users className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 space-y-3">
                    <h2 id="team-welcome-title" className="break-words text-base font-semibold text-foreground">
                        Welcome to {workspace?.name || 'your team’s workspace'}
                    </h2>
                    <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                        <li>
                            <span className="text-foreground">Requests and Branding Profiles are shared.</span>{' '}
                            You can see and work on your teammates’ requests, and they can see yours.
                        </li>
                        <li>
                            <span className="text-foreground">Seller forms are your own.</span>{' '}
                            Each person has their own seller link, and you’re emailed when a seller submits through yours.
                        </li>
                        <li>
                            <span className="text-foreground">
                                {admins.length > 0
                                    ? `${joinNames(admins)} ${admins.length === 1 ? 'manages' : 'manage'} people, seats and billing.`
                                    : 'Workspace admins manage people, seats and billing.'}
                            </span>{' '}
                            You can see everyone in Settings, under Workspace &amp; Team.
                        </li>
                        {hasOtherWorkspaces && (
                            <li>
                                <span className="text-foreground">Your own workspace is still there.</span>{' '}
                                Switch between workspaces from the account menu at the top right.
                            </li>
                        )}
                    </ul>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Link href="/dashboard/requests">
                            <Button size="sm" className="w-full sm:w-auto">See your team’s requests</Button>
                        </Link>
                        <Button size="sm" variant="outline" onClick={dismiss}>Got it</Button>
                    </div>
                </div>
            </div>
        </section>
    );
}

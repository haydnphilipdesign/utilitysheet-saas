'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { stackClientApp } from '@/lib/stack/client';

type Invitation = {
    status: 'open' | 'expired' | 'accepted';
    workspaceName: string;
    invitedByName: string | null;
    invitedEmail: string;
    role: 'admin' | 'member';
    expiresAt: string | null;
    workspaceOnTeams: boolean;
    viewer: {
        signedIn: boolean;
        email: string | null;
        emailMatches: boolean;
        isMember: boolean;
        organizationId: string | null;
    };
};

type View =
    | { kind: 'loading' }
    | { kind: 'load_error' }
    | { kind: 'not_found' }
    | { kind: 'ready'; invitation: Invitation }
    | { kind: 'joined'; workspaceName: string };

type Action = 'join' | 'open' | 'switch' | null;

function formatDate(value: string | null) {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
        : null;
}

export default function InvitePage() {
    const router = useRouter();
    const params = useParams<{ token: string }>();
    const token = params?.token;

    const [view, setView] = useState<View>({ kind: 'loading' });
    const [action, setAction] = useState<Action>(null);
    const [problem, setProblem] = useState('');

    const invitePath = `/invite/${token}`;
    const signInHref = `/auth/login?next=${encodeURIComponent(invitePath)}`;
    const signUpHref = `/auth/signup?next=${encodeURIComponent(invitePath)}`;

    const load = useCallback(async () => {
        if (!token) return;
        setView({ kind: 'loading' });
        setProblem('');
        try {
            const response = await fetch(`/api/organization/invites/lookup?token=${encodeURIComponent(token)}`);
            if (response.status === 404) {
                setView({ kind: 'not_found' });
                return;
            }
            const data = await response.json().catch(() => null) as Invitation | null;
            if (!response.ok || !data?.status || !data.viewer) throw new Error('Invitation not loaded');
            setView({ kind: 'ready', invitation: data });
        } catch {
            setView({ kind: 'load_error' });
        }
    }, [token]);

    useEffect(() => {
        void load();
    }, [load]);

    async function join(invitation: Invitation) {
        setAction('join');
        setProblem('');
        const inviter = invitation.invitedByName || 'the person who invited you';
        try {
            const response = await fetch('/api/organization/invites/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });
            if (response.status === 401) {
                router.push(signInHref);
                return;
            }
            const data = await response.json().catch(() => ({})) as { error?: string };
            if (response.ok) {
                setView({ kind: 'joined', workspaceName: invitation.workspaceName });
                setTimeout(() => {
                    router.push('/dashboard');
                    router.refresh();
                }, 1400);
                return;
            }
            if (data.error === 'No seats available') {
                setProblem(`${invitation.workspaceName} has no free seats right now. Ask ${inviter} to add a seat, then open this link again.`);
            } else if (data.error === 'Team plan required') {
                setProblem(`${invitation.workspaceName} isn’t on a Teams plan right now, so it can’t add people. Ask ${inviter} to check the plan, then open this link again.`);
            } else if (data.error === 'Invite expired' || data.error === 'Invite already accepted' || data.error === 'Email mismatch' || data.error === 'Invite not found') {
                // The invitation changed while this page was open; show what it is now.
                await load();
            } else {
                setProblem('We couldn’t add you to the workspace. Try again.');
            }
        } catch {
            setProblem('We couldn’t add you to the workspace. Check your connection and try again.');
        }
        setAction(null);
    }

    async function openWorkspace(organizationId: string | null) {
        setAction('open');
        setProblem('');
        try {
            if (organizationId) {
                const response = await fetch('/api/account/active-organization', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ organizationId }),
                });
                if (!response.ok) throw new Error('Workspace not opened');
            }
            router.push('/dashboard');
            router.refresh();
        } catch {
            setProblem('We couldn’t open the workspace. Try again.');
            setAction(null);
        }
    }

    async function switchAccount() {
        setAction('switch');
        setProblem('');
        try {
            await stackClientApp.signOut();
        } catch {
            // Sign-in below still asks for the right account.
        }
        router.push(signInHref);
        router.refresh();
    }

    let icon = <Users className="h-5 w-5 text-muted-foreground" aria-hidden="true" />;
    let title = 'You’re invited';
    let body: React.ReactNode = null;
    let actions: React.ReactNode = null;

    if (view.kind === 'loading') {
        icon = <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />;
        title = 'Opening your invitation';
        body = <p role="status">One moment…</p>;
    } else if (view.kind === 'load_error') {
        icon = <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />;
        title = 'We couldn’t load this invitation';
        body = <p>Nothing has changed. Check your connection and try again.</p>;
        actions = <Button className="w-full" onClick={() => void load()}>Try again</Button>;
    } else if (view.kind === 'not_found') {
        icon = <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />;
        title = 'This invitation link isn’t valid';
        body = (
            <p>
                It may have been canceled or replaced by a newer one. Use the link in the most recent
                invitation email, or ask the person who invited you to send it again.
            </p>
        );
        actions = <Button variant="outline" className="w-full" onClick={() => router.push('/dashboard')}>Go to UtilitySheet</Button>;
    } else if (view.kind === 'joined') {
        icon = <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />;
        title = `You’ve joined ${view.workspaceName}`;
        body = (
            <p role="status">
                Opening the workspace now. If you have other workspaces, you can switch between them from
                the account menu at the top right.
            </p>
        );
    } else {
        const { invitation } = view;
        const { viewer } = invitation;
        const workspace = invitation.workspaceName;
        const inviter = invitation.invitedByName || 'the person who invited you';
        const expires = formatDate(invitation.expiresAt);
        const busy = action !== null;

        if (viewer.isMember) {
            icon = <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />;
            title = `You’re already in ${workspace}`;
            body = <p>There’s nothing more to do. Open the workspace to see your team’s requests.</p>;
            actions = (
                <Button className="w-full" onClick={() => void openWorkspace(viewer.organizationId)} disabled={busy}>
                    {action === 'open' && <Loader2 className="animate-spin" />}
                    Open {workspace}
                </Button>
            );
        } else if (invitation.status === 'expired') {
            icon = <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />;
            title = 'This invitation has expired';
            body = (
                <p>
                    Your invitation to {workspace} {expires ? `expired on ${expires}` : 'has expired'}. Ask {inviter} to
                    send a new one. They can do that in Settings, under Workspace &amp; Team.
                </p>
            );
            actions = viewer.signedIn ? (
                <Button variant="outline" className="w-full" onClick={() => router.push('/dashboard')}>Go to your dashboard</Button>
            ) : null;
        } else if (invitation.status === 'accepted') {
            icon = <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />;
            title = 'This invitation has already been used';
            body = viewer.signedIn ? (
                <p>
                    It was used to join {workspace} with {invitation.invitedEmail}. You’re signed in
                    as {viewer.email || 'a different account'}, which isn’t in that workspace.
                </p>
            ) : (
                <p>If you’ve already joined {workspace}, sign in with {invitation.invitedEmail} to open it.</p>
            );
            actions = viewer.signedIn ? (
                <Button className="w-full" onClick={() => void switchAccount()} disabled={busy}>
                    {action === 'switch' && <Loader2 className="animate-spin" />}
                    Sign out and use {invitation.invitedEmail}
                </Button>
            ) : (
                <Button className="w-full" onClick={() => router.push(signInHref)}>Sign in</Button>
            );
        } else {
            title = `Join ${workspace} on UtilitySheet`;
            const intro = (
                <p>
                    {invitation.invitedByName ? `${invitation.invitedByName} invited you` : 'You’ve been invited'} to
                    work in <span className="font-medium text-foreground">{workspace}</span>{' '}
                    {invitation.role === 'admin' ? 'as an admin' : 'as a member'}. You’ll share its requests
                    and Branding Profiles with the rest of the team.
                </p>
            );
            if (!viewer.signedIn) {
                body = (
                    <>
                        {intro}
                        <p>
                            Create an account or sign in with{' '}
                            <span className="break-all font-medium text-foreground">{invitation.invitedEmail}</span>.
                            The invitation only works with that address.
                            {expires ? ` It expires on ${expires}.` : ''}
                        </p>
                    </>
                );
                actions = (
                    <>
                        <Button className="w-full" onClick={() => router.push(signUpHref)}>Create an account</Button>
                        <Button variant="outline" className="w-full" onClick={() => router.push(signInHref)}>
                            I already have an account
                        </Button>
                    </>
                );
            } else if (!viewer.emailMatches) {
                icon = <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />;
                body = (
                    <>
                        {intro}
                        <p>
                            This invitation is for{' '}
                            <span className="break-all font-medium text-foreground">{invitation.invitedEmail}</span>, and
                            you’re signed in as{' '}
                            <span className="break-all font-medium text-foreground">{viewer.email || 'a different account'}</span>.
                            Sign in with the invited address to join, or ask {inviter} to invite the address you use.
                        </p>
                    </>
                );
                actions = (
                    <>
                        <Button className="w-full" onClick={() => void switchAccount()} disabled={busy}>
                            {action === 'switch' && <Loader2 className="animate-spin" />}
                            Sign out and switch account
                        </Button>
                        <Button variant="outline" className="w-full" onClick={() => router.push('/dashboard')} disabled={busy}>
                            Stay signed in
                        </Button>
                    </>
                );
            } else {
                body = (
                    <>
                        {intro}
                        <p>
                            You’re signed in as{' '}
                            <span className="break-all font-medium text-foreground">{viewer.email}</span>. Anything you
                            already have in UtilitySheet stays in your own workspace.
                        </p>
                    </>
                );
                actions = (
                    <Button className="w-full" onClick={() => void join(invitation)} disabled={busy}>
                        {action === 'join' && <Loader2 className="animate-spin" />}
                        {action === 'join' ? 'Joining…' : `Join ${workspace}`}
                    </Button>
                );
            }
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-background px-4 py-8">
            <Card className="w-full max-w-md border-border bg-card/80 backdrop-blur-xl shadow-2xl">
                <CardHeader className="space-y-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted/40">
                        {icon}
                    </div>
                    <CardTitle className="text-foreground">
                        <h1 className="break-words text-xl font-semibold leading-snug sm:text-2xl">{title}</h1>
                    </CardTitle>
                    <CardDescription className="sr-only">Workspace invitation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-3 text-sm leading-6 text-muted-foreground">{body}</div>
                    {problem && (
                        <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                            {problem}
                        </p>
                    )}
                    {actions && <div className="flex flex-col gap-2">{actions}</div>}
                </CardContent>
            </Card>
        </div>
    );
}

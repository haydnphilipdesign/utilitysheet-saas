'use client';

import { useState } from 'react';
import { Bell, Check, Copy, CreditCard, Loader2, RefreshCw, Shield, UserPlus, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { InlineStatus, LoadError, LoadingRows, Note, SettingsSection } from './settings-ui';
import type {
    ActiveOrganization,
    InviteLink,
    LoadState,
    OrganizationMemberRow,
    PendingOrganizationInvite,
    SaveState,
    SeatUsage,
} from './types';

// 'muted' is for an outcome we can't confirm: no green check, not an error either.
type Notice = { tone: 'saved' | 'error' | 'muted'; text: string } | null;

type Confirmation = {
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel?: string;
    destructive?: boolean;
    run: () => Promise<void>;
};

// The API's own wording says "organization" and "user"; the product says "workspace".
const FRIENDLY_ERRORS: Record<string, string> = {
    'Valid email is required': 'Enter a valid email address.',
    'No seats available': 'All of your seats are in use. Add seats in Billing or cancel a pending invitation, then try again.',
    'Team plan required': 'Invitations need a Teams plan.',
    'Organization must have at least one admin': 'A workspace needs at least one admin, so this role can’t be changed.',
    'Cannot remove the last admin': 'A workspace needs at least one admin, so this person can’t be removed.',
    'Only organization admins can manage members': 'Only workspace admins can change roles or remove members.',
    'Only organization admins can manage invites': 'Only workspace admins can manage invitations.',
    'Pending invitation not found': 'That invitation is no longer pending. The list below is up to date.',
};

function friendlyError(data: { error?: unknown; message?: unknown }, fallback: string, email?: string) {
    const error = typeof data.error === 'string' ? data.error : '';
    if (error === 'User is already a member of this organization') {
        return `${email || 'That person'} is already a member of this workspace.`;
    }
    if (FRIENDLY_ERRORS[error]) return FRIENDLY_ERRORS[error];
    if (typeof data.message === 'string' && data.message) return data.message;
    return error && error !== 'Internal server error' ? error : fallback;
}

function plural(count: number, word: string) {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function formatDate(value: string) {
    return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function NoticeLine({ notice }: { notice: Notice }) {
    return notice ? <InlineStatus tone={notice.tone}>{notice.text}</InlineStatus> : null;
}

export function WorkspaceTeam({
    accountState, onRetryAccount, accountId, organization, isTeam, isAdmin,
    workspaceName, onWorkspaceNameChange, onOrganizationUpdated,
    notifyAdmins, onNotifyAdminsChange,
    teamState, members, seatUsage, invites, onRefresh,
    inviteLink, onInviteLink, onOpenBilling,
}: {
    accountState: LoadState;
    onRetryAccount: () => void;
    accountId: string | null;
    organization: ActiveOrganization | null;
    isTeam: boolean;
    isAdmin: boolean;
    workspaceName: string;
    onWorkspaceNameChange: (name: string) => void;
    onOrganizationUpdated: (organization: Partial<ActiveOrganization>) => void;
    notifyAdmins: boolean;
    onNotifyAdminsChange: (value: boolean, settings?: Record<string, unknown> | null) => void;
    teamState: LoadState;
    members: OrganizationMemberRow[];
    seatUsage: SeatUsage | null;
    invites: PendingOrganizationInvite[];
    onRefresh: () => Promise<void>;
    inviteLink: InviteLink | null;
    onInviteLink: (link: InviteLink | null) => void;
    onOpenBilling: () => void;
}) {
    const [nameState, setNameState] = useState<SaveState | null>(null);
    const [nameError, setNameError] = useState('');
    const [routingState, setRoutingState] = useState<SaveState | null>(null);
    const [routingError, setRoutingError] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviting, setInviting] = useState(false);
    const [inviteNotice, setInviteNotice] = useState<Notice>(null);
    const [inviteCopied, setInviteCopied] = useState(false);
    const [inviteAction, setInviteAction] = useState<string | null>(null);
    const [inviteListNotice, setInviteListNotice] = useState<Notice>(null);
    const [memberNotice, setMemberNotice] = useState<Notice>(null);
    const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
    const [confirming, setConfirming] = useState(false);

    if (accountState !== 'ready') {
        return (
            <SettingsSection icon={Users} title="Workspace" description="Your workspace’s name, plan and seats.">
                {accountState === 'loading' ? (
                    <LoadingRows label="Loading your workspace…" />
                ) : (
                    <LoadError message="We couldn’t load your workspace. Nothing was changed." onRetry={onRetryAccount} />
                )}
            </SettingsSection>
        );
    }
    if (!organization) {
        return (
            <SettingsSection icon={Users} title="Workspace" description="Your workspace’s name, plan and seats.">
                <Note>You’re not in a workspace right now, so there is nothing to manage here.</Note>
            </SettingsSection>
        );
    }

    const savedName = organization.name || '';
    const trimmedName = workspaceName.trim();
    const nameDirty = trimmedName !== savedName;
    const nameBlocker = nameDirty && (trimmedName.length < 2 || trimmedName.length > 100)
        ? 'Use between 2 and 100 characters.'
        : '';

    async function saveName() {
        setNameState('saving');
        setNameError('');
        try {
            const response = await fetch('/api/organization', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: trimmedName }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(friendlyError(data, 'We couldn’t rename the workspace. Try again.'));
            onOrganizationUpdated(data.organization || { name: trimmedName });
            onWorkspaceNameChange(data.organization?.name || trimmedName);
            setNameState('saved');
        } catch (error) {
            setNameError(error instanceof Error ? error.message : 'We couldn’t rename the workspace. Try again.');
            setNameState('error');
        }
    }

    async function toggleRouting(checked: boolean) {
        const previous = notifyAdmins;
        // Shown right away; put back if the save fails.
        onNotifyAdminsChange(checked);
        setRoutingState('saving');
        setRoutingError('');
        try {
            const response = await fetch('/api/organization/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notify_admins_on_submission: checked }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(friendlyError(data, 'We couldn’t save that, so it’s back to what was saved. Try again.'));
            onNotifyAdminsChange(
                data?.notification_settings?.notify_admins_on_submission === true,
                data?.notification_settings ?? null,
            );
            setRoutingState('saved');
        } catch (error) {
            onNotifyAdminsChange(previous);
            setRoutingError(error instanceof Error ? error.message : 'We couldn’t save that, so it’s back to what was saved. Try again.');
            setRoutingState('error');
        }
    }

    async function invite() {
        const email = inviteEmail.trim();
        if (!email) return;
        setInviting(true);
        setInviteNotice(null);
        onInviteLink(null);
        try {
            const response = await fetch('/api/organization/invites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(friendlyError(data, 'We couldn’t create the invitation. Try again.', email));

            let copied = false;
            if (typeof data.inviteUrl === 'string' && data.inviteUrl) {
                onInviteLink({ email, url: data.inviteUrl, expiresAt: data.invite?.expires_at ?? null });
                try {
                    await navigator.clipboard.writeText(data.inviteUrl);
                    copied = true;
                } catch {
                    // The link is still shown below with its own Copy button.
                }
            }
            // Only say an email went out when the response says so.
            const emailed = !data.reused && data.emailSent === true;
            const outcome = data.reused
                ? `${email} already has a pending invitation, so no new email was sent. Their invite link is below.`
                : emailed
                    ? `Invitation emailed to ${email}. Their invite link is below.`
                    : `Invitation created, but we couldn’t confirm the email was sent. Send ${email} the link below yourself.`;
            setInviteNotice({
                tone: emailed ? 'saved' : 'muted',
                text: copied ? `${outcome} It is copied to your clipboard.` : outcome,
            });
            setInviteEmail('');
            await onRefresh();
        } catch (error) {
            setInviteNotice({
                tone: 'error',
                text: error instanceof Error ? error.message : 'We couldn’t create the invitation. Try again.',
            });
        } finally {
            setInviting(false);
        }
    }

    async function copyInviteLink() {
        if (!inviteLink) return;
        try {
            await navigator.clipboard.writeText(inviteLink.url);
            setInviteCopied(true);
            setTimeout(() => setInviteCopied(false), 2000);
        } catch {
            setInviteNotice({ tone: 'error', text: 'We couldn’t copy the link. Select it and copy it yourself.' });
        }
    }

    async function resendInvite(target: PendingOrganizationInvite) {
        setInviteAction(`resend:${target.id}`);
        setInviteListNotice(null);
        try {
            const response = await fetch(`/api/organization/invites/${target.id}`, { method: 'PATCH' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(friendlyError(data, 'We couldn’t resend the invitation. Try again.'));
            if (typeof data.inviteUrl === 'string' && data.inviteUrl) {
                onInviteLink({ email: target.email, url: data.inviteUrl, expiresAt: data.invite?.expires_at ?? null });
            }
            setInviteListNotice({
                tone: data.emailSent === true ? 'saved' : 'muted',
                text: data.emailSent === true
                    ? `Invitation emailed again to ${target.email}.`
                    : `The invitation for ${target.email} was renewed, but we couldn’t confirm the email was sent. Send them the invite link above yourself.`,
            });
            await onRefresh();
        } catch (error) {
            setInviteListNotice({
                tone: 'error',
                text: error instanceof Error ? error.message : 'We couldn’t resend the invitation. Try again.',
            });
        } finally {
            setInviteAction(null);
        }
    }

    async function cancelInvite(target: PendingOrganizationInvite) {
        setInviteAction(`cancel:${target.id}`);
        setInviteListNotice(null);
        try {
            const response = await fetch(`/api/organization/invites/${target.id}`, { method: 'DELETE' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(friendlyError(data, 'We couldn’t cancel the invitation. Try again.'));
            if (inviteLink?.email === target.email) onInviteLink(null);
            setInviteListNotice({ tone: 'saved', text: `Invitation for ${target.email} canceled. Its seat is available again.` });
            await onRefresh();
        } catch (error) {
            setInviteListNotice({
                tone: 'error',
                text: error instanceof Error ? error.message : 'We couldn’t cancel the invitation. Try again.',
            });
        } finally {
            setInviteAction(null);
        }
    }

    async function changeRole(member: OrganizationMemberRow, nextRole: 'admin' | 'member') {
        const name = member.full_name || member.email;
        setMemberNotice(null);
        try {
            const response = await fetch(`/api/organization/members/${member.account_id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: nextRole }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(friendlyError(data, 'We couldn’t change that role. Try again.'));
            setMemberNotice({ tone: 'saved', text: `${name} is now ${nextRole === 'admin' ? 'an admin' : 'a member'}.` });
            await onRefresh();
        } catch (error) {
            setMemberNotice({ tone: 'error', text: error instanceof Error ? error.message : 'We couldn’t change that role. Try again.' });
        }
    }

    async function removeMember(member: OrganizationMemberRow) {
        const name = member.full_name || member.email;
        setMemberNotice(null);
        try {
            const response = await fetch(`/api/organization/members/${member.account_id}`, { method: 'DELETE' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(friendlyError(data, 'We couldn’t remove that member. Try again.'));
            setMemberNotice({ tone: 'saved', text: `${name} was removed from this workspace.` });
            await onRefresh();
        } catch (error) {
            setMemberNotice({ tone: 'error', text: error instanceof Error ? error.message : 'We couldn’t remove that member. Try again.' });
        }
    }

    async function runConfirmation() {
        if (!confirmation) return;
        setConfirming(true);
        try {
            await confirmation.run();
        } finally {
            setConfirming(false);
            setConfirmation(null);
        }
    }

    const seatsInUse = seatUsage ? seatUsage.used + seatUsage.pendingInvites : null;

    return (
        <>
            <SettingsSection icon={Users} title="Workspace" description="Your workspace’s name, plan and seats.">
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="break-words font-medium text-foreground">{savedName}</p>
                            <Badge variant={isAdmin ? 'secondary' : 'outline'}>
                                {isAdmin ? 'You’re an admin' : 'You’re a member'}
                            </Badge>
                            {isTeam && <Badge>Teams</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {!isTeam
                                ? 'This workspace is for one person. To invite teammates, start a Teams plan in Billing.'
                                : seatUsage && seatsInUse !== null
                                    ? `${seatsInUse} of ${organization.seat_quantity ?? '—'} seats in use: ${plural(seatUsage.used, 'member')} and ${plural(seatUsage.pendingInvites, 'pending invitation')}. Each member and each pending invitation uses one seat.`
                                    : teamState === 'error'
                                        ? 'We couldn’t load how many seats are in use.'
                                        : 'Loading seats…'}
                        </p>
                    </div>
                    <Button variant="outline" className="shrink-0" onClick={onOpenBilling}>
                        <CreditCard />
                        Open Billing
                    </Button>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="workspaceName">Workspace name</Label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Input
                            id="workspaceName"
                            value={workspaceName}
                            onChange={(event) => {
                                setNameState(null);
                                setNameError('');
                                onWorkspaceNameChange(event.target.value);
                            }}
                            maxLength={100}
                            disabled={!isAdmin || nameState === 'saving'}
                            aria-describedby="workspaceNameHelp"
                        />
                        {isAdmin && (
                            <Button
                                className="shrink-0"
                                onClick={saveName}
                                disabled={nameState === 'saving' || !nameDirty || nameBlocker !== ''}
                            >
                                {nameState === 'saving' ? 'Saving…' : 'Save workspace name'}
                            </Button>
                        )}
                    </div>
                    <p id="workspaceNameHelp" className="text-xs text-muted-foreground">
                        {isAdmin
                            ? 'Renaming does not change any seller or packet links you have already shared.'
                            : 'Only workspace admins can rename the workspace.'}
                    </p>
                    {isAdmin && (nameError ? (
                        <InlineStatus tone="error">{nameError}</InlineStatus>
                    ) : nameBlocker ? (
                        <InlineStatus>{nameBlocker}</InlineStatus>
                    ) : nameState === 'saving' ? (
                        <InlineStatus tone="saving">Saving…</InlineStatus>
                    ) : nameDirty ? (
                        <InlineStatus>Unsaved changes</InlineStatus>
                    ) : nameState === 'saved' ? (
                        <InlineStatus tone="saved">Workspace name saved</InlineStatus>
                    ) : null)}
                </div>
            </SettingsSection>

            {isTeam && (
                <SettingsSection
                    icon={Bell}
                    title="Team notifications"
                    description="One setting for the whole workspace. Each person’s own email choices are on the Notifications tab."
                >
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <p id="workspace-notify-admins-label" className="text-sm font-medium text-foreground">
                                Notify workspace admins of all team submissions
                            </p>
                            <p id="workspace-notify-admins-desc" className="text-sm text-muted-foreground">
                                {isAdmin
                                    ? 'When on, every seller submission in this workspace is also emailed to its admins, as well as to the person who owns the request. An admin who has turned off their own Seller submissions emails still won’t get them.'
                                    : 'Only workspace admins can change this.'}
                            </p>
                            {routingState === 'error' ? (
                                <InlineStatus tone="error" className="mt-1">{routingError}</InlineStatus>
                            ) : routingState ? (
                                <InlineStatus tone={routingState} className="mt-1">
                                    {routingState === 'saving' ? 'Saving…' : 'Saved'}
                                </InlineStatus>
                            ) : null}
                        </div>
                        <Switch
                            className="mt-1"
                            aria-labelledby="workspace-notify-admins-label"
                            aria-describedby="workspace-notify-admins-desc"
                            disabled={!isAdmin || routingState === 'saving'}
                            checked={notifyAdmins}
                            onCheckedChange={toggleRouting}
                        />
                    </div>
                </SettingsSection>
            )}

            <SettingsSection
                icon={UserPlus}
                title="Invitations"
                description="Invite teammates by email and manage invitations that haven’t been accepted yet."
            >
                {!isTeam ? (
                    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                            {isAdmin
                                ? 'You can invite teammates once this workspace is on a Teams plan.'
                                : 'A workspace admin can invite teammates once this workspace is on a Teams plan.'}
                        </p>
                        <Button variant="outline" className="shrink-0" onClick={onOpenBilling}>
                            See Teams in Billing
                        </Button>
                    </div>
                ) : !isAdmin ? (
                    <Note>Only workspace admins can send invitations and see who has been invited.</Note>
                ) : (
                    <>
                        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                <div className="flex-1 space-y-2">
                                    <Label htmlFor="inviteEmail">Teammate’s email</Label>
                                    <Input
                                        id="inviteEmail"
                                        type="email"
                                        inputMode="email"
                                        autoComplete="off"
                                        spellCheck={false}
                                        value={inviteEmail}
                                        onChange={(event) => setInviteEmail(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' && !inviting && inviteEmail.trim()) {
                                                event.preventDefault();
                                                void invite();
                                            }
                                        }}
                                        placeholder="teammate@company.com"
                                        disabled={inviting}
                                    />
                                </div>
                                <Button onClick={() => void invite()} disabled={inviting || !inviteEmail.trim()}>
                                    {inviting ? <Loader2 className="animate-spin" /> : <UserPlus />}
                                    {inviting ? 'Inviting…' : 'Send invitation'}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                They join as a member. An invitation uses one seat until it is accepted, canceled or expires.
                            </p>
                            <NoticeLine notice={inviteNotice} />
                            {inviteLink && (
                                <div className="space-y-1.5">
                                    <Label htmlFor="inviteUrl">Invite link for {inviteLink.email}</Label>
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                        <Input
                                            id="inviteUrl"
                                            value={inviteLink.url}
                                            readOnly
                                            onFocus={(event) => event.currentTarget.select()}
                                            className="font-mono text-xs"
                                        />
                                        <Button variant="outline" onClick={copyInviteLink} className="shrink-0">
                                            {inviteCopied ? <Check /> : <Copy />}
                                            {inviteCopied ? 'Copied' : 'Copy link'}
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Opening this link lets them join your workspace, so share it only with them.
                                        {inviteLink.expiresAt ? ` It expires ${formatDate(inviteLink.expiresAt)}.` : ''}
                                        {' '}It is shown here only until you leave this page; use Resend below to get a new one.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium text-foreground">
                                    Pending invitations{teamState === 'ready' ? ` (${invites.length})` : ''}
                                </p>
                            </div>
                            <NoticeLine notice={inviteListNotice} />
                            {teamState === 'loading' ? (
                                <LoadingRows label="Loading invitations…" rows={1} />
                            ) : teamState === 'error' ? (
                                <LoadError message="We couldn’t load pending invitations." onRetry={() => void onRefresh()} />
                            ) : invites.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                                    No one is waiting on an invitation.
                                </p>
                            ) : (
                                <ul className="space-y-2">
                                    {invites.map((pending) => {
                                        const resending = inviteAction === `resend:${pending.id}`;
                                        const canceling = inviteAction === `cancel:${pending.id}`;
                                        return (
                                            <li key={pending.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="min-w-0 space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="break-all text-sm font-medium text-foreground">{pending.email}</p>
                                                        <Badge variant="outline">{pending.role === 'admin' ? 'Admin' : 'Member'}</Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">Expires {formatDate(pending.expires_at)}</p>
                                                </div>
                                                <div className="flex flex-wrap gap-2 sm:justify-end">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        aria-label={`Resend invitation to ${pending.email}`}
                                                        onClick={() => void resendInvite(pending)}
                                                        disabled={inviteAction !== null}
                                                    >
                                                        {resending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                                                        Resend
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-destructive hover:text-destructive"
                                                        aria-label={`Cancel invitation to ${pending.email}`}
                                                        onClick={() => setConfirmation({
                                                            title: 'Cancel this invitation?',
                                                            description: `${pending.email} will no longer be able to join with it, and its seat becomes available right away.`,
                                                            confirmLabel: 'Cancel invitation',
                                                            cancelLabel: 'Keep invitation',
                                                            destructive: true,
                                                            run: () => cancelInvite(pending),
                                                        })}
                                                        disabled={inviteAction !== null}
                                                    >
                                                        {canceling && <Loader2 className="animate-spin" />}
                                                        Cancel invitation
                                                    </Button>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </>
                )}
            </SettingsSection>

            <SettingsSection
                icon={Shield}
                title="Members"
                description="Everyone in this workspace and what they can do. Admins manage people, the workspace name and billing."
            >
                <NoticeLine notice={memberNotice} />
                {teamState === 'loading' ? (
                    <LoadingRows label="Loading members…" />
                ) : teamState === 'error' ? (
                    <LoadError message="We couldn’t load the members of this workspace." onRetry={() => void onRefresh()} />
                ) : members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No members to show.</p>
                ) : (
                    <ul className="space-y-2">
                        {members.map((member) => {
                            const name = member.full_name || member.email;
                            const self = member.account_id === accountId;
                            const nextRole = member.member_role === 'admin' ? 'member' : 'admin';
                            return (
                                <li key={member.account_id} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0 space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="break-words text-sm font-medium text-foreground">{name}</p>
                                            <Badge variant={member.member_role === 'admin' ? 'secondary' : 'outline'}>
                                                {member.member_role === 'admin' ? 'Admin' : 'Member'}
                                            </Badge>
                                            {self && <Badge variant="outline">You</Badge>}
                                        </div>
                                        {member.full_name && (
                                            <p className="break-all text-xs text-muted-foreground">{member.email}</p>
                                        )}
                                    </div>
                                    {isAdmin && !self && (
                                        <div className="flex flex-wrap gap-2 sm:justify-end">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                aria-label={nextRole === 'admin' ? `Make ${name} an admin` : `Change ${name} to a member`}
                                                onClick={() => setConfirmation(nextRole === 'admin' ? {
                                                    title: `Make ${name} an admin?`,
                                                    description: 'Admins can invite and remove people, change roles, rename the workspace and manage billing.',
                                                    confirmLabel: 'Make admin',
                                                    run: () => changeRole(member, 'admin'),
                                                } : {
                                                    title: `Change ${name} to a member?`,
                                                    description: 'They will no longer be able to manage people, the workspace name or billing.',
                                                    confirmLabel: 'Change to member',
                                                    run: () => changeRole(member, 'member'),
                                                })}
                                            >
                                                {nextRole === 'admin' ? 'Make admin' : 'Change to member'}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-destructive hover:text-destructive"
                                                aria-label={`Remove ${name}`}
                                                onClick={() => setConfirmation({
                                                    title: `Remove ${name}?`,
                                                    description: 'They lose access to this workspace right away.',
                                                    confirmLabel: 'Remove member',
                                                    destructive: true,
                                                    run: () => removeMember(member),
                                                })}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
                <p className="text-xs text-muted-foreground">
                    {isAdmin ? '' : 'Only workspace admins can change roles or remove members. '}
                    Transferring ownership and leaving a workspace aren’t available yet.
                </p>
            </SettingsSection>

            <ConfirmDialog
                open={confirmation !== null}
                onOpenChange={(open) => { if (!open) setConfirmation(null); }}
                title={confirmation?.title || ''}
                description={confirmation?.description || ''}
                confirmLabel={confirming ? 'Working…' : confirmation?.confirmLabel || ''}
                cancelLabel={confirmation?.cancelLabel}
                destructive={confirmation?.destructive}
                busy={confirming}
                onConfirm={() => void runConfirmation()}
            />
        </>
    );
}

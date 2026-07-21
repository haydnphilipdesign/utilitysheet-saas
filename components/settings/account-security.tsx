'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@stackframe/stack';
import { Download, FileSearch, KeyRound, Loader2, Mail, Monitor, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

type SecuritySummary = {
    primaryEmail: string;
    primaryEmailVerified: boolean;
    hasPassword: boolean;
    methods: {
        credential: boolean;
        magicLink: boolean;
        passkey: boolean;
        oauthProviders: string[];
    };
    contactChannels: Array<{
        id: string;
        value: string;
        isPrimary: boolean;
        isVerified: boolean;
        usedForAuth: boolean;
    }>;
    sessions: Array<{
        id: string;
        createdAt: string;
        lastUsedAt: string | null;
        isCurrentSession: boolean;
        isImpersonation: boolean;
        location: string | null;
    }>;
};

type ClosureReadiness = {
    executableClosureAvailable: false;
    readyForFutureClosure: boolean;
    blockers: string[];
    workspaces: Array<{
        id: string;
        name: string;
        role: 'admin' | 'member';
        subscription_status: string;
        member_count: number;
        admin_count: number;
        pending_invite_count: number;
        owned_profile_count: number;
        owned_request_count: number;
    }>;
    assets: {
        request_count?: number;
        profile_count?: number;
        seller_form_count?: number;
        public_request_count?: number;
    };
};

async function readJson(response: Response) {
    return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

export function AccountSecuritySettings() {
    const user = useUser();
    const [security, setSecurity] = useState<SecuritySummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const [reauthOpen, setReauthOpen] = useState(false);
    const [reauthPassword, setReauthPassword] = useState('');
    const [reauthError, setReauthError] = useState<string | null>(null);
    const [reauthLoading, setReauthLoading] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [passwordOpen, setPasswordOpen] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [closure, setClosure] = useState<ClosureReadiness | null>(null);
    const [confirmation, setConfirmation] = useState<{
        title: string;
        description: string;
        confirmLabel: string;
        onConfirm: () => Promise<void>;
    } | null>(null);

    const loadSecurity = async (promptForReauth = false) => {
        setLoading(true);
        try {
            const response = await fetch('/api/account/security', { cache: 'no-store' });
            const data = await readJson(response);
            if (response.status === 403 && data.code === 'RECENT_AUTH_REQUIRED') {
                setSecurity(null);
                if (promptForReauth) setReauthOpen(true);
                return false;
            }
            if (!response.ok) throw new Error(String(data.error || 'Failed to load security settings.'));
            setSecurity(data as unknown as SecuritySummary);
            return true;
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to load security settings.');
            return false;
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadSecurity(false);
    }, []);

    const verifyIdentity = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!user?.primaryEmail) return;
        setReauthLoading(true);
        setReauthError(null);
        try {
            const { stackClientApp } = await import('@/lib/stack/client');
            const result = await stackClientApp.signInWithCredential({
                email: user.primaryEmail,
                password: reauthPassword,
                noRedirect: true,
            });
            if (result.status === 'error') {
                throw new Error('That password did not match your account.');
            }
            setReauthPassword('');
            setReauthOpen(false);
            const loaded = await loadSecurity(false);
            if (loaded) toast.success('Identity verified for five minutes.');
        } catch (error) {
            setReauthError(error instanceof Error ? error.message : 'Identity verification failed.');
        } finally {
            setReauthLoading(false);
        }
    };

    const runSecurityAction = async (body: Record<string, unknown>, successMessage: string) => {
        const action = String(body.action || 'security-action');
        setBusyAction(action);
        try {
            const response = await fetch('/api/account/security', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await readJson(response);
            if (response.status === 403 && data.code === 'RECENT_AUTH_REQUIRED') {
                setReauthOpen(true);
                throw new Error('Verify your password, then try again.');
            }
            if (!response.ok) throw new Error(String(data.error || 'Account security action failed.'));
            toast.success(successMessage);
            await loadSecurity(false);
            return true;
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Account security action failed.');
            return false;
        } finally {
            setBusyAction(null);
        }
    };

    const beginEmailChange = async (event: React.FormEvent) => {
        event.preventDefault();
        const email = newEmail.trim();
        if (!email) return;
        const success = await runSecurityAction(
            { action: 'begin_email_change', email },
            'Verification email sent. Return here after verifying it.',
        );
        if (success) setNewEmail('');
    };

    const changePassword = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!user?.primaryEmail) return;
        if (newPassword !== confirmPassword) {
            setPasswordError('New passwords do not match.');
            return;
        }
        setBusyAction('password-change');
        setPasswordError(null);
        try {
            const { stackClientApp } = await import('@/lib/stack/client');
            const signIn = await stackClientApp.signInWithCredential({
                email: user.primaryEmail,
                password: currentPassword,
                noRedirect: true,
            });
            if (signIn.status === 'error') throw new Error('Current password is incorrect.');

            const error = await user.updatePassword({ oldPassword: currentPassword, newPassword });
            if (error) throw new Error('Check your current password and the new password requirements.');

            const auditResponse = await fetch('/api/account/security', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'password_changed', revokeOtherSessions: true }),
            });
            if (!auditResponse.ok) {
                throw new Error('Password changed, but other sessions could not be revoked. Review sessions now.');
            }

            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setPasswordOpen(false);
            toast.success('Password changed and other sessions revoked.');
            await loadSecurity(false);
        } catch (error) {
            setPasswordError(error instanceof Error ? error.message : 'Password change failed.');
        } finally {
            setBusyAction(null);
        }
    };

    const downloadExport = async () => {
        setBusyAction('export');
        try {
            const response = await fetch('/api/account/export', { cache: 'no-store' });
            if (response.status === 403) {
                const data = await readJson(response);
                if (data.code === 'RECENT_AUTH_REQUIRED') setReauthOpen(true);
                throw new Error('Verify your password, then request the export again.');
            }
            if (!response.ok) {
                const data = await readJson(response);
                throw new Error(String(data.error || 'Export failed.'));
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `utilitysheet-account-export-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            toast.success('Account export downloaded.');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Export failed.');
        } finally {
            setBusyAction(null);
        }
    };

    const loadClosureReadiness = async () => {
        setBusyAction('closure-readiness');
        try {
            const response = await fetch('/api/account/closure-readiness', { cache: 'no-store' });
            const data = await readJson(response);
            if (response.status === 403 && data.code === 'RECENT_AUTH_REQUIRED') {
                setReauthOpen(true);
                throw new Error('Verify your password, then review closure readiness again.');
            }
            if (!response.ok) throw new Error(String(data.error || 'Could not load closure readiness.'));
            setClosure(data as unknown as ClosureReadiness);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not load closure readiness.');
        } finally {
            setBusyAction(null);
        }
    };

    return (
        <>
            <Card className="border-border bg-card/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-foreground">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        Sign-in &amp; security
                    </CardTitle>
                    <CardDescription>
                        Manage verified emails, your password, and signed-in devices. Sensitive details require a fresh password check.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    {!security ? (
                        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-medium text-foreground">Security details are protected</p>
                                <p className="text-sm text-muted-foreground">Verify your password to view emails and active sessions for five minutes.</p>
                            </div>
                            <Button onClick={() => setReauthOpen(true)} disabled={loading || !user?.hasPassword}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                                Verify identity
                            </Button>
                            {!user?.hasPassword && (
                                <p className="text-sm text-muted-foreground">Sign out and back in to refresh your security session.</p>
                            )}
                        </div>
                    ) : (
                        <>
                            <section aria-labelledby="sign-in-methods-heading" className="space-y-3">
                                <div>
                                    <h3 id="sign-in-methods-heading" className="text-sm font-semibold text-foreground">Sign-in methods</h3>
                                    <p className="text-sm text-muted-foreground">Only methods enabled for this UtilitySheet project are shown.</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {security.methods.credential && <Badge variant="secondary">Email &amp; password</Badge>}
                                    {security.methods.magicLink && <Badge variant="secondary">Magic link</Badge>}
                                    {security.methods.passkey && <Badge variant="secondary">Passkey</Badge>}
                                    {security.methods.oauthProviders.map((provider) => (
                                        <Badge key={provider} variant="secondary">{provider}</Badge>
                                    ))}
                                </div>
                                {security.methods.credential && (
                                    <Button variant="outline" onClick={() => security.hasPassword ? setPasswordOpen(true) : void runSecurityAction({ action: 'request_password_reset' }, 'Password setup email sent.')}>
                                        <KeyRound className="mr-2 h-4 w-4" />
                                        {security.hasPassword ? 'Change password' : 'Send password setup email'}
                                    </Button>
                                )}
                            </section>

                            <Separator />

                            <section aria-labelledby="email-addresses-heading" className="space-y-3">
                                <div>
                                    <h3 id="email-addresses-heading" className="text-sm font-semibold text-foreground">Email addresses</h3>
                                    <p className="text-sm text-muted-foreground">A new address must be verified before it can become your sign-in email.</p>
                                </div>
                                <ul className="space-y-2">
                                    {security.contactChannels.map((channel) => (
                                        <li key={channel.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="min-w-0">
                                                <p className="break-all text-sm font-medium text-foreground">{channel.value}</p>
                                                <div className="mt-1 flex flex-wrap gap-1.5">
                                                    {channel.isPrimary && <Badge>Primary</Badge>}
                                                    <Badge variant={channel.isVerified ? 'secondary' : 'outline'}>{channel.isVerified ? 'Verified' : 'Verification pending'}</Badge>
                                                    {channel.usedForAuth && <Badge variant="outline">Sign-in enabled</Badge>}
                                                </div>
                                            </div>
                                            {!channel.isPrimary && channel.isVerified && (
                                                <Button
                                                    variant="outline"
                                                    onClick={() => setConfirmation({
                                                        title: 'Change primary email',
                                                        description: `Use ${channel.value} as your UtilitySheet sign-in and personal billing email? Your current email remains available as a verified sign-in method.`,
                                                        confirmLabel: 'Make primary',
                                                        onConfirm: async () => {
                                                            await runSecurityAction({ action: 'make_primary_email', contactChannelId: channel.id }, 'Primary email updated.');
                                                        },
                                                    })}
                                                    disabled={busyAction === 'make_primary_email'}
                                                >
                                                    Make primary
                                                </Button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                                <form onSubmit={beginEmailChange} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                    <div className="flex-1 space-y-2">
                                        <Label htmlFor="new-account-email">Add another email</Label>
                                        <Input
                                            id="new-account-email"
                                            type="email"
                                            autoComplete="email"
                                            value={newEmail}
                                            onChange={(event) => setNewEmail(event.target.value)}
                                            required
                                        />
                                    </div>
                                    <Button type="submit" variant="outline" disabled={busyAction === 'begin_email_change'}>
                                        <Mail className="mr-2 h-4 w-4" />
                                        Send verification
                                    </Button>
                                </form>
                            </section>

                            <Separator />

                            <section aria-labelledby="active-sessions-heading" className="space-y-3">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <h3 id="active-sessions-heading" className="text-sm font-semibold text-foreground">Active sessions</h3>
                                        <p className="text-sm text-muted-foreground">End sessions you no longer recognize. Use Sign Out above for this device.</p>
                                    </div>
                                    {security.sessions.some((session) => !session.isCurrentSession) && (
                                        <Button
                                            variant="outline"
                                            onClick={() => setConfirmation({
                                                title: 'Revoke other sessions',
                                                description: 'End every other UtilitySheet session? This device will remain signed in.',
                                                confirmLabel: 'Revoke sessions',
                                                onConfirm: async () => {
                                                    await runSecurityAction({ action: 'revoke_other_sessions' }, 'Other sessions revoked.');
                                                },
                                            })}
                                            disabled={busyAction === 'revoke_other_sessions'}
                                        >
                                            Revoke all others
                                        </Button>
                                    )}
                                </div>
                                <ul className="space-y-2">
                                    {security.sessions.map((session) => (
                                        <li key={session.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex min-w-0 gap-3">
                                                <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">
                                                        {session.isCurrentSession ? 'Current session' : 'Signed-in session'}
                                                        {session.isImpersonation ? ' · Support impersonation' : ''}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {session.location || 'Location unavailable'} · Last used {new Date(session.lastUsedAt || session.createdAt).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                            {!session.isCurrentSession && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setConfirmation({
                                                        title: 'Revoke session',
                                                        description: `End the session last used ${new Date(session.lastUsedAt || session.createdAt).toLocaleString()}?`,
                                                        confirmLabel: 'Revoke session',
                                                        onConfirm: async () => {
                                                            await runSecurityAction({ action: 'revoke_session', sessionId: session.id }, 'Session revoked.');
                                                        },
                                                    })}
                                                    disabled={busyAction === 'revoke_session'}
                                                    aria-label={`Revoke session last used ${new Date(session.lastUsedAt || session.createdAt).toLocaleString()}`}
                                                >
                                                    Revoke
                                                </Button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        </>
                    )}
                </CardContent>
            </Card>

            <Card className="border-border bg-card/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-foreground">
                        <FileSearch className="h-5 w-5 text-primary" />
                        Data controls
                    </CardTitle>
                    <CardDescription>
                        Export your personal UtilitySheet data or review what must be resolved before a future account closure.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm font-medium text-foreground">Download account data</p>
                            <p className="text-sm text-muted-foreground">JSON export of your profile, settings, memberships, owned requests, responses, and summaries. Secrets and raw access data are excluded.</p>
                        </div>
                        <Button variant="outline" onClick={() => void downloadExport()} disabled={busyAction === 'export'}>
                            {busyAction === 'export' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Download JSON
                        </Button>
                    </div>

                    <div className="space-y-3 rounded-xl border border-border p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-medium text-foreground">Account closure readiness</p>
                                <p className="text-sm text-muted-foreground">Closure is not available yet. This read-only review identifies billing, workspace, public-link, asset, and referral safeguards.</p>
                            </div>
                            <Button variant="outline" onClick={() => void loadClosureReadiness()} disabled={busyAction === 'closure-readiness'}>
                                {busyAction === 'closure-readiness' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Review readiness
                            </Button>
                        </div>
                        {closure && (
                            <div role="status" className="space-y-3 rounded-lg bg-muted/30 p-3 text-sm">
                                <p className="font-medium text-foreground">
                                    {closure.blockers.length === 0
                                        ? 'No current billing or workspace blocker was detected, but closure remains unavailable until the retention lifecycle is approved.'
                                        : `${closure.blockers.length} item${closure.blockers.length === 1 ? '' : 's'} must be resolved before closure can be offered.`}
                                </p>
                                {closure.blockers.length > 0 && (
                                    <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                                        {closure.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                                    </ul>
                                )}
                                <p className="text-muted-foreground">
                                    Account-owned records: {Number(closure.assets.request_count) || 0} requests, {Number(closure.assets.profile_count) || 0} Branding Profiles, and {Number(closure.assets.seller_form_count) || 0} reusable seller forms across {closure.workspaces.length} workspace{closure.workspaces.length === 1 ? '' : 's'}.
                                </p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={reauthOpen} onOpenChange={setReauthOpen}>
                <DialogContent>
                    <form onSubmit={verifyIdentity} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Verify your identity</DialogTitle>
                            <DialogDescription>Enter your current UtilitySheet password. It goes directly to Stack Auth and is never sent to UtilitySheet.</DialogDescription>
                        </DialogHeader>
                        {reauthError && <p role="alert" className="text-sm text-destructive">{reauthError}</p>}
                        <div className="space-y-2">
                            <Label htmlFor="reauth-password">Current password</Label>
                            <Input
                                id="reauth-password"
                                type="password"
                                autoComplete="current-password"
                                value={reauthPassword}
                                onChange={(event) => setReauthPassword(event.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setReauthOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={reauthLoading}>
                                {reauthLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Verify
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
                <DialogContent>
                    <form onSubmit={changePassword} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Change password</DialogTitle>
                            <DialogDescription>Your current and new passwords go directly to Stack Auth. Other sessions are revoked after the change.</DialogDescription>
                        </DialogHeader>
                        {passwordError && <p role="alert" className="text-sm text-destructive">{passwordError}</p>}
                        <div className="space-y-2">
                            <Label htmlFor="current-account-password">Current password</Label>
                            <Input id="current-account-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-account-password">New password</Label>
                            <Input id="new-account-password" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-account-password">Confirm new password</Label>
                            <Input id="confirm-account-password" type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setPasswordOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={busyAction === 'password-change'}>
                                {busyAction === 'password-change' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Change password
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(confirmation)} onOpenChange={(open) => !open && setConfirmation(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{confirmation?.title}</DialogTitle>
                        <DialogDescription>{confirmation?.description}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setConfirmation(null)}>Cancel</Button>
                        <Button
                            type="button"
                            onClick={() => {
                                const action = confirmation?.onConfirm;
                                setConfirmation(null);
                                if (action) void action();
                            }}
                        >
                            {confirmation?.confirmLabel}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

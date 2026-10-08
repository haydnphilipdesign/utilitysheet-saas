'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@stackframe/stack';
import { Download, FileSearch, KeyRound, Loader2, LogIn, Mail, Monitor, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
import { AccountClosureSection } from '@/components/settings/account-closure';
import { LoadError, LoadingRows, SettingsSection } from '@/components/settings/settings-ui';

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

const ACCOUNT_SETTINGS_PATH = '/dashboard/settings?tab=account';
const RECENT_AUTH_PROMPT = 'Confirm it’s you, then try again.';

function formatWhen(value: string) {
    return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

async function readJson(response: Response) {
    return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

export function AccountSecuritySettings() {
    const user = useUser();
    const [security, setSecurity] = useState<SecuritySummary | null>(null);
    const [loading, setLoading] = useState(true);
    // A failed load is not the same as needing to confirm it's you.
    const [loadFailed, setLoadFailed] = useState(false);
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
                setLoadFailed(false);
                if (promptForReauth) setReauthOpen(true);
                return false;
            }
            if (!response.ok) throw new Error(String(data.error || 'We couldn’t load your sign-in settings.'));
            setSecurity(data as unknown as SecuritySummary);
            setLoadFailed(false);
            return true;
        } catch {
            // Shown in the card when nothing is loaded; what was loaded stays on screen.
            setLoadFailed(true);
            return false;
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadSecurity(false);
    }, []);

    // Accounts created with Google (or another provider) have no password, so
    // the only way to start a fresh five-minute window is to sign in again.
    const hasPassword = Boolean(user?.hasPassword);

    const signInAgain = async () => {
        if (!user) return;
        setReauthLoading(true);
        try {
            await user.signOut({
                redirectUrl: `/auth/login?next=${encodeURIComponent(ACCOUNT_SETTINGS_PATH)}`,
            });
        } catch {
            setReauthLoading(false);
            toast.error('We couldn’t sign you out. Refresh the page and try again.');
        }
    };

    const submitPasswordConfirmation = async (event: React.FormEvent) => {
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
                throw new Error('That password is incorrect. Try again, or reset it from the sign-in page.');
            }
            setReauthPassword('');
            setReauthOpen(false);
            const loaded = await loadSecurity(false);
            if (loaded) toast.success('Password confirmed. Sensitive settings are unlocked for five minutes.');
        } catch (error) {
            setReauthError(error instanceof Error ? error.message : 'We couldn’t confirm your password. Try again.');
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
                throw new Error(RECENT_AUTH_PROMPT);
            }
            if (!response.ok) throw new Error(String(data.error || 'We couldn’t make that change. Try again.'));
            toast.success(successMessage);
            await loadSecurity(false);
            return true;
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'We couldn’t make that change. Try again.');
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
            'Verification email sent. Open it, then come back here and choose Make primary.',
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
                throw new Error('Password changed, but we couldn’t sign out your other devices. Check Signed-in devices now.');
            }

            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setPasswordOpen(false);
            toast.success('Password changed. Your other devices were signed out.');
            await loadSecurity(false);
        } catch (error) {
            setPasswordError(error instanceof Error ? error.message : 'We couldn’t change your password. Try again.');
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
                throw new Error(RECENT_AUTH_PROMPT);
            }
            if (!response.ok) {
                const data = await readJson(response);
                throw new Error(String(data.error || 'We couldn’t download your data. Try again.'));
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
            toast.success('Your data was downloaded.');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'We couldn’t download your data. Try again.');
        } finally {
            setBusyAction(null);
        }
    };

    return (
        <>
            <SettingsSection
                icon={ShieldCheck}
                title="Sign-in & security"
                description="Your sign-in email, password and the devices you’re signed in on."
            >
                    {!security && loading ? (
                        <LoadingRows label="Loading your sign-in settings…" rows={3} />
                    ) : !security && loadFailed ? (
                        <LoadError
                            message="We couldn’t load your sign-in settings. Nothing was changed."
                            onRetry={() => void loadSecurity(false)}
                        />
                    ) : !security ? (
                        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-medium text-foreground">
                                    {hasPassword ? 'Confirm your password to continue' : 'Sign in again to continue'}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {hasPassword
                                        ? 'To protect your account, re-enter your password before viewing or changing these settings. They stay unlocked for five minutes.'
                                        : 'Your account doesn’t use a password, so sign in again to view or change these settings. They stay unlocked for five minutes after you sign in.'}
                                </p>
                            </div>
                            {hasPassword ? (
                                <Button className="shrink-0" onClick={() => setReauthOpen(true)} disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                                    Confirm password
                                </Button>
                            ) : (
                                <Button className="shrink-0" onClick={() => void signInAgain()} disabled={loading || !user || reauthLoading}>
                                    {loading || reauthLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                                    Sign in again
                                </Button>
                            )}
                        </div>
                    ) : (
                        <>
                            <section aria-labelledby="sign-in-methods-heading" className="space-y-3">
                                <div>
                                    <h3 id="sign-in-methods-heading" className="text-sm font-semibold text-foreground">Sign-in methods</h3>
                                    <p className="text-sm text-muted-foreground">The ways you can sign in to UtilitySheet.</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {security.methods.credential && <Badge variant="secondary">Email &amp; password</Badge>}
                                    {security.methods.magicLink && <Badge variant="secondary">Emailed sign-in link</Badge>}
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
                                    <p className="text-sm text-muted-foreground">Your primary email is the one you sign in with.</p>
                                </div>
                                <ul className="space-y-2">
                                    {security.contactChannels.map((channel) => (
                                        <li key={channel.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="min-w-0">
                                                <p className="break-all text-sm font-medium text-foreground">{channel.value}</p>
                                                <div className="mt-1 flex flex-wrap gap-1.5">
                                                    {channel.isPrimary && <Badge>Primary</Badge>}
                                                    <Badge variant={channel.isVerified ? 'secondary' : 'outline'}>{channel.isVerified ? 'Verified' : 'Waiting for verification'}</Badge>
                                                    {channel.usedForAuth && <Badge variant="outline">Can sign in</Badge>}
                                                </div>
                                            </div>
                                            {!channel.isPrimary && channel.isVerified && (
                                                <Button
                                                    variant="outline"
                                                    onClick={() => setConfirmation({
                                                        title: 'Make this your primary email?',
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
                                            aria-describedby="new-account-email-help"
                                            value={newEmail}
                                            onChange={(event) => setNewEmail(event.target.value)}
                                            required
                                        />
                                    </div>
                                    <Button type="submit" variant="outline" disabled={busyAction === 'begin_email_change'}>
                                        <Mail className="mr-2 h-4 w-4" />
                                        Send verification email
                                    </Button>
                                </form>
                                <p id="new-account-email-help" className="text-xs text-muted-foreground">
                                    To change your sign-in email: add the new address, open the verification email
                                    we send to it, then come back here and choose Make primary next to it.
                                </p>
                            </section>

                            <Separator />

                            <section aria-labelledby="active-sessions-heading" className="space-y-3">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <h3 id="active-sessions-heading" className="text-sm font-semibold text-foreground">Signed-in devices</h3>
                                        <p className="text-sm text-muted-foreground">Sign out any device you don’t recognize. To sign out of this one, use Sign out in Profile above.</p>
                                    </div>
                                    {security.sessions.some((session) => !session.isCurrentSession) && (
                                        <Button
                                            variant="outline"
                                            onClick={() => setConfirmation({
                                                title: 'Sign out everywhere else?',
                                                description: 'Every other device signed in to your UtilitySheet account is signed out. This device stays signed in.',
                                                confirmLabel: 'Sign out other devices',
                                                onConfirm: async () => {
                                                    await runSecurityAction({ action: 'revoke_other_sessions' }, 'Signed out everywhere else.');
                                                },
                                            })}
                                            disabled={busyAction === 'revoke_other_sessions'}
                                        >
                                            Sign out everywhere else
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
                                                        {session.isCurrentSession ? 'This device' : 'Another device'}
                                                        {session.isImpersonation ? ' · UtilitySheet support session' : ''}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {session.location || 'Location unknown'} · Last used {formatWhen(session.lastUsedAt || session.createdAt)}
                                                    </p>
                                                </div>
                                            </div>
                                            {!session.isCurrentSession && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setConfirmation({
                                                        title: 'Sign out this device?',
                                                        description: `The device last used ${formatWhen(session.lastUsedAt || session.createdAt)} is signed out of your UtilitySheet account.`,
                                                        confirmLabel: 'Sign out device',
                                                        onConfirm: async () => {
                                                            await runSecurityAction({ action: 'revoke_session', sessionId: session.id }, 'That device was signed out.');
                                                        },
                                                    })}
                                                    disabled={busyAction === 'revoke_session'}
                                                    aria-label={`Sign out the device last used ${formatWhen(session.lastUsedAt || session.createdAt)}`}
                                                >
                                                    Sign out
                                                </Button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        </>
                    )}
            </SettingsSection>

            <SettingsSection
                icon={FileSearch}
                title="Your data"
                description="Download a copy of your UtilitySheet data, or close your account."
            >
                    <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm font-medium text-foreground">Download your data</p>
                            <p className="text-sm text-muted-foreground">One file with your profile, settings, workspaces, requests, seller responses and summaries. It leaves out passwords and other security details. The file is in JSON format, which other software can read.</p>
                        </div>
                        <Button variant="outline" className="shrink-0" onClick={() => void downloadExport()} disabled={busyAction === 'export'}>
                            {busyAction === 'export' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Download my data
                        </Button>
                    </div>

                    <AccountClosureSection
                        onRecentAuthRequired={() => setReauthOpen(true)}
                        onDownloadExport={downloadExport}
                        exporting={busyAction === 'export'}
                    />
            </SettingsSection>

            <Dialog open={reauthOpen} onOpenChange={setReauthOpen}>
                <DialogContent>
                    {hasPassword ? (
                        <form onSubmit={submitPasswordConfirmation} className="space-y-4">
                            <DialogHeader>
                                <DialogTitle>Confirm your password</DialogTitle>
                                <DialogDescription>
                                    Re-enter your password to view and change sensitive account settings. You won’t be asked again for five minutes. Your password goes straight to our sign-in provider, not to UtilitySheet.
                                </DialogDescription>
                            </DialogHeader>
                            {reauthError && <p role="alert" className="text-sm text-destructive">{reauthError}</p>}
                            <div className="space-y-2">
                                <Label htmlFor="reauth-password">Password</Label>
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
                                    {reauthLoading ? 'Confirming…' : 'Confirm password'}
                                </Button>
                            </DialogFooter>
                        </form>
                    ) : (
                        <div className="space-y-4">
                            <DialogHeader>
                                <DialogTitle>Sign in again</DialogTitle>
                                <DialogDescription>
                                    Sensitive settings stay unlocked for five minutes after you sign in, and that time has passed. Your account doesn’t use a password, so sign in again the way you usually do. You’ll come back to Account settings.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setReauthOpen(false)}>Cancel</Button>
                                <Button type="button" onClick={() => void signInAgain()} disabled={reauthLoading}>
                                    {reauthLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                                    Sign in again
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
                <DialogContent>
                    <form onSubmit={changePassword} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Change password</DialogTitle>
                            <DialogDescription>Your current and new passwords go straight to our sign-in provider, not to UtilitySheet. After the change, your other devices are signed out.</DialogDescription>
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

            <ConfirmDialog
                open={Boolean(confirmation)}
                onOpenChange={(open) => { if (!open) setConfirmation(null); }}
                title={confirmation?.title || ''}
                description={confirmation?.description || ''}
                confirmLabel={confirmation?.confirmLabel || ''}
                onConfirm={() => {
                    const action = confirmation?.onConfirm;
                    setConfirmation(null);
                    if (action) void action();
                }}
            />
        </>
    );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useUser } from '@stackframe/stack';
import { AlertTriangle, Download, Loader2, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

export type ClosureBlocker = {
    code: string;
    message: string;
    action?: { label: string; href: string };
};

export type AccountClosureReview = {
    eligible: boolean;
    blockers: ClosureBlocker[];
    confirmationEmail: string;
    billing: { cancelsPersonalPlan: boolean; cancelsWorkspacePlans: string[] };
    personal: { requestCount: number; openRequestCount: number; profileCount: number; hasSellerForm: boolean };
    deletedWorkspaces: Array<{ id: string; name: string; requestCount: number; openRequestCount: number }>;
    sharedWorkspaces: Array<{
        id: string;
        name: string;
        ownedRequestCount: number;
        ownedProfileCount: number;
        needsTransfer: boolean;
        adminOptions: Array<{ accountId: string; name: string }>;
        defaultTransferAccountId: string | null;
    }>;
    forfeitedReferralCredits: number;
    pendingInvitations: number;
    supportEmail: string;
};

type AccountClosureSectionProps = {
    onRecentAuthRequired: () => void;
    onDownloadExport: () => Promise<void>;
    exporting: boolean;
};

const CLOSED_PATH = '/account-closed';

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
    return `${count} ${count === 1 ? singular : pluralForm}`;
}

async function readJson(response: Response) {
    return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

function initialTransfers(review: AccountClosureReview) {
    const transfers: Record<string, string> = {};
    for (const workspace of review.sharedWorkspaces) {
        if (workspace.needsTransfer && workspace.defaultTransferAccountId) {
            transfers[workspace.id] = workspace.defaultTransferAccountId;
        }
    }
    return transfers;
}

function consequenceList(review: AccountClosureReview) {
    const items: string[] = [];
    if (review.billing.cancelsPersonalPlan) {
        items.push('Your Pro plan is canceled right away. There’s no refund for time left on it.');
    }
    for (const name of review.billing.cancelsWorkspacePlans) {
        items.push(`The Team plan for ${name} is canceled right away, with no refund.`);
    }
    for (const workspace of review.deletedWorkspaces) {
        const open = workspace.openRequestCount > 0
            ? ` ${workspace.openRequestCount} of them ${workspace.openRequestCount === 1 ? 'is' : 'are'} still waiting on a seller.`
            : '';
        items.push(`The ${workspace.name} workspace is deleted with its ${plural(workspace.requestCount, 'request')} and Branding Profiles. Their seller and packet links stop working.${open}`);
    }
    if (review.personal.requestCount > 0) {
        const open = review.personal.openRequestCount > 0
            ? ` ${review.personal.openRequestCount} of them ${review.personal.openRequestCount === 1 ? 'is' : 'are'} still waiting on a seller.`
            : '';
        items.push(`${plural(review.personal.requestCount, 'personal request')} ${review.personal.requestCount === 1 ? 'is' : 'are'} deleted, and their links stop working.${open}`);
    }
    if (review.personal.profileCount > 0) {
        items.push(`${plural(review.personal.profileCount, 'personal Branding Profile')} ${review.personal.profileCount === 1 ? 'is' : 'are'} deleted.`);
    }
    if (review.personal.hasSellerForm) {
        items.push('Your reusable seller link stops working.');
    }
    for (const workspace of review.sharedWorkspaces) {
        items.push(workspace.needsTransfer
            ? `You leave ${workspace.name}. Your ${plural(workspace.ownedRequestCount, 'request')} and ${plural(workspace.ownedProfileCount, 'Branding Profile')} there move to the admin you choose below, and their links keep working.`
            : `You leave ${workspace.name}. Its requests and settings aren’t affected.`);
    }
    if (review.forfeitedReferralCredits > 0) {
        items.push(`${plural(review.forfeitedReferralCredits, 'unused referral credit')} ${review.forfeitedReferralCredits === 1 ? 'is' : 'are'} forfeited.`);
    }
    if (review.pendingInvitations > 0) {
        items.push(`${plural(review.pendingInvitations, 'pending workspace invitation')} to your email ${review.pendingInvitations === 1 ? 'is' : 'are'} canceled.`);
    }
    items.push('Your sign-in is deleted and you’re signed out everywhere.');
    items.push('We keep a record with no name or contact details, plus billing, referral, and security records.');
    return items;
}

export function AccountClosureSection({ onRecentAuthRequired, onDownloadExport, exporting }: AccountClosureSectionProps) {
    const user = useUser();
    const [loadingReview, setLoadingReview] = useState(false);
    const [open, setOpen] = useState(false);
    const [review, setReview] = useState<AccountClosureReview | null>(null);
    const [transfers, setTransfers] = useState<Record<string, string>>({});
    const [typedEmail, setTypedEmail] = useState('');
    const [acknowledged, setAcknowledged] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const applyReview = (next: AccountClosureReview) => {
        setReview(next);
        setTransfers((current) => ({ ...initialTransfers(next), ...pickValid(current, next) }));
    };

    const requireRecentAuth = () => {
        setOpen(false);
        onRecentAuthRequired();
        toast.error('Confirm it’s you, then open the closure review again.');
    };

    const loadReview = async () => {
        setLoadingReview(true);
        try {
            const response = await fetch('/api/account/closure', { cache: 'no-store' });
            const data = await readJson(response);
            if (response.status === 403 && data.code === 'RECENT_AUTH_REQUIRED') {
                requireRecentAuth();
                return;
            }
            if (!response.ok || !data.review) {
                throw new Error(String(data.error || 'We couldn’t load the closure review. Try again.'));
            }
            const next = data.review as AccountClosureReview;
            setReview(next);
            setTransfers(initialTransfers(next));
            setTypedEmail('');
            setAcknowledged(false);
            setSubmitError(null);
            setOpen(true);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'We couldn’t load the closure review. Try again.');
        } finally {
            setLoadingReview(false);
        }
    };

    const finishClosed = async () => {
        try {
            await user?.signOut({ redirectUrl: CLOSED_PATH });
        } catch {
            // The sign-in no longer exists; the page below explains the result.
        }
        window.location.assign(CLOSED_PATH);
    };

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!review) return;
        setSubmitting(true);
        setSubmitError(null);
        try {
            const response = await fetch('/api/account/closure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'close',
                    confirmationEmail: typedEmail.trim(),
                    acknowledged: true,
                    transfers,
                }),
            });
            const data = await readJson(response);
            if (response.status === 403 && data.code === 'RECENT_AUTH_REQUIRED') {
                requireRecentAuth();
                return;
            }
            if (response.ok && data.status === 'closed') {
                await finishClosed();
                return;
            }
            if (response.status === 202) {
                window.location.assign(CLOSED_PATH);
                return;
            }
            if (data.review) applyReview(data.review as AccountClosureReview);
            setSubmitError(String(data.error || 'We couldn’t close your account, and nothing was deleted. Try again.'));
        } catch {
            setSubmitError('We couldn’t reach UtilitySheet. Check your connection and try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const emailMatches = Boolean(review)
        && typedEmail.trim().toLowerCase() === review!.confirmationEmail.trim().toLowerCase();
    const transfersComplete = Boolean(review) && review!.sharedWorkspaces
        .filter((workspace) => workspace.needsTransfer)
        .every((workspace) => Boolean(transfers[workspace.id]));
    const canSubmit = Boolean(review?.eligible) && emailMatches && acknowledged && transfersComplete && !submitting;

    return (
        <div className="space-y-3 rounded-xl border border-destructive/30 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm font-medium text-foreground">Close account</p>
                    <p className="text-sm text-muted-foreground">
                        Permanently delete your account, cancel any plan you pay for, and remove your personal data. You’ll see exactly what happens before anything is deleted.
                    </p>
                </div>
                <Button variant="destructive" className="shrink-0" onClick={() => void loadReview()} disabled={loadingReview}>
                    {loadingReview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserX className="mr-2 h-4 w-4" />}
                    Review and close account
                </Button>
            </div>

            <Dialog open={open} onOpenChange={(next) => !submitting && setOpen(next)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Close your account</DialogTitle>
                        <DialogDescription>
                            Closing is immediate and permanent. We can’t restore your account or its data afterwards.
                        </DialogDescription>
                    </DialogHeader>

                    {review && !review.eligible && (
                        <section aria-labelledby="closure-blockers-heading" className="space-y-3">
                            <h3 id="closure-blockers-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
                                Before you can close your account
                            </h3>
                            <ul className="space-y-2">
                                {review.blockers.map((blocker) => (
                                    <li key={blocker.code + blocker.message} className="space-y-2 rounded-lg border border-border p-3 text-sm">
                                        <p className="text-foreground">{blocker.message}</p>
                                        {blocker.action && (
                                            blocker.action.href.startsWith('mailto:') ? (
                                                <a href={blocker.action.href} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                                                    {blocker.action.label}
                                                </a>
                                            ) : (
                                                <Link href={blocker.action.href} onClick={() => setOpen(false)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                                                    {blocker.action.label}
                                                </Link>
                                            )
                                        )}
                                    </li>
                                ))}
                            </ul>
                            <p className="text-sm text-muted-foreground">
                                Nothing has changed. When these are sorted, check again. Questions? Email{' '}
                                <a className="underline underline-offset-4" href={`mailto:${review.supportEmail}`}>{review.supportEmail}</a>.
                            </p>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button>
                                <Button type="button" onClick={() => void loadReview()} disabled={loadingReview}>
                                    {loadingReview && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Check again
                                </Button>
                            </DialogFooter>
                        </section>
                    )}

                    {review && review.eligible && (
                        <form onSubmit={submit} className="space-y-5">
                            <section aria-labelledby="closure-consequences-heading" className="space-y-2">
                                <h3 id="closure-consequences-heading" className="text-sm font-semibold text-foreground">What happens</h3>
                                <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                                    {consequenceList(review).map((item) => <li key={item}>{item}</li>)}
                                </ul>
                            </section>

                            {review.sharedWorkspaces.some((workspace) => workspace.needsTransfer) && (
                                <section aria-labelledby="closure-transfer-heading" className="space-y-3">
                                    <h3 id="closure-transfer-heading" className="text-sm font-semibold text-foreground">Who takes over your shared work</h3>
                                    {review.sharedWorkspaces.filter((workspace) => workspace.needsTransfer).map((workspace) => (
                                        <div key={workspace.id} className="space-y-1.5">
                                            <Label htmlFor={`closure-transfer-${workspace.id}`}>{workspace.name}</Label>
                                            <select
                                                id={`closure-transfer-${workspace.id}`}
                                                value={transfers[workspace.id] || ''}
                                                onChange={(event) => setTransfers((current) => ({ ...current, [workspace.id]: event.target.value }))}
                                                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
                                                required
                                            >
                                                {workspace.adminOptions.map((admin) => (
                                                    <option key={admin.accountId} value={admin.accountId}>{admin.name}</option>
                                                ))}
                                            </select>
                                            <p className="text-xs text-muted-foreground">
                                                This admin will own your requests there and get their seller notifications.
                                            </p>
                                        </div>
                                    ))}
                                </section>
                            )}

                            <section aria-labelledby="closure-export-heading" className="space-y-2 rounded-lg bg-muted/30 p-3">
                                <h3 id="closure-export-heading" className="text-sm font-semibold text-foreground">Keep a copy (optional)</h3>
                                <p className="text-sm text-muted-foreground">Download your data before you close. You won’t be able to afterwards.</p>
                                <Button type="button" variant="outline" size="sm" onClick={() => void onDownloadExport()} disabled={exporting}>
                                    {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                    Download my data
                                </Button>
                            </section>

                            <section aria-labelledby="closure-confirm-heading" className="space-y-3">
                                <h3 id="closure-confirm-heading" className="text-sm font-semibold text-foreground">Confirm</h3>
                                <div className="space-y-1.5">
                                    <Label htmlFor="closure-confirm-email">
                                        Type <span className="font-semibold break-all">{review.confirmationEmail}</span> to confirm
                                    </Label>
                                    <Input
                                        id="closure-confirm-email"
                                        type="email"
                                        autoComplete="off"
                                        spellCheck={false}
                                        value={typedEmail}
                                        onChange={(event) => setTypedEmail(event.target.value)}
                                        required
                                    />
                                </div>
                                <div className="flex items-start gap-2">
                                    <Checkbox
                                        id="closure-acknowledge"
                                        checked={acknowledged}
                                        onCheckedChange={(checked) => setAcknowledged(checked === true)}
                                        className="mt-0.5"
                                    />
                                    <Label htmlFor="closure-acknowledge" className="text-sm font-normal leading-snug">
                                        I understand this permanently closes my account and can’t be undone.
                                    </Label>
                                </div>
                            </section>

                            {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
                                <Button type="submit" variant="destructive" disabled={!canSubmit}>
                                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {submitting ? 'Closing your account…' : 'Close account permanently'}
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function pickValid(current: Record<string, string>, review: AccountClosureReview) {
    const valid: Record<string, string> = {};
    for (const workspace of review.sharedWorkspaces) {
        const selected = current[workspace.id];
        if (selected && workspace.adminOptions.some((admin) => admin.accountId === selected)) {
            valid[workspace.id] = selected;
        }
    }
    return valid;
}

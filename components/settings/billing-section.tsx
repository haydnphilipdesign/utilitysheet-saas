'use client';

import { useState } from 'react';
import { CheckCircle2, CreditCard, ExternalLink, Loader2, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { InlineStatus, LoadError, LoadingRows, Note, SettingsSection } from './settings-ui';
import {
    TEAM_MIN_SEATS,
    TEAM_PRICE_PER_SEAT_USD,
    type ActiveOrganization,
    type CheckoutReturn,
    type LoadState,
    type SeatUsage,
    type Usage,
} from './types';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const PLAN_NAMES = { pro: 'Pro', team: 'Teams' } as const;
const longDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' });

/** A stored end date as "November 3, 2026" in the reader's time zone, or null. */
function formatPlanEnd(value: string | null): string | null {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? longDate.format(date) : null;
}

/** What came back from checkout. The plan card below always shows the loaded account. */
function CheckoutBanner({ checkout, onCheckAgain, onDismiss }: {
    checkout: CheckoutReturn;
    onCheckAgain: () => void;
    onDismiss: () => void;
}) {
    const plan = PLAN_NAMES[checkout.plan];
    if (checkout.status === 'confirming') {
        return (
            <div role="status" className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
                <p className="text-foreground">
                    Confirming your {plan} checkout with Stripe. This usually takes a few seconds, and the plan
                    below updates when it is confirmed.
                </p>
            </div>
        );
    }
    if (checkout.status === 'confirmed') {
        return (
            <div role="status" className="flex flex-col gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-start gap-2 text-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    You’re on {plan}. Thanks for upgrading.
                </p>
                <Button variant="outline" size="sm" className="shrink-0" onClick={onDismiss}>Dismiss</Button>
            </div>
        );
    }
    return (
        <div role="status" className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-foreground">
                {checkout.status === 'unconfirmed'
                    ? `We haven’t received confirmation of your ${plan} checkout yet. If you finished paying, it can take a minute to show here. The plan below is what is active right now.`
                    : 'Checkout wasn’t completed. The plan below is your current plan.'}
            </p>
            <div className="flex shrink-0 gap-2">
                {checkout.status === 'unconfirmed' && (
                    <Button variant="outline" size="sm" onClick={onCheckAgain}>Check again</Button>
                )}
                <Button variant="outline" size="sm" onClick={onDismiss}>Dismiss</Button>
            </div>
        </div>
    );
}

/** The way to a subscription the server found, shown under the refusal it explains. */
function PortalButton({ workspace, busy, onOpen }: {
    workspace: boolean;
    busy: 'plan' | 'teams' | null;
    onOpen: () => void;
}) {
    return (
        <Button variant="outline" onClick={onOpen} disabled={busy !== null}>
            {busy !== null ? <Loader2 className="animate-spin" /> : <ExternalLink />}
            {workspace ? 'Manage Teams billing' : 'Manage subscription'}
        </Button>
    );
}

export function BillingSection({
    state, onRetry, usage, planEndsAt, trialEndsAt, organization, isTeam, isAdmin, seatUsage,
    checkout, onCheckAgain, onDismissCheckout, onOpenWorkspace,
}: {
    state: LoadState;
    onRetry: () => void;
    usage: Usage | null;
    /** When the current paid plan is set to end; null when it renews. */
    planEndsAt: string | null;
    /** When the Pro free month ends; null when the account is not in a trial. */
    trialEndsAt: string | null;
    organization: ActiveOrganization | null;
    isTeam: boolean;
    isAdmin: boolean;
    /** Null until the workspace's seats have loaded. */
    seatUsage: SeatUsage | null;
    checkout: CheckoutReturn | null;
    onCheckAgain: () => void;
    onDismissCheckout: () => void;
    onOpenWorkspace: () => void;
}) {
    const [busy, setBusy] = useState<'plan' | 'teams' | null>(null);
    const [planError, setPlanError] = useState('');
    const [portalOffer, setPortalOffer] = useState<{ target: 'plan' | 'teams'; workspace: boolean } | null>(null);
    const [teamsError, setTeamsError] = useState('');
    const [seatInput, setSeatInput] = useState(String(TEAM_MIN_SEATS));

    const banner = checkout && (
        <CheckoutBanner checkout={checkout} onCheckAgain={onCheckAgain} onDismiss={onDismissCheckout} />
    );

    // Until the account has loaded there is no plan to show and nothing to buy.
    if (state !== 'ready' || !usage) {
        return (
            <>
                {banner}
                <SettingsSection icon={CreditCard} title="Your plan" description="What you’re on now, and where to change it.">
                    {state === 'error' ? (
                        <LoadError
                            message="We couldn’t load your plan. Nothing about your billing has changed."
                            onRetry={onRetry}
                        />
                    ) : (
                        <LoadingRows label="Loading your plan…" />
                    )}
                </SettingsSection>
            </>
        );
    }

    const isPro = usage.plan === 'pro';
    const isFree = !isTeam && !isPro;
    const seatsInUse = seatUsage ? seatUsage.used + seatUsage.pendingInvites : null;
    const planEnd = isFree ? null : formatPlanEnd(planEndsAt);
    // A plan that is set to cancel already says when it ends.
    const trialEnd = isPro && !planEnd ? formatPlanEnd(trialEndsAt) : null;
    // A second checkout while the first is still being confirmed could charge twice.
    const confirming = checkout?.status === 'confirming';

    /** Sends the browser to Stripe; anything else is shown beside the button. */
    async function openStripe(url: string, target: 'plan' | 'teams', fallback: string, body?: unknown) {
        const setError = target === 'plan' ? setPlanError : setTeamsError;
        setBusy(target);
        setError('');
        setPortalOffer((offer) => (offer?.target === target ? null : offer));
        try {
            const response = await fetch(url, {
                method: 'POST',
                ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
            });
            const data = await response.json().catch(() => ({}));
            if (data.url) {
                window.location.href = data.url;
                return;
            }
            setError(data.message || data.error || fallback);
            // The server found a subscription this page does not show yet.
            if (data.manageBilling) setPortalOffer({ target, workspace: data.manageBilling === 'workspace' });
        } catch {
            setError(fallback);
        }
        setBusy(null);
    }

    /** Opens the portal for the subscription the server found in the way of a checkout. */
    const openOfferedPortal = () => {
        if (!portalOffer) return;
        void openStripe(
            portalOffer.workspace ? '/api/organization/billing/portal' : '/api/billing/portal',
            portalOffer.target,
            'We couldn’t open billing. Try again.',
        );
    };

    // Same rules the server applies before it creates a Teams checkout.
    const seatText = seatInput.trim();
    const seats = /^\d+$/.test(seatText) ? Number(seatText) : null;
    const seatProblem = seatText === ''
        ? 'Enter how many seats you need.'
        : seats === null
            ? 'Enter a whole number of seats.'
            : seats < TEAM_MIN_SEATS
                ? `Teams starts at ${TEAM_MIN_SEATS} seats.`
                : seatsInUse !== null && seats < seatsInUse
                    ? `This workspace already uses ${seatsInUse} seats (members and pending invitations), so choose at least ${seatsInUse}.`
                    : '';

    return (
        <>
            {banner}
            <SettingsSection icon={CreditCard} title="Your plan" description="What you’re on now, and where to change it.">
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <p className="font-medium text-foreground">
                            {isTeam ? 'Teams plan' : isPro ? 'Pro plan' : 'Free plan'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {isTeam
                                ? `Unlimited submitted sheets${seatsInUse !== null ? ` · ${seatsInUse} of ${organization?.seat_quantity ?? '—'} seats in use` : ''}`
                                : isPro
                                    ? 'Unlimited submitted sheets'
                                    : `${usage.limit} submitted sheets a month`}
                        </p>
                    </div>
                    {isTeam ? (
                        isAdmin && (
                            <Button
                                variant="outline"
                                className="shrink-0"
                                onClick={() => void openStripe('/api/organization/billing/portal', 'plan', 'We couldn’t open Teams billing. Try again.')}
                                disabled={busy !== null}
                            >
                                {busy === 'plan' ? <Loader2 className="animate-spin" /> : <ExternalLink />}
                                Manage Teams billing
                            </Button>
                        )
                    ) : isPro ? (
                        <Button
                            variant="outline"
                            className="shrink-0"
                            onClick={() => void openStripe('/api/billing/portal', 'plan', 'We couldn’t open billing. Try again.')}
                            disabled={busy !== null}
                        >
                            {busy === 'plan' ? <Loader2 className="animate-spin" /> : <ExternalLink />}
                            Manage subscription
                        </Button>
                    ) : (
                        <Button
                            className="shrink-0"
                            onClick={() => void openStripe('/api/billing/checkout', 'plan', 'We couldn’t start checkout. Try again.')}
                            disabled={busy !== null || confirming}
                        >
                            {busy === 'plan' ? <Loader2 className="animate-spin" /> : <Sparkles />}
                            Upgrade to Pro, $9/mo
                        </Button>
                    )}
                </div>
                {planError && <InlineStatus tone="error">{planError}</InlineStatus>}
                {portalOffer?.target === 'plan' && (
                    <PortalButton workspace={portalOffer.workspace} busy={busy} onOpen={openOfferedPortal} />
                )}
                {trialEnd && (
                    <Note>
                        <span className="font-medium text-foreground">Your free month of Pro ends on {trialEnd}.</span>{' '}
                        To keep Pro after that, add a payment method in Manage subscription. If you’ve already
                        added one, there’s nothing more to do.
                    </Note>
                )}
                {planEnd && (
                    <Note>
                        <span className="font-medium text-foreground">
                            Your {isTeam ? 'Teams' : 'Pro'} plan is set to end on {planEnd}.
                        </span>{' '}
                        {isTeam
                            ? 'Everyone in this workspace keeps Teams until then.'
                            : 'You keep everything in Pro until then.'}{' '}
                        {isTeam && !isAdmin
                            ? 'A workspace admin can keep the plan going.'
                            : `To keep the plan, choose ${isTeam ? 'Manage Teams billing' : 'Manage subscription'} and renew it.`}
                    </Note>
                )}

                {isTeam && !isAdmin ? (
                    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                            Your workspace admins manage this plan, its seats and its invoices. They are listed in Workspace &amp; Team.
                        </p>
                        <Button variant="outline" className="shrink-0" onClick={onOpenWorkspace}>
                            See workspace admins
                        </Button>
                    </div>
                ) : !isFree ? (
                    <p className="text-xs text-muted-foreground">
                        {isTeam ? 'Manage Teams billing' : 'Manage subscription'} opens Stripe, our payment provider. Invoices,
                        payment methods{isTeam ? ', the number of seats' : ''} and plan changes are all handled there.
                    </p>
                ) : null}

                {isFree && (
                    <div className="space-y-2 rounded-lg border border-border bg-muted/50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p id="usageLabel" className="text-sm text-muted-foreground">Submitted sheets this month</p>
                            <p className="text-sm font-medium text-foreground">{usage.used} of {usage.limit}</p>
                        </div>
                        <div
                            role="progressbar"
                            aria-labelledby="usageLabel"
                            aria-valuemin={0}
                            aria-valuemax={usage.limit}
                            aria-valuenow={Math.min(usage.used, usage.limit)}
                            className="h-3 w-full overflow-hidden rounded-full border border-border bg-background"
                        >
                            <div
                                className={cn(
                                    'h-full rounded-full transition-all duration-500 ease-out',
                                    usage.used >= usage.limit
                                        ? 'bg-destructive'
                                        : usage.used >= usage.limit * 0.8
                                            ? 'bg-amber-500'
                                            : 'bg-primary',
                                )}
                                style={{ width: `${Math.min((usage.used / usage.limit) * 100, 100)}%` }}
                            />
                        </div>
                        {usage.used >= usage.limit && (
                            <p className="text-sm text-destructive">
                                You’ve used this month’s free submitted sheets. You can still send requests, but new
                                seller submissions stay locked until you upgrade.
                            </p>
                        )}
                    </div>
                )}

                <p className="text-xs text-muted-foreground">
                    A request is what you send to a seller. It becomes a submitted sheet when the seller completes it.
                    You can send as many requests as you like on every plan
                    {isFree ? `; Free includes ${usage.limit} submitted sheets each calendar month.` : '.'}
                </p>
            </SettingsSection>

            {!isTeam && organization && (
                <SettingsSection
                    icon={Users}
                    title="Teams"
                    description={isPro
                        ? 'For working with other people. Your Pro plan becomes a Teams plan, so you won’t have two subscriptions.'
                        : 'For working with other people. Everyone shares one workspace and one bill.'}
                >
                    <div className="space-y-1 rounded-lg border border-border bg-muted/30 p-4">
                        <p className="text-sm font-medium text-foreground">
                            {usd.format(TEAM_PRICE_PER_SEAT_USD)} per seat each month, {TEAM_MIN_SEATS} seat minimum
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Each seat is one person. Everyone gets everything in Pro, works in the same workspace as an
                            admin or a member, and is covered by a single bill. You invite people in Workspace &amp; Team
                            after the plan starts.
                        </p>
                    </div>

                    {isAdmin ? (
                        <div className="space-y-2">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                <div className="space-y-2 sm:w-40">
                                    <Label htmlFor="teamSeats">Number of seats</Label>
                                    <Input
                                        id="teamSeats"
                                        inputMode="numeric"
                                        autoComplete="off"
                                        value={seatInput}
                                        onChange={(event) => {
                                            setTeamsError('');
                                            setSeatInput(event.target.value);
                                        }}
                                        disabled={busy !== null}
                                        aria-invalid={seatProblem !== ''}
                                        aria-describedby="teamSeatsHelp"
                                    />
                                </div>
                                <Button
                                    onClick={() => void openStripe(
                                        '/api/organization/billing/checkout',
                                        'teams',
                                        'We couldn’t start Teams checkout. Try again.',
                                        { seats },
                                    )}
                                    disabled={busy !== null || confirming || seatProblem !== ''}
                                >
                                    {busy === 'teams' ? <Loader2 className="animate-spin" /> : <Sparkles />}
                                    {isPro ? 'Upgrade Pro to Teams' : 'Start Teams'}
                                </Button>
                            </div>
                            <div id="teamSeatsHelp">
                                {seatProblem ? (
                                    <InlineStatus>{seatProblem}</InlineStatus>
                                ) : (
                                    <p className="text-sm text-foreground">
                                        Estimated{' '}
                                        <span className="font-semibold">{usd.format((seats ?? 0) * TEAM_PRICE_PER_SEAT_USD)}/mo</span>
                                        {' '}for {seats} seats.{' '}
                                        <span className="text-muted-foreground">
                                            {isPro
                                                ? 'Stripe adds the prorated difference from Pro to your next invoice.'
                                                : 'You confirm the price in Stripe before you pay.'}
                                        </span>
                                    </p>
                                )}
                            </div>
                            {teamsError && <InlineStatus tone="error">{teamsError}</InlineStatus>}
                            {portalOffer?.target === 'teams' && (
                                <PortalButton workspace={portalOffer.workspace} busy={busy} onOpen={openOfferedPortal} />
                            )}
                        </div>
                    ) : (
                        <Note>Only a workspace admin can start a Teams plan and choose how many seats it has.</Note>
                    )}
                </SettingsSection>
            )}
        </>
    );
}

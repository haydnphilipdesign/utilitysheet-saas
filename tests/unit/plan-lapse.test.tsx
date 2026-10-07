import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
    default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
        <a href={href} {...props}>{children}</a>
    ),
}));

import { PlanLapseBanner } from '@/components/plan-lapse-banner';
import { BillingSection } from '@/components/settings/billing-section';
import { readPlanLapse } from '@/components/settings/plan-lapse';
import type { ActiveOrganization } from '@/components/settings/types';
import { getSubscriptionLapseReason } from '@/lib/stripe/subscriptions';

vi.mock('@/lib/stripe/client', () => ({ stripe: null }));

const LAPSED_AT = '2026-09-28T16:00:00.000Z';

function workspace(overrides: Partial<ActiveOrganization> = {}): ActiveOrganization {
    return {
        id: 'org_1',
        name: 'Riverbend Transaction Services',
        role: 'admin',
        subscription_status: 'free',
        seat_quantity: 0,
        subscription_lapse_reason: 'payment_failed',
        subscription_lapsed_at: LAPSED_AT,
        ...overrides,
    };
}

function renderBilling(organization: ActiveOrganization) {
    return render(
        <BillingSection
            state="ready"
            onRetry={() => undefined}
            usage={{ used: 1, limit: 3, plan: 'free' }}
            planEndsAt={null}
            trialEndsAt={null}
            organization={organization}
            isTeam={organization.subscription_status === 'team'}
            isAdmin={organization.role === 'admin'}
            seatUsage={{ used: 3, pendingInvites: 0 }}
            checkout={null}
            onCheckAgain={() => undefined}
            onDismissCheckout={() => undefined}
            onOpenWorkspace={() => undefined}
            onSeatsChanged={() => undefined}
        />,
    );
}

describe('why a subscription stopped', () => {
    it('reads Stripe’s status in the customer’s terms', () => {
        const reason = (status: string, cancellation?: string) => getSubscriptionLapseReason({
            status,
            cancellation_details: cancellation ? { reason: cancellation } : null,
        } as Parameters<typeof getSubscriptionLapseReason>[0]);

        expect(reason('past_due')).toBe('payment_failed');
        expect(reason('unpaid')).toBe('payment_failed');
        expect(reason('canceled', 'payment_failed')).toBe('payment_failed_ended');
        expect(reason('canceled', 'cancellation_requested')).toBe('ended');
        expect(reason('canceled')).toBe('ended');
        expect(reason('paused')).toBe('ended');
        expect(reason('active')).toBeNull();
        expect(reason('trialing')).toBeNull();
        expect(reason('incomplete')).toBeNull();
        expect(reason('incomplete_expired')).toBeNull();
    });

    it('is shown only for a workspace that is not on Teams and has a known reason', () => {
        expect(readPlanLapse(workspace())).toEqual({ reason: 'payment_failed', date: 'September 28, 2026' });
        expect(readPlanLapse(workspace({ subscription_lapsed_at: null }))).toEqual({ reason: 'payment_failed', date: null });
        expect(readPlanLapse(workspace({ subscription_status: 'team' }))).toBeNull();
        expect(readPlanLapse(workspace({ subscription_lapse_reason: null }))).toBeNull();
        expect(readPlanLapse({ subscription_status: 'free', subscription_lapse_reason: 'something_else' })).toBeNull();
        expect(readPlanLapse(null)).toBeNull();
    });
});

describe('Billing when the Teams payment failed', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Billing is not available in this test.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        })));
    });

    it('tells an admin what happened, that nothing was lost, and opens Stripe to fix the card', async () => {
        renderBilling(workspace());

        const notice = screen.getByText('Teams is paused because the last payment didn’t go through.').closest('[role="status"]') as HTMLElement;
        expect(notice).toHaveTextContent('Since September 28, 2026 this workspace has been on the Free plan.');
        expect(notice).toHaveTextContent('Nothing was deleted, and everyone is still a member.');
        expect(notice).toHaveTextContent('When the payment goes through, Teams comes back by itself.');

        // The subscription still exists, so a second one is not offered.
        expect(screen.queryByRole('button', { name: 'Start Teams' })).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Number of seats')).not.toBeInTheDocument();
        expect(screen.getByText(/Your Teams plan is paused, not gone/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Manage Teams billing' }));
        await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/organization/billing/portal', { method: 'POST' }));
    });

    it('tells a member who can fix it and offers no billing action', () => {
        renderBilling(workspace({ role: 'member' }));

        expect(screen.getByText('Teams is paused because the last payment didn’t go through.')).toBeInTheDocument();
        expect(screen.getByText(/A workspace admin can bring Teams back in Billing\./)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Manage Teams billing|Start Teams/ })).not.toBeInTheDocument();
    });
});

describe('Billing when the Teams plan has ended', () => {
    it.each([
        ['payment_failed_ended', 'Your Teams plan ended on September 28, 2026 because the payment didn’t go through.'],
        ['ended', 'Your Teams plan ended on September 28, 2026.'],
    ] as const)('says so for %s and leaves Start Teams available', (reason, headline) => {
        renderBilling(workspace({ subscription_lapse_reason: reason }));

        expect(screen.getByText(headline)).toBeInTheDocument();
        expect(screen.getByText(/To bring Teams back, start it again below\./)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Start Teams' })).toBeEnabled();
        expect(screen.queryByRole('button', { name: 'Manage Teams billing' })).not.toBeInTheDocument();
    });

    it('shows nothing extra for a workspace that never had Teams, or is on it', () => {
        const { unmount } = renderBilling(workspace({ subscription_lapse_reason: null, subscription_lapsed_at: null }));
        expect(screen.queryByText(/Teams plan ended|Teams is paused/)).not.toBeInTheDocument();
        unmount();

        renderBilling(workspace({ subscription_status: 'team', seat_quantity: 4 }));
        expect(screen.queryByText(/Teams plan ended|Teams is paused/)).not.toBeInTheDocument();
    });
});

describe('PlanLapseBanner', () => {
    it('sends an admin to Billing while the payment can still be fixed', () => {
        render(<PlanLapseBanner organization={workspace()} />);

        expect(screen.getByRole('status')).toHaveTextContent('Teams is paused because the last payment didn’t go through.');
        expect(screen.getByRole('status')).toHaveTextContent('You can update the card in Billing.');
        expect(screen.getByRole('link')).toHaveAttribute('href', '/dashboard/settings?tab=billing');
    });

    it('tells a member without offering a billing link', () => {
        render(<PlanLapseBanner organization={workspace({ role: 'member' })} />);

        expect(screen.getByRole('status')).toHaveTextContent('A workspace admin can fix it in Billing.');
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('stays off every page once the plan has ended, is active, or was never bought', () => {
        for (const organization of [
            workspace({ subscription_lapse_reason: 'ended' }),
            workspace({ subscription_lapse_reason: 'payment_failed_ended' }),
            workspace({ subscription_status: 'team' }),
            workspace({ subscription_lapse_reason: null }),
            null,
        ]) {
            const { container, unmount } = render(<PlanLapseBanner organization={organization} />);
            expect(container).toBeEmptyDOMElement();
            unmount();
        }
    });
});

import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SettingsPage from '@/app/dashboard/settings/page';

vi.mock('@stackframe/stack', () => {
    const user = { id: 'user_1', displayName: 'Test User', primaryEmail: 'test@example.com', signOut: vi.fn() };
    return { useUser: () => user };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }));
vi.mock('@/components/settings/account-security', () => ({ AccountSecuritySettings: () => null }));
vi.mock('@/components/seller-forms/FormsWorkspace', () => ({ FormsWorkspace: () => <div>Saved seller forms</div> }));

type Handler = (init: RequestInit | undefined) => Response | Promise<Response>;

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Routes are keyed "METHOD /path"; anything else is a 404. */
function stubFetch(routes: Record<string, Handler>) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : String(input);
        const handler = routes[`${(init?.method || 'GET').toUpperCase()} ${url}`];
        return handler ? handler(init) : jsonResponse({ error: 'Not found' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

function bodiesOf(fetchMock: ReturnType<typeof stubFetch>, method: string, url: string) {
    return fetchMock.mock.calls
        .filter(([input, init]) => input === url && (init?.method || 'GET') === method)
        .map(([, init]) => JSON.parse(String(init?.body || '{}')));
}

const preferences = { seller_submissions: true, seller_submission_pdf_attachment: true, contact_resolution: true };

function soloAccount(plan: 'free' | 'pro' = 'free') {
    return {
        account: { id: 'acc_1', full_name: 'Test User', email: 'test@example.com', notification_preferences: preferences },
        activeOrganization: { id: 'org_1', name: 'Solo Workspace', role: 'admin', subscription_status: 'free' },
        usage: plan === 'pro' ? { used: 4, limit: 999999, plan: 'pro' } : { used: 1, limit: 3, plan: 'free' },
    };
}

function teamAccount(role: 'admin' | 'member') {
    return {
        account: { id: 'acc_1', full_name: 'Test User', email: 'test@example.com', notification_preferences: preferences },
        activeOrganization: { id: 'org_1', name: 'Team Workspace', role, subscription_status: 'team', seat_quantity: 5 },
        usage: { used: 0, limit: 999999, plan: 'team' },
    };
}

function teamRoutes(role: 'admin' | 'member'): Record<string, Handler> {
    return {
        'GET /api/account': () => jsonResponse(teamAccount(role)),
        'GET /api/organization/members': () => jsonResponse({
            organization: { id: 'org_1', name: 'Team Workspace', subscription_status: 'team', seat_quantity: 5 },
            role,
            members: [
                { account_id: 'acc_1', email: 'test@example.com', full_name: 'Test User', member_role: role },
                { account_id: 'acc_2', email: 'pat@example.com', full_name: 'Pat Lee', member_role: 'admin' },
            ],
            seatUsage: { used: 2, pendingInvites: 0 },
        }),
        'GET /api/organization/invites': () => jsonResponse({ invites: [] }),
    };
}

const soloMembers: Handler = () => jsonResponse({
    organization: { id: 'org_1', name: 'Solo Workspace', subscription_status: 'free' },
    role: 'admin',
    members: [{ account_id: 'acc_1', email: 'test@example.com', full_name: 'Test User', member_role: 'admin' }],
    seatUsage: { used: 1, pendingInvites: 0 },
});

async function openTab(name: string) {
    fireEvent.click(await screen.findByRole('tab', { name }));
}

beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/dashboard/settings');
});

afterEach(() => {
    window.history.replaceState({}, '', '/');
});

describe('settings loading and failed loads', () => {
    it('shows no plan and no checkout while the account is loading', async () => {
        let resolveAccount!: (response: Response) => void;
        stubFetch({
            'GET /api/account': () => new Promise<Response>((resolve) => { resolveAccount = resolve; }),
            'GET /api/organization/members': soloMembers,
        });
        render(<SettingsPage />);
        await openTab('Billing');

        expect(screen.getByText('Loading your plan…')).toBeInTheDocument();
        expect(screen.queryByText('Free plan')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Upgrade to Pro/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Start Teams' })).not.toBeInTheDocument();

        resolveAccount(jsonResponse(soloAccount('pro')));
        expect(await screen.findByText('Pro plan')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Manage subscription' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Upgrade to Pro,/ })).not.toBeInTheDocument();
    });

    it('offers a retry instead of defaults on every tab when the account fails to load', async () => {
        let fail = true;
        const fetchMock = stubFetch({
            'GET /api/account': () => (fail ? jsonResponse({ error: 'Internal server error' }, 500) : jsonResponse(soloAccount())),
            'GET /api/organization/members': soloMembers,
        });
        render(<SettingsPage />);

        expect(await screen.findByText('We couldn’t load your profile. Nothing was changed.')).toBeInTheDocument();
        expect(screen.queryByLabelText('Full name')).not.toBeInTheDocument();

        await openTab('Notifications');
        expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load your notification settings.');
        expect(screen.queryByRole('switch')).not.toBeInTheDocument();

        await openTab('Workspace & Team');
        expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load your workspace.');

        await openTab('Billing');
        expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load your plan. Nothing about your billing has changed.');
        expect(screen.queryByRole('button', { name: /Upgrade|Manage|Start Teams/ })).not.toBeInTheDocument();
        expect(bodiesOf(fetchMock, 'POST', '/api/account')).toHaveLength(0);

        fail = false;
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(await screen.findByText('Free plan')).toBeInTheDocument();
        expect(screen.getByText('1 of 3')).toBeInTheDocument();
    });

    it('shows a retry when the member list fails to load', async () => {
        let fail = true;
        stubFetch({
            ...teamRoutes('admin'),
            'GET /api/organization/members': (init) => (fail
                ? jsonResponse({ error: 'Internal server error' }, 500)
                : teamRoutes('admin')['GET /api/organization/members'](init)),
        });
        render(<SettingsPage />);
        await openTab('Workspace & Team');

        expect(await screen.findByText('We couldn’t load the members of this workspace.')).toBeInTheDocument();
        expect(screen.queryByText('No members to show.')).not.toBeInTheDocument();

        fail = false;
        fireEvent.click(screen.getAllByRole('button', { name: 'Try again' }).at(-1)!);
        expect(await screen.findByText('Pat Lee')).toBeInTheDocument();
    });

    it('explains a failed referral load instead of leaving the tab blank', async () => {
        let fail = true;
        stubFetch({
            'GET /api/account': () => jsonResponse(soloAccount()),
            'GET /api/organization/members': soloMembers,
            'GET /api/referrals': () => (fail ? jsonResponse({ error: 'Internal server error' }, 500) : jsonResponse({
                referralLink: 'https://utilitysheet.com/auth/signup?ref=me',
                counts: { earned: 0, applied: 0 },
                referralAttribution: { code: null, canClaim: false, status: 'unavailable' },
            })),
        });
        render(<SettingsPage />);
        await openTab('Referrals');

        expect(await screen.findByText('We couldn’t load your referral link. Your credits are not affected.')).toBeInTheDocument();
        fail = false;
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(await screen.findByDisplayValue('https://utilitysheet.com/auth/signup?ref=me')).toBeInTheDocument();
    });
});

describe('profile save', () => {
    it('saves only the name and shows unchanged, unsaved and saved states', async () => {
        const fetchMock = stubFetch({
            'GET /api/account': () => jsonResponse(soloAccount()),
            'GET /api/organization/members': soloMembers,
            'POST /api/account': () => jsonResponse({ account: { id: 'acc_1' } }),
        });
        render(<SettingsPage />);

        const name = await screen.findByLabelText('Full name');
        const save = screen.getByRole('button', { name: 'Save profile' });
        expect(save).toBeDisabled();
        expect(screen.getByText('All changes saved')).toBeInTheDocument();

        fireEvent.change(name, { target: { value: 'New Name' } });
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
        expect(save).toBeEnabled();

        fireEvent.click(save);
        expect(await screen.findByText('Profile saved')).toBeInTheDocument();
        expect(bodiesOf(fetchMock, 'POST', '/api/account')).toEqual([{ full_name: 'New Name' }]);
        expect(screen.getByRole('button', { name: 'Save profile' })).toBeDisabled();
    });

    it('keeps the edit and says so when the save fails', async () => {
        stubFetch({
            'GET /api/account': () => jsonResponse(soloAccount()),
            'GET /api/organization/members': soloMembers,
            'POST /api/account': () => jsonResponse({ error: 'Internal server error' }, 500),
        });
        render(<SettingsPage />);

        fireEvent.change(await screen.findByLabelText('Full name'), { target: { value: 'New Name' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t save your name.');
        expect(screen.getByLabelText('Full name')).toHaveValue('New Name');
        expect(screen.queryByText('Profile saved')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save profile' })).toBeEnabled();
    });
});

describe('notification saves', () => {
    it('confirms a saved change beside the switch', async () => {
        stubFetch({
            'GET /api/account': () => jsonResponse(soloAccount()),
            'GET /api/organization/members': soloMembers,
            'POST /api/account': () => jsonResponse({ account: { id: 'acc_1' } }),
        });
        render(<SettingsPage />);
        await openTab('Notifications');

        fireEvent.click(await screen.findByRole('switch', { name: 'Missing provider contact alerts' }));
        expect(await screen.findByText('Saved')).toBeInTheDocument();
        expect(screen.getByRole('switch', { name: 'Missing provider contact alerts' })).not.toBeChecked();
    });

    it('puts the switch back and says so when the save fails', async () => {
        stubFetch({
            'GET /api/account': () => jsonResponse(soloAccount()),
            'GET /api/organization/members': soloMembers,
            'POST /api/account': () => jsonResponse({ error: 'Internal server error' }, 500),
        });
        render(<SettingsPage />);
        await openTab('Notifications');

        const toggle = await screen.findByRole('switch', { name: 'Missing provider contact alerts' });
        expect(toggle).toBeChecked();
        fireEvent.click(toggle);

        expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t save that, so it’s back to what was saved.');
        expect(screen.getByRole('switch', { name: 'Missing provider contact alerts' })).toBeChecked();
        expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    });

    it('sends rapid changes one at a time and ends on the last one', async () => {
        const pending: Array<(response: Response) => void> = [];
        const fetchMock = stubFetch({
            'GET /api/account': () => jsonResponse(soloAccount()),
            'GET /api/organization/members': soloMembers,
            'POST /api/account': () => new Promise<Response>((resolve) => { pending.push(resolve); }),
        });
        render(<SettingsPage />);
        await openTab('Notifications');

        fireEvent.click(await screen.findByRole('switch', { name: 'Missing provider contact alerts' }));
        fireEvent.click(screen.getByRole('switch', { name: 'Attach PDF to submission emails' }));
        fireEvent.click(screen.getByRole('switch', { name: 'Attach PDF to submission emails' }));
        fireEvent.click(screen.getByRole('switch', { name: 'Attach PDF to submission emails' }));
        expect(screen.getByText('Saving…')).toBeInTheDocument();
        expect(pending).toHaveLength(1);

        pending[0](jsonResponse({ account: { id: 'acc_1' } }));
        await waitFor(() => expect(pending).toHaveLength(2));
        pending[1](jsonResponse({ account: { id: 'acc_1' } }));

        expect(await screen.findByText('Saved')).toBeInTheDocument();
        const bodies = bodiesOf(fetchMock, 'POST', '/api/account');
        expect(bodies).toHaveLength(2);
        expect(bodies[0].notification_preferences).toMatchObject({ contact_resolution: false, seller_submission_pdf_attachment: true });
        expect(bodies[1].notification_preferences).toMatchObject({ contact_resolution: false, seller_submission_pdf_attachment: false });
        expect(screen.getByRole('switch', { name: 'Attach PDF to submission emails' })).not.toBeChecked();
    });

    it('falls back to the last saved values when a queued change fails', async () => {
        let call = 0;
        stubFetch({
            'GET /api/account': () => jsonResponse(soloAccount()),
            'GET /api/organization/members': soloMembers,
            'POST /api/account': async () => {
                call += 1;
                await new Promise((resolve) => setTimeout(resolve, 20));
                return call === 1 ? jsonResponse({ account: { id: 'acc_1' } }) : jsonResponse({ error: 'Internal server error' }, 500);
            },
        });
        render(<SettingsPage />);
        await openTab('Notifications');

        fireEvent.click(await screen.findByRole('switch', { name: 'Missing provider contact alerts' }));
        fireEvent.click(screen.getByRole('switch', { name: 'Attach PDF to submission emails' }));

        expect(await screen.findByRole('alert')).toBeInTheDocument();
        // The first change was saved; the second was not.
        expect(screen.getByRole('switch', { name: 'Missing provider contact alerts' })).not.toBeChecked();
        expect(screen.getByRole('switch', { name: 'Attach PDF to submission emails' })).toBeChecked();
    });
});

describe('Teams seat count', () => {
    function stubBilling() {
        return stubFetch({
            'GET /api/account': () => jsonResponse(soloAccount()),
            'GET /api/organization/members': () => jsonResponse({
                organization: { id: 'org_1', name: 'Solo Workspace', subscription_status: 'free' },
                role: 'admin',
                members: [],
                seatUsage: { used: 4, pendingInvites: 1 },
            }),
            'GET /api/organization/invites': () => jsonResponse({ invites: [] }),
            'POST /api/organization/billing/checkout': () => jsonResponse({ error: 'Seat quantity too low', message: 'Server says no.' }, 400),
        });
    }

    it('accepts a typed number and checks it against the seat rules before checkout', async () => {
        const fetchMock = stubBilling();
        render(<SettingsPage />);
        await openTab('Billing');

        const seats = await screen.findByLabelText('Number of seats');
        const start = screen.getByRole('button', { name: 'Start Teams' });
        expect(seats).toHaveValue('3');

        fireEvent.change(seats, { target: { value: '1' } });
        expect(seats).toHaveValue('1');
        expect(screen.getByText('Teams starts at 3 seats.')).toBeInTheDocument();
        expect(start).toBeDisabled();

        fireEvent.change(seats, { target: { value: '10' } });
        expect(seats).toHaveValue('10');
        expect(screen.getByText('$70/mo')).toBeInTheDocument();
        expect(start).toBeEnabled();

        for (const [value, reason] of [
            ['', 'Enter how many seats you need.'],
            ['2.5', 'Enter a whole number of seats.'],
            ['4', 'This workspace already uses 5 seats (members and pending invitations), so choose at least 5.'],
        ]) {
            fireEvent.change(seats, { target: { value } });
            await waitFor(() => expect(screen.getByText(reason)).toBeInTheDocument());
            expect(start).toBeDisabled();
        }
        expect(bodiesOf(fetchMock, 'POST', '/api/organization/billing/checkout')).toHaveLength(0);

        fireEvent.change(seats, { target: { value: '12' } });
        fireEvent.click(start);
        expect(await screen.findByRole('alert')).toHaveTextContent('Server says no.');
        expect(bodiesOf(fetchMock, 'POST', '/api/organization/billing/checkout')).toEqual([{ seats: 12 }]);
    });
});

describe('invitations', () => {
    async function invite(response: Record<string, unknown>) {
        stubFetch({
            ...teamRoutes('admin'),
            'POST /api/organization/invites': () => jsonResponse(response),
        });
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
        });
        render(<SettingsPage />);
        await openTab('Workspace & Team');
        fireEvent.change(await screen.findByLabelText('Teammate’s email'), { target: { value: 'new@example.com' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
    }
    const created = { invite: { id: 'inv_9', email: 'new@example.com', role: 'member', expires_at: '2026-10-14T12:00:00.000Z' }, inviteUrl: 'http://localhost:3000/invite/tok_new' };

    it('says the invitation was emailed only when the response confirms it', async () => {
        await invite({ ...created, emailSent: true });
        expect(await screen.findByText('Invitation emailed to new@example.com. Their invite link is below.')).toBeInTheDocument();
        expect(screen.getByLabelText('Invite link for new@example.com')).toHaveValue('http://localhost:3000/invite/tok_new');
    });

    it('does not claim an email was sent when the response does not confirm it', async () => {
        await invite({ ...created, emailSent: false });
        expect(await screen.findByText('Invitation created, but we couldn’t confirm the email was sent. Send new@example.com the link below yourself.')).toBeInTheDocument();
        expect(screen.queryByText(/Invitation emailed/)).not.toBeInTheDocument();
    });

    it('says no new email was sent when an invitation was already pending', async () => {
        await invite({ ...created, reused: true });
        expect(await screen.findByText('new@example.com already has a pending invitation, so no new email was sent. Their invite link is below.')).toBeInTheDocument();
        expect(screen.queryByText(/Invitation emailed/)).not.toBeInTheDocument();
    });

    it('shows a failed invitation beside the field and keeps the email', async () => {
        stubFetch({
            ...teamRoutes('admin'),
            'POST /api/organization/invites': () => jsonResponse({ error: 'No seats available', message: 'Your organization has no available seats.' }, 409),
        });
        render(<SettingsPage />);
        await openTab('Workspace & Team');
        fireEvent.change(await screen.findByLabelText('Teammate’s email'), { target: { value: 'new@example.com' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('All of your seats are in use.');
        expect(screen.getByLabelText('Teammate’s email')).toHaveValue('new@example.com');
    });
});

describe('read-only roles', () => {
    it('gives a member no workspace, people or billing controls and says who has them', async () => {
        const fetchMock = stubFetch(teamRoutes('member'));
        render(<SettingsPage />);
        await openTab('Workspace & Team');

        expect(await screen.findByText('Pat Lee')).toBeInTheDocument();
        expect(screen.getByLabelText('Workspace name')).toBeDisabled();
        expect(screen.getByText('Only workspace admins can rename the workspace.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Save workspace name' })).not.toBeInTheDocument();
        expect(screen.getByRole('switch', { name: 'Notify workspace admins of all team submissions' })).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByText('Only workspace admins can send invitations and see who has been invited.')).toBeInTheDocument();
        expect(screen.queryByLabelText('Teammate’s email')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Make .* an admin|Change .* to a member|^Remove / })).not.toBeInTheDocument();
        expect(screen.getByText(/Only workspace admins can change roles or remove members\./)).toBeInTheDocument();
        expect(fetchMock.mock.calls.some(([url]) => url === '/api/organization/invites')).toBe(false);

        await openTab('Billing');
        expect(await screen.findByText('Teams plan')).toBeInTheDocument();
        expect(screen.getByText(/Your workspace admins manage this plan/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Manage Teams billing|Upgrade|Start Teams/ })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'See workspace admins' }));
        expect(await screen.findByText('Pat Lee')).toBeInTheDocument();
    });

    it('lets an admin act on other members by name, but not on themselves', async () => {
        const fetchMock = stubFetch({
            ...teamRoutes('admin'),
            'PATCH /api/organization/members/acc_2': () => jsonResponse({ error: 'Organization must have at least one admin' }, 400),
        });
        render(<SettingsPage />);
        await openTab('Workspace & Team');

        const changeRole = await screen.findByRole('button', { name: 'Change Pat Lee to a member' });
        expect(screen.getByRole('button', { name: 'Remove Pat Lee' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Test User/ })).not.toBeInTheDocument();
        fireEvent.click(changeRole);

        const dialog = await screen.findByRole('dialog', { name: 'Change Pat Lee to a member?' });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Change to member' }));

        expect(await screen.findByText('A workspace needs at least one admin, so this role can’t be changed.')).toBeInTheDocument();
        expect(bodiesOf(fetchMock, 'PATCH', '/api/organization/members/acc_2')).toEqual([{ role: 'member' }]);
    });
});

describe('return from checkout', () => {
    it('does not call the plan active until the reloaded account says so', async () => {
        window.history.replaceState({}, '', '/dashboard/settings?tab=billing&session_id=cs_test_1');
        let plan: 'free' | 'pro' = 'free';
        const fetchMock = stubFetch({
            'GET /api/account': () => jsonResponse(soloAccount(plan)),
            'GET /api/organization/members': soloMembers,
        });
        render(<SettingsPage />);

        expect(await screen.findByText(/Confirming your Pro checkout with Stripe/)).toBeInTheDocument();
        expect(await screen.findByText('Free plan')).toBeInTheDocument();
        expect(screen.queryByText(/You’re on Pro/)).not.toBeInTheDocument();
        expect(window.location.search).toBe('?tab=billing');
        // Paying again while the first payment is still being confirmed would charge twice.
        expect(screen.getByRole('button', { name: /Upgrade to Pro,/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Start Teams' })).toBeDisabled();

        plan = 'pro';
        expect(await screen.findByText('You’re on Pro. Thanks for upgrading.', {}, { timeout: 8000 })).toBeInTheDocument();
        expect(screen.getByText('Pro plan')).toBeInTheDocument();
        expect(fetchMock.mock.calls.filter(([url]) => url === '/api/account').length).toBeGreaterThan(1);
    }, 12000);

    it('reports an unfinished Teams checkout without changing what the plan shows', async () => {
        window.history.replaceState({}, '', '/dashboard/settings?tab=billing&team_checkout=cancel');
        stubFetch({
            'GET /api/account': () => jsonResponse(soloAccount()),
            'GET /api/organization/members': soloMembers,
        });
        render(<SettingsPage />);

        expect(await screen.findByText('Checkout wasn’t completed. The plan below is your current plan.')).toBeInTheDocument();
        expect(await screen.findByText('Free plan')).toBeInTheDocument();
        expect(screen.queryByText(/You’re on/)).not.toBeInTheDocument();
    });
});

describe('a plan that is set to end', () => {
    const endsAt = '2026-11-03T12:00:00.000Z';

    it('says when a canceled Pro plan ends and how to keep it', async () => {
        const account = soloAccount('pro');
        stubFetch({
            'GET /api/account': () => jsonResponse({ ...account, account: { ...account.account, subscription_cancel_at: endsAt } }),
            'GET /api/organization/members': soloMembers,
        });
        render(<SettingsPage />);
        await openTab('Billing');

        expect(await screen.findByText('Your Pro plan is set to end on November 3, 2026.')).toBeInTheDocument();
        expect(screen.getByText(/You keep everything in Pro until then\. To keep the plan, choose Manage subscription and renew it\./)).toBeInTheDocument();
    });

    it('says nothing about an end date for a plan that renews', async () => {
        stubFetch({
            'GET /api/account': () => jsonResponse(soloAccount('pro')),
            'GET /api/organization/members': soloMembers,
        });
        render(<SettingsPage />);
        await openTab('Billing');

        expect(await screen.findByText('Pro plan')).toBeInTheDocument();
        expect(screen.queryByText(/is set to end on/)).not.toBeInTheDocument();
    });

    it.each([
        ['admin', /To keep the plan, choose Manage Teams billing and renew it\./],
        ['member', /A workspace admin can keep the plan going\./],
    ] as const)('tells a Teams %s when the workspace plan ends', async (role, nextStep) => {
        const account = teamAccount(role);
        stubFetch({
            ...teamRoutes(role),
            'GET /api/account': () => jsonResponse({
                ...account,
                activeOrganization: { ...account.activeOrganization, subscription_cancel_at: endsAt },
            }),
        });
        render(<SettingsPage />);
        await openTab('Billing');

        expect(await screen.findByText('Your Teams plan is set to end on November 3, 2026.')).toBeInTheDocument();
        expect(screen.getByText(nextStep)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Manage Teams billing' }) !== null).toBe(role === 'admin');
    });

    it('ignores a leftover date once the account is back on Free', async () => {
        const account = soloAccount();
        stubFetch({
            'GET /api/account': () => jsonResponse({ ...account, account: { ...account.account, subscription_cancel_at: endsAt } }),
            'GET /api/organization/members': soloMembers,
        });
        render(<SettingsPage />);
        await openTab('Billing');

        expect(await screen.findByText('Free plan')).toBeInTheDocument();
        expect(screen.queryByText(/is set to end on/)).not.toBeInTheDocument();
    });
});

describe('a Pro checkout the server refuses', () => {
    it('shows the reason and offers Manage subscription when a subscription already exists', async () => {
        const fetchMock = stubFetch({
            'GET /api/account': () => jsonResponse(soloAccount()),
            'GET /api/organization/members': soloMembers,
            'POST /api/billing/checkout': () => jsonResponse({
                error: 'Existing subscription',
                message: 'Your subscription has a payment that did not go through.',
                manageBilling: true,
            }, 409),
            'POST /api/billing/portal': () => jsonResponse({ error: 'Portal is not available in this test.' }, 500),
        });
        render(<SettingsPage />);
        await openTab('Billing');

        expect(screen.queryByRole('button', { name: 'Manage subscription' })).not.toBeInTheDocument();
        fireEvent.click(await screen.findByRole('button', { name: /Upgrade to Pro,/ }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Your subscription has a payment that did not go through.');
        fireEvent.click(screen.getByRole('button', { name: 'Manage subscription' }));
        await waitFor(() => expect(bodiesOf(fetchMock, 'POST', '/api/billing/portal')).toHaveLength(1));
    });

    it('does not offer Manage subscription for an ordinary failure', async () => {
        stubFetch({
            'GET /api/account': () => jsonResponse(soloAccount()),
            'GET /api/organization/members': soloMembers,
            'POST /api/billing/checkout': () => jsonResponse({ error: 'Failed to create checkout session' }, 500),
        });
        render(<SettingsPage />);
        await openTab('Billing');

        fireEvent.click(await screen.findByRole('button', { name: /Upgrade to Pro,/ }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Failed to create checkout session');
        expect(screen.queryByRole('button', { name: 'Manage subscription' })).not.toBeInTheDocument();
    });
});

describe('the referral free month', () => {
    const endsAt = '2026-11-03T12:00:00.000Z';
    const trialing = (extra: Record<string, unknown> = {}) => {
        const account = soloAccount('pro');
        return { ...account, account: { ...account.account, subscription_trial_ends_at: endsAt, ...extra } };
    };

    it('says when the free month ends and how to keep Pro', async () => {
        stubFetch({
            'GET /api/account': () => jsonResponse(trialing()),
            'GET /api/organization/members': soloMembers,
        });
        render(<SettingsPage />);
        await openTab('Billing');

        expect(await screen.findByText('Your free month of Pro ends on November 3, 2026.')).toBeInTheDocument();
        expect(screen.getByText(/To keep Pro after that, add a payment method in Manage subscription\./)).toBeInTheDocument();
    });

    it('shows only the cancellation date when the trial is also set to cancel', async () => {
        stubFetch({
            'GET /api/account': () => jsonResponse(trialing({ subscription_cancel_at: endsAt })),
            'GET /api/organization/members': soloMembers,
        });
        render(<SettingsPage />);
        await openTab('Billing');

        expect(await screen.findByText('Your Pro plan is set to end on November 3, 2026.')).toBeInTheDocument();
        expect(screen.queryByText(/free month/)).not.toBeInTheDocument();
    });
});

describe('a Teams checkout the server refuses', () => {
    it.each([
        ['workspace', 'Manage Teams billing', '/api/organization/billing/portal'],
        ['personal', 'Manage subscription', '/api/billing/portal'],
    ])('offers the %s billing portal for the subscription that is in the way', async (scope, label, portal) => {
        const fetchMock = stubFetch({
            'GET /api/account': () => jsonResponse(soloAccount()),
            'GET /api/organization/members': soloMembers,
            'POST /api/organization/billing/checkout': () => jsonResponse({
                error: 'Existing subscription',
                message: 'A subscription is already there.',
                manageBilling: scope,
            }, 409),
            [`POST ${portal}`]: () => jsonResponse({ error: 'Portal is not available in this test.' }, 500),
        });
        render(<SettingsPage />);
        await openTab('Billing');

        fireEvent.click(await screen.findByRole('button', { name: 'Start Teams' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('A subscription is already there.');
        fireEvent.click(screen.getByRole('button', { name: label }));
        await waitFor(() => expect(bodiesOf(fetchMock, 'POST', portal)).toHaveLength(1));
    });
});

describe('arriving from "Start Teams" on the pricing page', () => {
    const routes = { 'GET /api/account': () => jsonResponse(soloAccount()), 'GET /api/organization/members': soloMembers };
    let scrolled: Element[];

    beforeEach(() => {
        scrolled = [];
        Element.prototype.scrollIntoView = function scrollIntoView(this: Element) { scrolled.push(this); };
    });

    afterEach(() => {
        delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    });

    it('opens Billing and brings the Teams section into view', async () => {
        window.history.replaceState({}, '', '/dashboard/settings?tab=billing&plan=teams');
        stubFetch(routes);
        render(<SettingsPage />);

        const start = await screen.findByRole('button', { name: 'Start Teams' });
        expect(scrolled.some((element) => element.contains(start))).toBe(true);
    });

    it('leaves the page where it is on an ordinary visit to Billing', async () => {
        window.history.replaceState({}, '', '/dashboard/settings?tab=billing');
        stubFetch(routes);
        render(<SettingsPage />);

        const start = await screen.findByRole('button', { name: 'Start Teams' });
        expect(scrolled.some((element) => element.contains(start))).toBe(false);
    });
});

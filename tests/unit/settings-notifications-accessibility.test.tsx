import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SettingsPage from '@/app/dashboard/settings/page';

vi.mock('@stackframe/stack', () => ({
    useUser: () => ({
        displayName: 'Test User',
        primaryEmail: 'test@example.com',
        signOut: vi.fn(),
    }),
}));

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function baseAccount(overrides: Record<string, unknown> = {}) {
    return {
        id: 'acc_1',
        full_name: 'Test User',
        email: 'test@example.com',
        notification_preferences: {
            seller_submissions: true,
            seller_submission_pdf_attachment: true,
            contact_resolution: true,
        },
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

async function openTab(name: string) {
    fireEvent.click(await screen.findByRole('tab', { name }));
}

describe('notifications tab accessibility and PDF dependency', () => {
    function stubSoloFetch(account: Record<string, unknown>) {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : String(input);
            const method = (init?.method || 'GET').toUpperCase();

            if (url === '/api/account' && method === 'GET') {
                return jsonResponse({
                    account,
                    activeOrganization: null,
                    organizations: [],
                    usage: { used: 0, limit: 3, plan: 'free' },
                });
            }
            if (url === '/api/intake-link' && method === 'GET') {
                return jsonResponse({
                    intakeLink: { slug: 'test-link', url: 'https://example.com/i/test-link', is_active: true },
                    canCustomize: false,
                });
            }
            if (url === '/api/account' && method === 'POST') {
                return jsonResponse({ account: { id: 'acc_1' } });
            }
            return jsonResponse({ error: 'Not found' }, 404);
        });
        vi.stubGlobal('fetch', fetchMock);
        return fetchMock;
    }

    it('exposes an accessible name for every notification switch', async () => {
        stubSoloFetch(baseAccount());
        render(<SettingsPage />);
        await openTab('Notifications');

        expect(await screen.findByRole('switch', { name: 'Seller submissions' })).toBeInTheDocument();
        expect(screen.getByRole('switch', { name: 'Attach PDF to submission emails' })).toBeInTheDocument();
        expect(screen.getByRole('switch', { name: 'Contact resolution alerts' })).toBeInTheDocument();
    });

    it('disables the PDF attachment switch when seller submissions is off', async () => {
        stubSoloFetch(baseAccount({
            notification_preferences: {
                seller_submissions: false,
                seller_submission_pdf_attachment: true,
                contact_resolution: true,
            },
        }));
        render(<SettingsPage />);
        await openTab('Notifications');

        const pdfSwitch = await screen.findByRole('switch', { name: 'Attach PDF to submission emails' });
        expect(pdfSwitch).toHaveAttribute('aria-disabled', 'true');
        expect(pdfSwitch).not.toBeChecked();
    });

    it('disables the PDF attachment switch as soon as seller submissions is turned off', async () => {
        stubSoloFetch(baseAccount());
        render(<SettingsPage />);
        await openTab('Notifications');

        const pdfSwitch = await screen.findByRole('switch', { name: 'Attach PDF to submission emails' });
        expect(pdfSwitch).not.toHaveAttribute('aria-disabled', 'true');
        expect(pdfSwitch).toBeChecked();

        fireEvent.click(screen.getByRole('switch', { name: 'Seller submissions' }));

        await waitFor(() => {
            expect(screen.getByRole('switch', { name: 'Attach PDF to submission emails' })).toHaveAttribute('aria-disabled', 'true');
        });
    });
});

describe('team notification routing toggle', () => {
    function stubTeamFetch(role: 'admin' | 'member', notifyAdmins: boolean) {
        const postedBodies: unknown[] = [];
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : String(input);
            const method = (init?.method || 'GET').toUpperCase();

            if (url === '/api/account' && method === 'GET') {
                return jsonResponse({
                    account: baseAccount(),
                    activeOrganization: {
                        id: 'org_1',
                        name: 'Team Workspace',
                        role,
                        subscription_status: 'team',
                        seat_quantity: 5,
                        notification_settings: { notify_admins_on_submission: notifyAdmins },
                    },
                    organizations: [],
                    usage: { used: 0, limit: 999999, plan: 'team' },
                });
            }
            if (url === '/api/intake-link' && method === 'GET') {
                return jsonResponse({
                    intakeLink: { slug: 'test-link', url: 'https://example.com/i/test-link', is_active: true },
                    canCustomize: false,
                });
            }
            if (url === '/api/organization/members' && method === 'GET') {
                return jsonResponse({
                    organization: { id: 'org_1', name: 'Team Workspace' },
                    role,
                    members: [],
                    seatUsage: { used: 1, pendingInvites: 0 },
                });
            }
            if (url === '/api/organization/invites' && method === 'GET') {
                return jsonResponse({ invites: [] });
            }
            if (url === '/api/organization/notifications' && method === 'PATCH') {
                postedBodies.push(JSON.parse(String(init?.body)));
                return jsonResponse({ notification_settings: { notify_admins_on_submission: true } });
            }
            return jsonResponse({ error: 'Not found' }, 404);
        });
        vi.stubGlobal('fetch', fetchMock);
        return { fetchMock, postedBodies };
    }

    it('lets an admin enable admin routing and persists it', async () => {
        const { postedBodies } = stubTeamFetch('admin', false);
        render(<SettingsPage />);
        await openTab('Workspace & Team');

        const toggle = await screen.findByRole('switch', { name: 'Notify workspace admins of all team submissions' });
        expect(toggle).not.toHaveAttribute('aria-disabled', 'true');
        expect(toggle).not.toBeChecked();

        fireEvent.click(toggle);

        await waitFor(() => {
            expect(postedBodies).toContainEqual({ notify_admins_on_submission: true });
        });
    });

    it('renders the toggle read-only for ordinary members', async () => {
        stubTeamFetch('member', true);
        render(<SettingsPage />);
        await openTab('Workspace & Team');

        const toggle = await screen.findByRole('switch', { name: 'Notify workspace admins of all team submissions' });
        expect(toggle).toHaveAttribute('aria-disabled', 'true');
        expect(toggle).toBeChecked();
    });
});

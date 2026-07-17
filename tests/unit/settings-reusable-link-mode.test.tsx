import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SettingsPage from '@/app/dashboard/settings/page';

const { signOutMock } = vi.hoisted(() => ({
    signOutMock: vi.fn(),
}));

vi.mock('@stackframe/stack', () => {
    const user = {
        displayName: 'Test User',
        primaryEmail: 'test@example.com',
        signOut: signOutMock,
    };

    return {
        useUser: () => user,
    };
});

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('settings reusable link mode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows mode comparison, module toggles, and saves mode+modules in one payload for paid users', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : String(input);
            const method = (init?.method || 'GET').toUpperCase();

            if (url === '/api/account' && method === 'GET') {
                return jsonResponse({
                    account: {
                        id: 'acc_1',
                        full_name: 'Test User',
                        email: 'test@example.com',
                        notification_preferences: {},
                    },
                    activeOrganization: null,
                    organizations: [],
                    usage: { used: 0, limit: 999, plan: 'pro' },
                });
            }

            if (url === '/api/intake-link' && method === 'GET') {
                return jsonResponse({
                    intakeLink: {
                        slug: 'pro-link',
                        url: 'https://example.com/i/pro-link',
                        is_active: true,
                        defaultBrandProfileId: null,
                        defaultUtilityCategories: ['electric', 'gas', 'water'],
                        defaultPacketMode: 'advanced',
                        advancedModules: ['mailbox_access', 'service_providers'],
                        advancedModuleExclusions: {},
                    },
                    brandProfiles: [
                        { id: '00000000-0000-4000-8000-000000000001', name: 'Workspace Brand', isDefault: true },
                    ],
                    canCustomize: true,
                });
            }

            if (url === '/api/intake-link' && method === 'POST') {
                const body = JSON.parse(String(init?.body || '{}'));
                return jsonResponse({
                    intakeLink: {
                        slug: 'pro-link',
                        url: 'https://example.com/i/pro-link',
                        is_active: true,
                        defaultPacketMode: body.defaultPacketMode,
                        advancedModules: body.advancedModules,
                        advancedModuleExclusions: body.advancedModuleExclusions || {},
                    },
                });
            }

            if (url === '/api/account' && method === 'POST') {
                return jsonResponse({ account: { id: 'acc_1' } });
            }

            return jsonResponse({ error: 'Not found' }, 404);
        });

        vi.stubGlobal('fetch', fetchMock);
        render(<SettingsPage />);
        fireEvent.click(await screen.findByRole('tab', { name: 'Seller Form' }));

        await screen.findByText('Default packet mode');
        expect(screen.getAllByText('Simple Utility Sheet').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Advanced Utility Packet').length).toBeGreaterThan(0);
        expect(screen.getByText(/Mailbox access, lawn care contacts/i)).toBeInTheDocument();

        const mailboxButton = await screen.findByTestId('module-toggle-mailbox_access');
        fireEvent.click(mailboxButton);

        fireEvent.click(screen.getByRole('button', { name: /Save Packet Defaults/i }));

        await waitFor(() => {
            const saveCall = fetchMock.mock.calls.find(
                ([url, init]) => url === '/api/intake-link' && (init as RequestInit | undefined)?.method === 'POST'
            );
            expect(saveCall).toBeTruthy();
            const body = JSON.parse(String((saveCall?.[1] as RequestInit).body));
            expect(body.defaultPacketMode).toBe('advanced');
            expect(body.advancedModules).toEqual(['service_providers']);
            expect(body.advancedModuleExclusions).toEqual({});
        });
    });

    it('shows advanced controls as read-only for free users', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : String(input);
            const method = (init?.method || 'GET').toUpperCase();

            if (url === '/api/account' && method === 'GET') {
                return jsonResponse({
                    account: {
                        id: 'acc_1',
                        full_name: 'Test User',
                        email: 'test@example.com',
                        notification_preferences: {},
                    },
                    activeOrganization: null,
                    organizations: [],
                    usage: { used: 0, limit: 3, plan: 'free' },
                });
            }

            if (url === '/api/intake-link' && method === 'GET') {
                return jsonResponse({
                    intakeLink: {
                        slug: 'free-link',
                        url: 'https://example.com/i/free-link',
                        is_active: true,
                        defaultBrandProfileId: null,
                        defaultUtilityCategories: ['electric', 'gas', 'water'],
                        defaultPacketMode: 'advanced',
                        advancedModules: ['mailbox_access', 'service_providers'],
                        advancedModuleExclusions: {},
                    },
                    brandProfiles: [
                        { id: '00000000-0000-4000-8000-000000000001', name: 'Workspace Brand', isDefault: true },
                    ],
                    canCustomize: false,
                });
            }

            if (url === '/api/account' && method === 'POST') {
                return jsonResponse({ account: { id: 'acc_1' } });
            }

            return jsonResponse({ error: 'Not found' }, 404);
        });

        vi.stubGlobal('fetch', fetchMock);
        render(<SettingsPage />);
        fireEvent.click(await screen.findByRole('tab', { name: 'Seller Form' }));

        await screen.findByText(/read-only on Free/i);
        const modeSelect = screen.getByLabelText('Default packet mode') as HTMLSelectElement;
        expect(modeSelect.disabled).toBe(true);
        expect(screen.getByTestId('module-toggle-mailbox_access')).toBeDisabled();
        expect(screen.getByRole('button', { name: /Save Packet Defaults/i })).toBeDisabled();
    });

    it('pauses the reusable form and saves Branding Profile and utility defaults', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : String(input);
            const method = (init?.method || 'GET').toUpperCase();

            if (url === '/api/account' && method === 'GET') {
                return jsonResponse({
                    account: {
                        id: 'acc_1',
                        full_name: 'Test User',
                        email: 'test@example.com',
                        notification_preferences: {},
                    },
                    activeOrganization: null,
                    organizations: [],
                    usage: { used: 0, limit: 999, plan: 'pro' },
                });
            }

            if (url === '/api/intake-link' && method === 'GET') {
                return jsonResponse({
                    intakeLink: {
                        slug: 'pro-link',
                        url: 'https://example.com/i/pro-link',
                        is_active: true,
                        defaultBrandProfileId: null,
                        defaultUtilityCategories: ['electric', 'gas', 'water'],
                        defaultPacketMode: 'simple',
                        advancedModules: [],
                        advancedModuleExclusions: {},
                    },
                    brandProfiles: [
                        { id: '00000000-0000-4000-8000-000000000001', name: 'Workspace Brand', isDefault: true },
                        { id: '00000000-0000-4000-8000-000000000002', name: 'Agent Brand', isDefault: false },
                    ],
                    canCustomize: true,
                });
            }

            if (url === '/api/intake-link' && method === 'POST') {
                const body = JSON.parse(String(init?.body || '{}'));
                return jsonResponse({
                    intakeLink: {
                        slug: 'pro-link',
                        url: 'https://example.com/i/pro-link',
                        is_active: body.isActive ?? true,
                        defaultBrandProfileId: body.defaultBrandProfileId ?? null,
                        defaultUtilityCategories: body.defaultUtilityCategories ?? ['electric', 'gas', 'water'],
                        defaultPacketMode: 'simple',
                        advancedModules: [],
                        advancedModuleExclusions: {},
                    },
                });
            }

            if (url === '/api/account' && method === 'POST') {
                return jsonResponse({ account: { id: 'acc_1' } });
            }

            return jsonResponse({ error: 'Not found' }, 404);
        });

        vi.stubGlobal('fetch', fetchMock);
        render(<SettingsPage />);
        fireEvent.click(await screen.findByRole('tab', { name: 'Seller Form' }));

        await screen.findByText('Seller Form Defaults');
        const activeSwitch = screen.getByRole('switch', { name: 'Accept new seller form starts' });
        expect(activeSwitch).toBeChecked();
        fireEvent.click(activeSwitch);

        await waitFor(() => {
            const statusCall = fetchMock.mock.calls.find(([, init]) => {
                if ((init as RequestInit | undefined)?.method !== 'POST') return false;
                const body = JSON.parse(String((init as RequestInit).body));
                return body.isActive === false;
            });
            expect(statusCall).toBeTruthy();
        });

        fireEvent.change(screen.getByLabelText('Default Branding Profile'), {
            target: { value: '00000000-0000-4000-8000-000000000002' },
        });
        fireEvent.click(screen.getByRole('checkbox', { name: 'Natural Gas' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save Form Defaults' }));

        await waitFor(() => {
            const defaultsCall = fetchMock.mock.calls.find(([, init]) => {
                if ((init as RequestInit | undefined)?.method !== 'POST') return false;
                const body = JSON.parse(String((init as RequestInit).body));
                return body.defaultBrandProfileId === '00000000-0000-4000-8000-000000000002';
            });
            expect(defaultsCall).toBeTruthy();
            const body = JSON.parse(String((defaultsCall?.[1] as RequestInit).body));
            expect(body.defaultUtilityCategories).toEqual(['electric', 'water']);
        });
    });
});

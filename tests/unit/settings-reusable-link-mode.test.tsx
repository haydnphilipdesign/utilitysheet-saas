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

    it('organizes seller questions, previews the form, and saves all defaults in one payload for paid users', async () => {
        const openMock = vi.spyOn(window, 'open').mockImplementation(() => null);
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
                        defaultBrandProfileId: body.defaultBrandProfileId ?? null,
                        defaultUtilityCategories: body.defaultUtilityCategories ?? ['electric', 'gas', 'water'],
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

        await screen.findByText('What sellers are asked');
        expect(screen.getByText('Form access & sharing')).toBeInTheDocument();
        expect(screen.getByText('Completed packet')).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /Simple Utility Sheet/i })).toHaveAttribute('aria-checked', 'false');
        expect(screen.getByRole('radio', { name: /Advanced Utility Packet/i })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByText(/Enable the sections you need, then open one/i)).toBeInTheDocument();
        expect(screen.queryByText('Garage Door Code')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Mailbox & Home Access/i }));
        expect(screen.getByText('Garage Door Code')).toBeInTheDocument();
        const garageCodeQuestion = screen.getByLabelText('Include Garage Door Code');
        expect(garageCodeQuestion).toBeChecked();
        fireEvent.click(garageCodeQuestion);
        expect(garageCodeQuestion).not.toBeChecked();
        fireEvent.click(garageCodeQuestion);
        expect(garageCodeQuestion).toBeChecked();

        fireEvent.click(screen.getByRole('button', { name: /Home Service Contacts/i }));
        expect(screen.queryByText('Garage Door Code')).not.toBeInTheDocument();
        expect(screen.getByText('Pool Service Provider')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Preview form/i }));
        expect(openMock).toHaveBeenCalledWith(
            'https://example.com/i/pro-link',
            '_blank',
            'noopener,noreferrer'
        );

        fireEvent.click(screen.getByRole('radio', { name: /Simple Utility Sheet/i }));
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /^Reset$/i }));
        expect(screen.getByRole('radio', { name: /Advanced Utility Packet/i })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByText('All defaults saved')).toBeInTheDocument();

        const mailboxButton = await screen.findByTestId('module-toggle-mailbox_access');
        fireEvent.click(mailboxButton);

        expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Save seller form/i }));

        await waitFor(() => {
            const saveCall = fetchMock.mock.calls.find(
                ([url, init]) => url === '/api/intake-link' && (init as RequestInit | undefined)?.method === 'POST'
            );
            expect(saveCall).toBeTruthy();
            const body = JSON.parse(String((saveCall?.[1] as RequestInit).body));
            expect(body.defaultPacketMode).toBe('advanced');
            expect(body.advancedModules).toEqual(['service_providers']);
            expect(body.advancedModuleExclusions).toEqual({});
            expect(body.defaultBrandProfileId).toBeNull();
            expect(body.defaultUtilityCategories).toEqual(['electric', 'gas', 'water']);
        });
        await screen.findByText('All defaults saved');
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
        expect(screen.getByRole('radio', { name: /Simple Utility Sheet/i })).toBeDisabled();
        expect(screen.getByRole('radio', { name: /Advanced Utility Packet/i })).toBeDisabled();
        expect(screen.getByTestId('module-toggle-mailbox_access')).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByRole('button', { name: /Save seller form/i })).toBeDisabled();
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

        await screen.findByText('Form access & sharing');
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
        fireEvent.click(screen.getByRole('button', { name: 'Save seller form' }));

        await waitFor(() => {
            const defaultsCall = fetchMock.mock.calls.find(([, init]) => {
                if ((init as RequestInit | undefined)?.method !== 'POST') return false;
                const body = JSON.parse(String((init as RequestInit).body));
                return body.defaultBrandProfileId === '00000000-0000-4000-8000-000000000002';
            });
            expect(defaultsCall).toBeTruthy();
            const body = JSON.parse(String((defaultsCall?.[1] as RequestInit).body));
            expect(body.defaultUtilityCategories).toEqual(['electric', 'water']);
            expect(body.defaultPacketMode).toBe('simple');
            expect(body.advancedModules).toEqual([
                'lawn_exterior',
                'irrigation_seasonal_controls',
                'mailbox_access',
                'smart_home_security',
                'service_providers',
            ]);
        });
    });
});

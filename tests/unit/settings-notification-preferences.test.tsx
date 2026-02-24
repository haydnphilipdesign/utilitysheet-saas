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

beforeEach(() => {
    vi.clearAllMocks();
});

describe('settings notification preferences', () => {
    it('merges seller_submission_pdf_attachment from API and auto-saves after toggles', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : String(input);
            const method = (init?.method || 'GET').toUpperCase();

            if (url === '/api/account' && method === 'GET') {
                return jsonResponse({
                    account: {
                        id: 'acc_1',
                        full_name: 'Test User',
                        email: 'test@example.com',
                        notification_preferences: {
                            seller_submissions: true,
                            seller_submission_pdf_attachment: false,
                            collect_electric_meter_number: false,
                            contact_resolution: true,
                        },
                    },
                    activeOrganization: null,
                    organizations: [],
                    usage: { used: 0, limit: 3, plan: 'free' },
                });
            }

            if (url === '/api/intake-link' && method === 'GET') {
                return jsonResponse({
                    intakeLink: {
                        slug: 'test-link',
                        url: 'https://example.com/i/test-link',
                        is_active: true,
                    },
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

        const toggleLabel = await screen.findByText('Attach PDF to submission emails');
        const toggleRow = toggleLabel.closest('div')?.parentElement;
        expect(toggleRow).not.toBeNull();

        const checkbox = toggleRow?.querySelector('input[type="checkbox"]') as HTMLInputElement;
        expect(checkbox).toBeTruthy();
        expect(checkbox.checked).toBe(false);

        fireEvent.click(checkbox);
        expect(checkbox.checked).toBe(true);

        const meterToggleLabel = await screen.findByText('Collect electric meter number');
        const meterToggleRow = meterToggleLabel.closest('div')?.parentElement;
        expect(meterToggleRow).not.toBeNull();

        const meterCheckbox = meterToggleRow?.querySelector('input[type="checkbox"]') as HTMLInputElement;
        expect(meterCheckbox).toBeTruthy();
        expect(meterCheckbox.checked).toBe(false);

        fireEvent.click(meterCheckbox);
        expect(meterCheckbox.checked).toBe(true);

        await waitFor(() => {
            const postCalls = fetchMock.mock.calls.filter(
                ([url, init]) => url === '/api/account' && (init as RequestInit)?.method === 'POST'
            );
            expect(postCalls.length).toBeGreaterThan(0);
        });

        const postCalls = fetchMock.mock.calls.filter(
            ([url, init]) => url === '/api/account' && (init as RequestInit)?.method === 'POST'
        );
        const lastPostCall = postCalls.at(-1);
        expect(lastPostCall).toBeTruthy();

        const postBody = JSON.parse(String((lastPostCall?.[1] as RequestInit).body));
        expect(postBody.notification_preferences.seller_submission_pdf_attachment).toBe(true);
        expect(postBody.notification_preferences.collect_electric_meter_number).toBe(true);
    });

    it('defaults collect_electric_meter_number to ON when not set in account preferences', async () => {
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
                        slug: 'test-link',
                        url: 'https://example.com/i/test-link',
                        is_active: true,
                    },
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

        const meterToggleLabel = await screen.findByText('Collect electric meter number');
        const meterToggleRow = meterToggleLabel.closest('div')?.parentElement;
        expect(meterToggleRow).not.toBeNull();

        const meterCheckbox = meterToggleRow?.querySelector('input[type="checkbox"]') as HTMLInputElement;
        expect(meterCheckbox).toBeTruthy();
        expect(meterCheckbox.checked).toBe(true);
    });
});

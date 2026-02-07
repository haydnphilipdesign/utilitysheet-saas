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
    it('merges seller_submission_pdf_attachment from API and persists it on save', async () => {
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

        const toggleLabel = await screen.findByText('Attach PDF to seller submission emails');
        const toggleRow = toggleLabel.closest('div')?.parentElement;
        expect(toggleRow).not.toBeNull();

        const checkbox = toggleRow?.querySelector('input[type="checkbox"]') as HTMLInputElement;
        expect(checkbox).toBeTruthy();
        expect(checkbox.checked).toBe(false);

        fireEvent.click(checkbox);
        expect(checkbox.checked).toBe(true);

        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/account', expect.objectContaining({ method: 'POST' }));
        });

        const postCall = fetchMock.mock.calls.find(([url, init]) => url === '/api/account' && (init as RequestInit)?.method === 'POST');
        expect(postCall).toBeTruthy();

        const postBody = JSON.parse(String((postCall?.[1] as RequestInit).body));
        expect(postBody.notification_preferences.seller_submission_pdf_attachment).toBe(true);
    });
});

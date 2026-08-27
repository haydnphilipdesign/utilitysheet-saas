import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    signOut: vi.fn(),
    toastError: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    usePathname: () => '/dashboard',
    useRouter: () => ({
        push: mocks.push,
        refresh: mocks.refresh,
        replace: mocks.replace,
    }),
}));

vi.mock('@stackframe/stack', () => ({
    useUser: () => ({
        id: 'user_1',
        displayName: 'Jamie User',
        primaryEmail: 'jamie@example.com',
    }),
}));

vi.mock('@/lib/stack/client', () => ({
    stackClientApp: { signOut: mocks.signOut },
}));

vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }));

vi.mock('@/components/feedback-dialog', () => ({ FeedbackDialog: () => null }));
vi.mock('@/components/ui/theme-toggle', () => ({ ThemeToggle: () => null }));
vi.mock('@/components/email-verification-banner', () => ({ EmailVerificationBanner: () => null }));

vi.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
        <button {...props}>{children}</button>
    ),
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuItem: ({
        children,
        onSelect,
        ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & { onSelect?: () => void }) => (
        <button {...props} onClick={onSelect}>{children}</button>
    ),
}));

import { DashboardLayoutContent } from '@/app/dashboard/layout-content';

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('dashboard workspace switcher', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.sessionStorage.clear();
    });

    it('lists every membership and requests workspace changes through the guarded API', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : String(input);
            if (url === '/api/account' && !init?.method) {
                return jsonResponse({
                    account: {
                        id: 'acct_1',
                        email: 'jamie@example.com',
                        full_name: 'Jamie User',
                    },
                    activeOrganization: {
                        id: 'org_team',
                        name: 'Cincy Transactions',
                    },
                    organizations: [
                        { id: 'org_personal', name: 'Jamie User', role: 'admin' },
                        { id: 'org_team', name: 'Cincy Transactions', role: 'member' },
                    ],
                });
            }

            if (url === '/api/account/active-organization' && init?.method === 'POST') {
                return jsonResponse({ error: 'Test stops before browser navigation' }, 500);
            }

            return jsonResponse({ error: 'Not found' }, 404);
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<DashboardLayoutContent><div>Dashboard content</div></DashboardLayoutContent>);

        expect(await screen.findByLabelText('Current workspace: Cincy Transactions')).toBeDisabled();
        fireEvent.click(screen.getByLabelText('Switch to workspace Jamie User'));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/account/active-organization', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ organizationId: 'org_personal' }),
            });
        });
        expect(mocks.toastError).toHaveBeenCalledWith('Test stops before browser navigation');
    });

    it('consumes a preserved OAuth invite destination once', async () => {
        window.sessionStorage.setItem('utilitysheet:post-auth-return-to', '/invite/tok_1');
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ organizations: [] })));

        render(<DashboardLayoutContent><div>Dashboard content</div></DashboardLayoutContent>);

        await waitFor(() => {
            expect(mocks.replace).toHaveBeenCalledWith('/invite/tok_1');
        });
        expect(window.sessionStorage.getItem('utilitysheet:post-auth-return-to')).toBeNull();
    });
});

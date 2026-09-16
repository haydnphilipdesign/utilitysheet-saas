import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    signOut: vi.fn(),
    toastError: vi.fn(),
}));

vi.mock('@stackframe/stack', () => ({ useUser: () => ({ signOut: mocks.signOut }) }));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError, success: vi.fn() } }));

import { AccountClosureSection } from '@/components/settings/account-closure';

function response(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

const baseReview = {
    eligible: true,
    blockers: [],
    confirmationEmail: 'owner@example.com',
    billing: { cancelsPersonalPlan: true, cancelsWorkspacePlans: [] },
    personal: { requestCount: 2, openRequestCount: 1, profileCount: 1, hasSellerForm: true },
    deletedWorkspaces: [],
    sharedWorkspaces: [],
    forfeitedReferralCredits: 1,
    pendingInvitations: 1,
    supportEmail: 'support@example.com',
};

describe('AccountClosureSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows server blockers with resolution links and never exposes the submit action', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
            status: 'active',
            review: {
                ...baseReview,
                eligible: false,
                blockers: [{
                    code: 'billing_unsettled',
                    message: 'Pay the outstanding balance first.',
                    action: { label: 'Open Billing', href: '/dashboard/settings?tab=billing' },
                }],
            },
        })));

        render(<AccountClosureSection onRecentAuthRequired={vi.fn()} onDownloadExport={vi.fn()} exporting={false} />);
        fireEvent.click(screen.getByRole('button', { name: 'Review and close account' }));

        expect(await screen.findByRole('heading', { name: 'Before you can close your account' })).toBeInTheDocument();
        expect(screen.getByText('Pay the outstanding balance first.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Open Billing' })).toHaveAttribute('href', '/dashboard/settings?tab=billing');
        expect(screen.queryByRole('button', { name: 'Close account permanently' })).not.toBeInTheDocument();
    });

    it('requires the exact email, acknowledgement, and a transfer target before submitting', async () => {
        const review = {
            ...baseReview,
            sharedWorkspaces: [{
                id: '22222222-2222-4222-8222-222222222222',
                name: 'Shared workspace',
                ownedRequestCount: 2,
                ownedProfileCount: 1,
                needsTransfer: true,
                adminOptions: [
                    { accountId: '33333333-3333-4333-8333-333333333333', name: 'First Admin' },
                    { accountId: '44444444-4444-4444-8444-444444444444', name: 'Second Admin' },
                ],
                defaultTransferAccountId: '33333333-3333-4333-8333-333333333333',
            }],
        };
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(response({ status: 'active', review }))
            .mockResolvedValueOnce(response({
                status: 'active',
                code: 'CLOSURE_NOT_COMPLETED',
                error: 'Nothing was deleted. Try again.',
            }, 409));
        vi.stubGlobal('fetch', fetchMock);

        render(<AccountClosureSection onRecentAuthRequired={vi.fn()} onDownloadExport={vi.fn()} exporting={false} />);
        fireEvent.click(screen.getByRole('button', { name: 'Review and close account' }));

        const submit = await screen.findByRole('button', { name: 'Close account permanently' });
        expect(submit).toBeDisabled();
        expect(screen.getByText(/links keep working/i)).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText(/Type owner@example.com to confirm/), { target: { value: 'owner@example.com' } });
        fireEvent.click(screen.getByLabelText(/permanently closes my account/i));
        fireEvent.change(screen.getByLabelText('Shared workspace'), {
            target: { value: '44444444-4444-4444-8444-444444444444' },
        });
        expect(submit).toBeEnabled();
        fireEvent.click(submit);

        expect(await screen.findByRole('alert')).toHaveTextContent('Nothing was deleted. Try again.');
        const submitted = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
        expect(submitted).toMatchObject({
            action: 'close',
            confirmationEmail: 'owner@example.com',
            acknowledged: true,
            transfers: {
                '22222222-2222-4222-8222-222222222222': '44444444-4444-4444-8444-444444444444',
            },
        });
    });

    it('hands a stale recent-auth window back to the password confirmation flow', async () => {
        const onRecentAuthRequired = vi.fn();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
            code: 'RECENT_AUTH_REQUIRED', error: 'Confirm your password.',
        }, 403)));

        render(<AccountClosureSection onRecentAuthRequired={onRecentAuthRequired} onDownloadExport={vi.fn()} exporting={false} />);
        fireEvent.click(screen.getByRole('button', { name: 'Review and close account' }));

        await waitFor(() => expect(onRecentAuthRequired).toHaveBeenCalledTimes(1));
        expect(mocks.toastError).toHaveBeenCalledWith('Confirm it’s you, then open the closure review again.');
    });
});


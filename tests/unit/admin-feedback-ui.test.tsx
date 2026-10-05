import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    refresh: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn() },
    action: vi.fn(),
    inbox: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('sonner', () => ({ toast: mocks.toast }));
vi.mock('@/app/(admin)/admin/feedback/actions', () => ({ updateFeedbackStatusAdminAction: mocks.action }));
vi.mock('@/lib/admin/feedback', () => ({ FEEDBACK_ROW_LIMIT: 200, getFeedbackInbox: mocks.inbox }));

import FeedbackPage from '@/app/(admin)/admin/feedback/page';
import { FeedbackStatusControls } from '@/components/admin/FeedbackStatusControls';
import type { FeedbackRow } from '@/lib/admin/feedback';

const CUSTOMER = '00000000-0000-4000-8000-0000000000b1';
const FEEDBACK = '00000000-0000-4000-8000-0000000000f1';

describe('FeedbackStatusControls', () => {
    const item = { id: FEEDBACK, status: 'new' as const, version: 3, note: null, updatedByEmail: null, statusChangedAt: null };

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.action.mockResolvedValue({ success: true });
    });

    it('submits the reason, note and the version the operator saw', async () => {
        render(<FeedbackStatusControls item={item} />);
        fireEvent.click(screen.getByRole('button', { name: 'Mark reviewed' }));

        const confirm = screen.getAllByRole('button', { name: 'Mark reviewed' }).at(-1)!;
        fireEvent.change(screen.getByLabelText('Reason to mark reviewed this feedback'), { target: { value: 'Replied by email' } });
        fireEvent.change(screen.getByLabelText('Internal note'), { target: { value: ' Wants CSV export ' } });
        fireEvent.click(confirm);

        await waitFor(() => expect(mocks.toast.success).toHaveBeenCalledWith('Marked reviewed'));
        expect(mocks.action).toHaveBeenCalledWith({
            feedbackId: FEEDBACK, status: 'reviewed', expectedVersion: 3, note: 'Wants CSV export', reason: 'Replied by email',
        });
        expect(mocks.refresh).toHaveBeenCalled();
    });

    it('submits without a reason, because feedback reasons are optional', async () => {
        render(<FeedbackStatusControls item={item} />);
        fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
        fireEvent.click(screen.getAllByRole('button', { name: 'Resolve' }).at(-1)!);

        await waitFor(() => expect(mocks.action).toHaveBeenCalledWith({
            feedbackId: FEEDBACK, status: 'resolved', expectedVersion: 3,
        }));
    });

    it('refreshes after a stale refusal so the operator sees the other change', async () => {
        mocks.action.mockResolvedValue({ success: false, code: 'STALE', error: 'Another operator updated this feedback.' });
        render(<FeedbackStatusControls item={item} />);
        fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
        fireEvent.change(screen.getByLabelText('Reason to resolve this feedback'), { target: { value: 'Shipped' } });
        fireEvent.click(screen.getAllByRole('button', { name: 'Resolve' }).at(-1)!);

        await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith('Another operator updated this feedback.'));
        expect(mocks.refresh).toHaveBeenCalled();
    });

    it('offers no actions when writes are disabled', () => {
        render(<FeedbackStatusControls item={item} disabledReason="Admin writes are disabled." />);

        expect(screen.getByText('Admin writes are disabled.')).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});

describe('FeedbackPage', () => {
    const row: FeedbackRow = {
        id: FEEDBACK, category: 'bug', message: 'The PDF button does nothing', page_path: '/dashboard/requests/abc',
        viewport: '390x844', user_agent: 'TestBrowser/1.0', email_status: 'failed', status: 'new', note: null, version: 1,
        status_changed_at: null, created_at: '2026-10-05T12:00:00.000Z', account_id: CUSTOMER, user_name: 'Sample TC',
        user_email: 'customer@example.com', is_paid: false, updated_by_email: null,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('lists feedback with its context and passes validated filters to the query', async () => {
        mocks.inbox.mockResolvedValue({ installed: true, total: 4, newCount: 2, last30d: 3, accounts: 2, emailFailed: 1, rows: [row] });

        render(await FeedbackPage({ searchParams: Promise.resolve({ status: 'new', category: 'nonsense' }) }));

        expect(mocks.inbox).toHaveBeenCalledWith({ status: 'new', category: null });
        expect(screen.getByText('The PDF button does nothing')).toBeInTheDocument();
        expect(screen.getByText('Page: /dashboard/requests/abc')).toBeInTheDocument();
        expect(screen.getByText('Email notice failed')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'customer@example.com' })).toHaveAttribute('href', `/admin/users/${CUSTOMER}`);
        expect(screen.getByRole('link', { name: 'Bug' })).toHaveAttribute('href', '/admin/feedback?status=new&category=bug');
        expect(screen.getByRole('button', { name: 'Mark reviewed' })).toBeInTheDocument();
    });

    it('explains a pending migration instead of showing an empty inbox', async () => {
        mocks.inbox.mockResolvedValue({ installed: false });

        render(await FeedbackPage({ searchParams: Promise.resolve({}) }));

        expect(screen.getByText('Feedback inbox is not installed yet')).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});

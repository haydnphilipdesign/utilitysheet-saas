import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/neon/queries/admin-seller-progress', () => ({ getSellerProgressData: mocks.get }));
vi.mock('@/lib/admin', () => ({ AdminAuthorizationError: class extends Error {} }));
import Page from '@/app/(admin)/admin/abandonment/page';
import { AdminAuthorizationError } from '@/lib/admin';
afterEach(cleanup);

describe('seller progress report presentation', () => {
    it('distinguishes unknown seller activity from recent operator work', async () => {
        mocks.get.mockResolvedValue({ totalRequests: 1, inProgressCount: 1, unknownActivity: 1,
            active24h: 0, inactive1To7d: 0, inactiveOver7d: 0,
            byLastCategory: [], byLastEvent: [{ event_type: 'unknown', count: 1 }], rows: [{
                request_id: 'synthetic-request', property_address: 'Synthetic property', user_name: 'Fixture customer',
                user_email: 'fixture@example.test', last_event_type: null, last_event_data: null,
                hours_since_last_event: null, is_reopened: true, request_created_at: '2026-10-01T12:00:00Z',
                last_other_event_type: 'request_reopened', last_other_event_at: '2026-10-13T12:00:00Z',
            }] });
        render(await Page());
        expect(screen.getByText('No tracked activity')).toBeInTheDocument();
        expect(screen.getByText(/Operator \/ technical: request_reopened/)).toBeInTheDocument();
        expect(screen.getByText(/excluded from age buckets/)).toBeInTheDocument();
        expect(screen.getByText('Reopened')).toBeInTheDocument();
        expect(document.body.textContent).not.toMatch(/NaN|undefined/);
    });
    it('reports browser steps with their coverage and keeps missing reports unknown', async () => {
        const base = { property_address: 'Synthetic property', user_name: 'Fixture customer', user_email: 'fixture@example.test',
            is_reopened: false, request_created_at: '2026-10-01T12:00:00Z', last_other_event_type: null, last_other_event_at: null };
        mocks.get.mockResolvedValue({ totalRequests: 3, inProgressCount: 3, unknownActivity: 1,
            active24h: 2, inactive1To7d: 0, inactiveOver7d: 0, byLastCategory: [],
            byLastEvent: [{ event_type: 'seller_step_viewed', count: 1 }, { event_type: 'seller_submission_failed', count: 1 }, { event_type: 'unknown', count: 1 }],
            browserObserved: 2,
            byLastStep: [{ step: 'utility', category: 'electric', count: 1 }, { step: 'review', category: null, count: 1 }],
            rows: [
                { ...base, request_id: 'r-step', last_event_type: 'seller_step_viewed', last_event_data: { step: 'utility', category: 'electric' },
                    hours_since_last_event: 2, last_step: 'utility', last_step_category: 'electric', last_step_at: '2026-10-13T10:00:00Z',
                    last_failure_code: null, last_failure_at: null, browser_sessions: 1 },
                { ...base, request_id: 'r-fail', last_event_type: 'seller_submission_failed', last_event_data: { error_code: 'server_error' },
                    hours_since_last_event: 1, last_step: 'review', last_step_category: null, last_step_at: '2026-10-13T11:00:00Z',
                    last_failure_code: 'server_error', last_failure_at: '2026-10-13T11:01:00Z', browser_sessions: 2 },
                { ...base, request_id: 'r-silent', last_event_type: null, last_event_data: null, hours_since_last_event: null,
                    last_step: null, last_step_category: null, last_step_at: null, last_failure_code: null, last_failure_at: null, browser_sessions: 0 },
            ] });
        render(await Page());
        expect(screen.getByRole('heading', { name: 'Last step viewed in the browser' })).toBeInTheDocument();
        expect(screen.getByText(/for 2 of 3 in-progress requests/)).toBeInTheDocument();
        expect(screen.getByText(/unknown, not stuck/)).toBeInTheDocument();
        expect(screen.getByText('Electric provider')).toBeInTheDocument();
        expect(screen.getAllByText('1 (50%)').length).toBeGreaterThanOrEqual(2);
        expect(screen.getByText(/Browser last viewed: Electric provider/)).toBeInTheDocument();
        expect(screen.getByText(/Last reported submit problem: server error/)).toBeInTheDocument();
        expect(screen.getAllByText('Submission failed: server error').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText(/Browser last viewed:/)).toHaveLength(2);
        expect(document.body.textContent).not.toMatch(/NaN|undefined/);
    });
    it('shows an explicit empty state, not zero progress, before any browser report exists', async () => {
        mocks.get.mockResolvedValue({ totalRequests: 1, inProgressCount: 1, unknownActivity: 1, active24h: 0, inactive1To7d: 0,
            inactiveOver7d: 0, byLastCategory: [], byLastEvent: [{ event_type: 'unknown', count: 1 }], browserObserved: 0, byLastStep: [], rows: [] });
        render(await Page());
        expect(screen.getByText('No browser step reports')).toBeInTheDocument();
        expect(screen.getByText(/for 0 of 1 in-progress requests/)).toBeInTheDocument();
        expect(document.body.textContent).not.toMatch(/NaN|undefined/);
    });
    it('renders read failure as unavailable and preserves authorization errors', async () => {
        mocks.get.mockRejectedValueOnce(new Error('private SQL error'));
        render(await Page());
        expect(screen.getByRole('alert')).toHaveTextContent('temporarily unavailable');
        expect(document.body.textContent).not.toContain('private SQL');
        cleanup();
        mocks.get.mockRejectedValueOnce(new AdminAuthorizationError());
        await expect(Page()).rejects.toBeInstanceOf(AdminAuthorizationError);
    });
});

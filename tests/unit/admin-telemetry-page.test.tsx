import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/admin', () => ({ AdminAuthorizationError: class extends Error {} }));
vi.mock('@/lib/neon/queries/admin-telemetry', () => ({
    getAdminTelemetry: mocks.get,
    telemetryDays: (value: string) => value === '7' ? 7 : 30,
}));
const emptyUsage = { created: 0, opened: 0, completed: 0, completedWithoutOpen: 0, medianHours: null, timedCompletions: 0, intake: 0, agent: 0, unknownSource: 0, simple: 0, advanced: 0, reminded: 0, completedAfterReminder: 0, returnLinks: 0, edited: 0, currentAccounts: 0, previousAccounts: 0, returningAccounts: 0, testDriveAccounts: 0, convertedTestDriveAccounts: 0, modules: [], providers: [] };
import Page from '@/app/(admin)/admin/telemetry/page';
import { AdminAuthorizationError } from '@/lib/admin';
afterEach(cleanup);
describe('admin telemetry page', () => {
    it('renders recorded counts and distinguishes cached-only latency', async () => {
        mocks.get.mockResolvedValue({ usage: { ...emptyUsage, created: 4, opened: 3, completed: 2,
            medianHours: 1.5, timedCompletions: 2, advanced: 2, previousAccounts: 2, returningAccounts: 1,
            modules: [{ module: 'mailbox_access', requests: 1 }],
            providers: [{ category: 'electric', total: 2, suggested: 1, searched: 0, manual: 1, unknown: 0, unclassified: 0, notApplicable: 0 }] }, forms: { accounts: 3, formAccounts: 2, multiFormAccounts: 1,
            forms: 4, activeForms: 3, requests: 6, attributedRequests: 5, completedRequests: 2, usedForms: 4, multiFormUsers: 1 },
            events: [{ event: 'seller_submitted', count: 2, requests: 1 }],
            ai: [{ feature: 'provider_search', status: 'success', runs: 2, cached: 1, freshLatencyMs: 120 },
                { feature: 'provider_suggestions', status: 'fallback', runs: 1, cached: 1, freshLatencyMs: null },
                { feature: 'provider_contact', status: 'success', runs: 3, cached: 0, freshLatencyMs: 900 }],
            aiUsage: [{ feature: 'provider_suggestions', freshRuns: 12, measuredRuns: 10, passes: 21, searchQueries: 37,
                promptTokens: 48210, outputTokens: 3120, thinkingTokens: 990, toolPromptTokens: 61500, timeouts: 2, otherFailures: 1 }],
            aiAcceptance: [{ shown: 'ai_verify', entries: 8, accepted: 7 }, { shown: 'fallback', entries: 3, accepted: 1 }] });
        render(await Page({ searchParams: Promise.resolve({}) }));
        expect(screen.getAllByRole('table')).toHaveLength(5);
        const usage = screen.getByRole('table', { name: 'AI usage by feature for the selected period' });
        expect(usage).toHaveTextContent('Provider suggestions');
        expect(usage).toHaveTextContent('48,210');
        expect(usage).toHaveTextContent('37');
        const acceptance = screen.getByRole('table', { name: 'Suggestion acceptance by source for the selected period' });
        expect(acceptance).toHaveTextContent('Fresh AI result, verified');
        expect(acceptance).toHaveTextContent('88%');
        expect(acceptance).toHaveTextContent('Generic national list');
        expect(acceptance).toHaveTextContent('33%');
        expect(screen.getByRole('table', { name: 'AI telemetry by feature and outcome' })).toHaveTextContent('Contact lookup');
        expect(screen.getByText('1.5 h')).toBeInTheDocument();
        expect(screen.getByText('Mailbox & Home Access')).toBeInTheDocument();
        expect(screen.getByText(/50% of previous-period accounts/)).toBeInTheDocument();
        expect(screen.getByRole('table', { name: 'Provider entry methods by utility category' })).toHaveTextContent('electric');
        expect(screen.getByText('seller_submitted')).toBeInTheDocument();
        expect(screen.getByText('120 ms')).toBeInTheDocument();
        expect(screen.getAllByText('—').length).toBeGreaterThan(0);
        expect(screen.getByText(/40% of form-based requests/)).toBeInTheDocument();
        expect(screen.getByText(/50% of accounts with forms/)).toBeInTheDocument();
    });
    it('shows empty states and explains attribution and time semantics', async () => {
        mocks.get.mockResolvedValue({ usage: emptyUsage, forms: { accounts: 0, formAccounts: 0, multiFormAccounts: 0,
            forms: 0, activeForms: 0, requests: 0, attributedRequests: 0, completedRequests: 0, usedForms: 0, multiFormUsers: 0 }, events: [], ai: [] });
        render(await Page({ searchParams: Promise.resolve({ days: '7' }) }));
        expect(screen.getByRole('heading', { name: 'Telemetry' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Last 7 days' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByText(/No request events recorded/)).toBeInTheDocument();
        expect(screen.getByText(/No AI runs recorded/)).toBeInTheDocument();
        expect(screen.getByText(/No fresh AI runs recorded/)).toBeInTheDocument();
        expect(screen.getByText(/No submitted entries with a recorded suggestion list/)).toBeInTheDocument();
        expect(screen.getByText(/No submitted provider entries/)).toBeInTheDocument();
        expect(screen.getByText(/not assigned to a form retroactively/)).toBeInTheDocument();
        expect(screen.getByText(/Completion reflects the current outcome/)).toBeInTheDocument();
        expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
    });
    it('shows database absence as unavailable', async () => {
        mocks.get.mockResolvedValue(null);
        render(await Page({ searchParams: Promise.resolve({}) }));
        expect(screen.getByRole('status')).toHaveTextContent('Database not configured');
    });
    it('shows errors without exposing database details', async () => {
        mocks.get.mockRejectedValue(new Error('private database details'));
        render(await Page({ searchParams: Promise.resolve({}) }));
        expect(screen.getByRole('alert')).toHaveTextContent('temporarily unavailable');
        expect(document.body.textContent).not.toContain('private database');
    });
    it('does not swallow authorization errors', async () => {
        mocks.get.mockRejectedValue(new AdminAuthorizationError());
        await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toBeInstanceOf(AdminAuthorizationError);
    });
});


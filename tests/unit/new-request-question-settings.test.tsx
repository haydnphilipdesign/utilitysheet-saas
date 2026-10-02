import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NewRequestPage from '@/app/dashboard/requests/new/page';
import { getSellerQuestionPreview } from '@/lib/packet/seller-questions';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn() }),
    useSearchParams: () => new URLSearchParams('onboarding=1'),
}));
vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }));
vi.mock('@/components/seller-questions/QuestionGapCapture', () => ({ QuestionGapCapture: () => null }));
vi.mock('@/components/seller-questions/SellerQuestionsDialog', () => ({
    SellerQuestionsDialog: ({ configuration }: { configuration: Parameters<typeof getSellerQuestionPreview>[0] }) => (
        <div data-testid="question-preview">{JSON.stringify(getSellerQuestionPreview(configuration))}</div>
    ),
}));

afterEach(() => vi.unstubAllGlobals());

describe('individual request question switches', () => {
    it.each([true, false])('loads %s account defaults and submits only this request choices', async (initial) => {
        const submitted: Record<string, unknown>[] = [];
        const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
            let data: unknown = {};
            if (url === '/api/account') data = { account: { subscription_status: 'free', notification_preferences: { collect_hoa_questions: initial, collect_electric_meter_number: initial } } };
            if (url === '/api/branding') data = [];
            if (url === '/api/intake-link') data = { intakeLink: { url: 'https://example.com/i/test', slug: 'test' } };
            if (url === '/api/requests') {
                submitted.push(JSON.parse(init?.body as string));
                data = { id: 'test-request', seller_token: 'test-seller-token' };
            }
            return new Response(JSON.stringify(data), { status: 200 });
        });
        vi.stubGlobal('fetch', fetchMock);
        render(<NewRequestPage />);
        await waitFor(() => expect(screen.getByTestId('new-request-address-input')).not.toHaveValue(''));
        fireEvent.click(screen.getByTestId('new-request-step-1-continue'));
        fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
        fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
        const hoa = screen.getByRole('switch', { name: 'Ask about HOA or condo association' });
        const meter = screen.getByRole('switch', { name: 'Collect electric meter number' });
        await waitFor(() => expect(hoa).toBeEnabled());
        expect(hoa).toHaveAttribute('aria-checked', String(initial));
        expect(meter).toHaveAttribute('aria-checked', String(initial));
        fireEvent.click(hoa);
        fireEvent.click(meter);
        expect(hoa).toHaveAttribute('aria-checked', String(!initial));
        expect(meter).toHaveAttribute('aria-checked', String(!initial));
        expect(screen.getByTestId('question-preview').textContent?.includes('home_basics.has_hoa')).toBe(!initial);
        fireEvent.click(screen.getByTestId('new-request-create'));
        await waitFor(() => expect(submitted).toHaveLength(1));
        expect(submitted[0]).toMatchObject({ collectHoaQuestions: !initial, collectElectricMeterNumber: !initial });
        expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/account' && init?.method === 'PATCH')).toBe(false);
    });
});

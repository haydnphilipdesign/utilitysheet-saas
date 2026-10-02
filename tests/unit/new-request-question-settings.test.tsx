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
            if (url === '/api/seller-forms') data = { forms: [], defaultId: null };
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


describe('stale saved-form request recovery', () => {
    it.each([true, false])('recovers with latest revision while keeping request data (keep overrides: %s)', async (keepOverrides) => {
        const submissions: Record<string, unknown>[] = [];
        const initial = {
            id: '00000000-0000-4000-8000-000000000011', name: 'Listing', slug: 'listing', url: 'https://example.test/i/listing',
            revision: 2, isDefault: true, isActive: true, is_active: true, organizationId: null, sellerIntro: 'Original introduction',
            defaultBrandProfileId: null, defaultUtilityCategories: ['electric', 'water'], defaultPacketMode: 'simple', advancedModules: [],
            advancedModuleExclusions: {}, collectHoaQuestions: false, collectElectricMeterNumber: false,
        };
        const latest = { ...initial, revision: 3, sellerIntro: 'Current introduction', defaultUtilityCategories: ['water'], collectElectricMeterNumber: true };
        let formsReads = 0;
        const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
            let data: unknown = {};
            let status = 200;
            if (url === '/api/account') data = { account: { subscription_status: 'free', notification_preferences: {} } };
            if (url === '/api/branding') data = [];
            if (url === '/api/intake-link') data = { intakeLink: initial };
            if (url === '/api/seller-forms') {
                formsReads++;
                if (formsReads === 2) status = 503; // failure leaves all data/revision recoverable
                data = { forms: [formsReads === 1 ? initial : latest], defaultId: initial.id, isPaid: false };
            }
            if (url === '/api/requests') {
                const body = JSON.parse(init?.body as string);
                submissions.push(body);
                if (body.formRevision !== latest.revision) {
                    status = 409;
                    data = { error: 'Form changed. Reload before saving or starting.', code: 'FORM_REVISION_CONFLICT' };
                } else data = { id: 'request-after-recovery', seller_token: 'synthetic-token' };
            }
            return new Response(JSON.stringify(data), { status });
        });
        vi.stubGlobal('fetch', fetchMock);
        render(<NewRequestPage />);
        await waitFor(() => expect(screen.getByLabelText('Seller form', { exact: true })).toHaveValue(initial.id));
        fireEvent.change(screen.getByTestId('new-request-address-input'), { target: { value: '456 Synthetic Street' } });
        fireEvent.click(screen.getByTestId('new-request-step-1-continue'));
        fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
        fireEvent.change(screen.getByLabelText('Seller Name'), { target: { value: 'Synthetic Seller' } });
        fireEvent.change(screen.getByLabelText('Email', { exact: true }), { target: { value: 'seller@example.test' } });
        fireEvent.change(screen.getByLabelText('Phone', { exact: true }), { target: { value: '5550101234' } });
        fireEvent.change(screen.getByLabelText('Closing Date'), { target: { value: '2026-12-01' } });
        fireEvent.click(document.getElementById('sendSellerEmail')!);
        fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
        fireEvent.click(screen.getByRole('switch', { name: 'Ask about HOA or condo association' }));
        fireEvent.click(screen.getByTestId('new-request-create'));
        await screen.findByText('Form changed. Reload before saving or starting.');
        expect(submissions[0]).toMatchObject({ formRevision: 2, collectHoaQuestions: true });
        expect(screen.getByTestId('new-request-create')).toBeDisabled();
        const recover = screen.getByRole('button', { name: keepOverrides ? 'Refresh form and keep my settings' : 'Reload form defaults' });
        fireEvent.click(recover);
        await screen.findByText('Unable to refresh the form. Your request has been kept. Try again.');
        expect(screen.getByRole('switch', { name: 'Ask about HOA or condo association' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByTestId('new-request-create')).toBeDisabled();
        expect(submissions).toHaveLength(1); // no automatic retry/mail
        fireEvent.click(recover);
        await screen.findByText('Seller introduction: Current introduction');
        await waitFor(() => expect(screen.getByTestId('new-request-create')).toBeEnabled());
        fireEvent.click(screen.getByTestId('new-request-create'));
        await waitFor(() => expect(submissions).toHaveLength(2));
        expect(submissions[1]).toMatchObject({
            formRevision: 3, formId: initial.id, propertyAddress: '456 Synthetic Street', sellerName: 'Synthetic Seller',
            sellerEmail: 'seller@example.test', sellerPhone: '5550101234', closingDate: '2026-12-01', sendSellerEmail: false,
            collectHoaQuestions: keepOverrides, collectElectricMeterNumber: !keepOverrides,
            utilityCategories: keepOverrides ? ['electric', 'water'] : ['water'],
        });
        expect(formsReads).toBe(3);
    });
});

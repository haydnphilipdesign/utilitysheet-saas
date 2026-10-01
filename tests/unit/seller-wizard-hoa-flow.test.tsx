import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HoaAnswers, ProviderSuggestion, UtilityCategory } from '@/types';
import { SellerWizard } from '@/components/seller-form/SellerWizard';

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.ComponentPropsWithoutRef<'div'>) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useReducedMotion: () => true,
}));

vi.mock('@/lib/analytics/events', () => ({
    trackEvent: vi.fn(),
}));

const emptySuggestions = {
    electric: [],
    gas: [],
    water: [],
    sewer: [],
    trash: [],
    internet: [],
    cable: [],
    propane: [],
    oil: [],
} as Record<UtilityCategory, ProviderSuggestion[]>;

function renderWizard(hoa?: HoaAnswers, collectHoaQuestions?: boolean) {
    return render(
        <SellerWizard
            token="seller-wizard-hoa-test-token"
            initialRequestData={{
                property_address: '123 Test Lane',
                utility_categories: ['electric'],
                collect_electric_meter_number: false,
                collect_hoa_questions: collectHoaQuestions,
                packet_mode: 'simple',
                advanced_modules: [],
                advanced_packet_data: {},
                hoa,
            }}
            initialSuggestions={emptySuggestions}
        />
    );
}

function openHomeBasics() {
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
}

function continueToReview() {
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    fireEvent.click(screen.getByTestId('seller-utility-skip-electric'));
    expect(screen.getByText('Review and Submit')).toBeInTheDocument();
}

async function submitAndReadBody(fetchMock: ReturnType<typeof vi.fn>) {
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
        '/api/seller/seller-wizard-hoa-test-token',
        expect.objectContaining({ method: 'POST' })
    ));
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/seller/seller-wizard-hoa-test-token');
    return JSON.parse(call?.[1]?.body as string) as Record<string, unknown>;
}

describe('SellerWizard HOA question', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('asks the gate on Home Basics in simple mode and hides the details until a Yes', () => {
        renderWizard();
        openHomeBasics();

        expect(screen.getByText('Is this home part of an HOA or condo association?')).toBeInTheDocument();
        expect(screen.queryByTestId('hoa-details')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('has-hoa-yes'));
        expect(screen.getByTestId('hoa-details')).toBeInTheDocument();
        expect(screen.getByLabelText('Association Name')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('has-hoa-not_sure'));
        expect(screen.queryByTestId('hoa-details')).not.toBeInTheDocument();
    });

    it('costs a No one tap and sends no association details', async () => {
        renderWizard();
        openHomeBasics();

        fireEvent.click(screen.getByTestId('has-hoa-no'));
        expect(screen.queryByTestId('hoa-details')).not.toBeInTheDocument();

        continueToReview();
        expect(within(screen.getByTestId('review-hoa')).getByText('No')).toBeInTheDocument();

        const body = await submitAndReadBody(fetchMock);
        expect(body.has_hoa).toBe('no');
        expect(body.hoa_name).toBeNull();
    });

    it('carries a Yes and its details through review and into the submission', async () => {
        renderWizard();
        openHomeBasics();

        fireEvent.click(screen.getByTestId('has-hoa-yes'));
        fireEvent.change(screen.getByLabelText('Association Name'), { target: { value: 'Lakeview Commons HOA' } });
        fireEvent.change(screen.getByLabelText('Contact Email'), { target: { value: 'office@lakeview.example' } });
        fireEvent.change(screen.getByLabelText('Dues'), { target: { value: '$240' } });
        fireEvent.click(screen.getByTestId('hoa-dues-frequency-quarterly'));

        continueToReview();
        const review = within(screen.getByTestId('review-hoa'));
        expect(review.getByText('Yes')).toBeInTheDocument();
        expect(review.getByText('Lakeview Commons HOA')).toBeInTheDocument();
        expect(review.getByText('$240 per quarter')).toBeInTheDocument();

        const body = await submitAndReadBody(fetchMock);
        expect(body).toMatchObject({
            has_hoa: 'yes',
            hoa_name: 'Lakeview Commons HOA',
            hoa_management_email: 'office@lakeview.example',
            hoa_dues_amount: '$240',
            hoa_dues_frequency: 'quarterly',
        });
    });

    it('warns against passwords next to the portal field', () => {
        renderWizard();
        openHomeBasics();
        fireEvent.click(screen.getByTestId('has-hoa-yes'));

        expect(screen.getByLabelText('Payments & Documents')).toHaveAccessibleDescription(/passwords or account numbers/i);
    });

    it('shows a skipped gate as not answered rather than guessing', () => {
        renderWizard();
        openHomeBasics();
        continueToReview();

        expect(within(screen.getByTestId('review-hoa')).getByText('Not answered')).toBeInTheDocument();
    });

    it('prefills earlier answers so a resubmission does not wipe them', async () => {
        renderWizard({
            has_hoa: 'yes',
            hoa_name: 'Lakeview Commons HOA',
            hoa_management_company: null,
            hoa_management_contact: null,
            hoa_management_phone: '(555) 204-8890',
            hoa_management_email: null,
            hoa_dues_amount: null,
            hoa_dues_frequency: null,
            hoa_portal_or_payment: null,
        });
        openHomeBasics();

        expect(screen.getByLabelText('Association Name')).toHaveValue('Lakeview Commons HOA');

        continueToReview();
        const body = await submitAndReadBody(fetchMock);
        expect(body).toMatchObject({ has_hoa: 'yes', hoa_name: 'Lakeview Commons HOA', hoa_management_phone: '(555) 204-8890' });
    });

    it('labels the water and sewer billing option the same way on review as on Home Basics', () => {
        renderWizard();
        openHomeBasics();

        fireEvent.click(screen.getAllByRole('button', { name: /included in hoa \/ condo fee/i })[0]);
        continueToReview();

        expect(screen.getByText('Included in HOA / Condo Fee')).toBeInTheDocument();
        expect(screen.queryByText('HOA / Condo')).not.toBeInTheDocument();
    });

    it('does not ask or review the HOA question when the account turned it off', () => {
        renderWizard(undefined, false);
        openHomeBasics();

        expect(screen.getByRole('heading', { name: 'Home Basics' })).toBeInTheDocument();
        expect(screen.queryByText('Is this home part of an HOA or condo association?')).not.toBeInTheDocument();
        expect(screen.queryByTestId('has-hoa-yes')).not.toBeInTheDocument();

        continueToReview();
        expect(screen.queryByTestId('review-hoa')).not.toBeInTheDocument();
    });

    it('keeps a draft saved before the question existed usable', () => {
        localStorage.setItem('us_seller_draft:seller-wizard-hoa-test-token', JSON.stringify({
            v: 2,
            currentStep: 1,
            utilityIndex: 0,
            state: {
                water_source: 'city',
                sewer_type: 'public',
                heating_type: 'not_sure',
                fuels_present: [],
                primary_heating_type: null,
                trash_handled_by: 'not_sure',
                optional_utilities: [],
                packet_mode: 'simple',
                advanced_modules: [],
                advanced_module_exclusions: {},
                advanced: {},
                utilities: {},
            },
        }));

        renderWizard();

        expect(screen.getByText('Is this home part of an HOA or condo association?')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('has-hoa-yes'));
        expect(screen.getByLabelText('Association Name')).toHaveValue('');
    });
});

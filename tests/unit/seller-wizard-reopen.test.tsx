import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderSuggestion, UtilityCategory } from '@/types';
import { SellerWizard } from '@/components/seller-form/SellerWizard';
import { buildSellerPrefill, sellerPrefillToWizardState, type SellerPrefill } from '@/lib/seller-form/prefill';

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

const TOKEN = 'seller-wizard-reopen-test-token';
const DRAFT_KEY = `us_seller_draft:${TOKEN}`;

const suggestions = {
    electric: [{ display_name: 'PPL Electric', confidence: 0.9 }],
    water: [{ display_name: 'City Water Authority', confidence: 0.9 }],
    gas: [], sewer: [], trash: [], internet: [], cable: [], propane: [], oil: [],
} as Record<UtilityCategory, ProviderSuggestion[]>;

/** The sheet as stored after a coordinator corrected the electric provider. */
const storedSheet: SellerPrefill = buildSellerPrefill(
    { water_source: 'city', sewer_type: 'septic', heating_type: 'oil' },
    [
        { category: 'electric', entry_mode: 'free_text', display_name: 'Corrected Power Co', raw_text: 'Corrected Power Co', contact_phone: '555-0100', meter_number: 'M-77', extra: {} },
        { category: 'water', entry_mode: 'suggested_confirmed', display_name: 'City Water Authority', raw_text: null, extra: {} },
        { category: 'oil', entry_mode: 'unknown', display_name: null, raw_text: null, extra: {} },
        { category: 'trash', entry_mode: 'free_text', display_name: 'Hauler Co', raw_text: 'Hauler Co', extra: { trash_pickup_days: ['mon'], trash_pickup_day: 'mon' } },
    ],
    { requestedCategories: ['electric', 'water', 'oil', 'trash'], collectElectricMeterNumber: true }
);

function renderWizard(options: { editVersion?: number; prefill?: SellerPrefill; hoa?: { has_hoa: 'yes' | 'no' | 'not_sure' } } = {}) {
    return render(
        <SellerWizard
            token={TOKEN}
            initialRequestData={{
                property_address: '123 Test Lane',
                utility_categories: ['electric', 'water', 'oil', 'trash'],
                collect_electric_meter_number: true,
                collect_hoa_questions: Boolean(options.hoa),
                packet_mode: 'simple',
                advanced_modules: [],
                advanced_packet_data: {},
                edit_version: options.editVersion,
                prefill: options.prefill,
                hoa: options.hoa ? {
                    has_hoa: options.hoa.has_hoa, hoa_name: null, hoa_management_company: null, hoa_management_contact: null,
                    hoa_management_phone: null, hoa_management_email: null, hoa_dues_amount: null, hoa_dues_frequency: null,
                    hoa_portal_or_payment: null,
                } : undefined,
            }}
            initialSuggestions={suggestions}
        />
    );
}

const heading = (name: string | RegExp) => screen.getByRole('heading', { name, level: 3 });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const readDraft = () => JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
const settle = () => new Promise((resolve) => setTimeout(resolve, 400));

function postedBodies(fetchMock: ReturnType<typeof vi.fn>) {
    return fetchMock.mock.calls
        .filter(([url, init]) => url === `/api/seller/${TOKEN}` && init?.method === 'POST')
        .map(([, init]) => JSON.parse(init.body as string));
}

function completeFirstSessionToReview() {
    click(/get started/i);
    click(/public water/i);
    click(/septic system/i);
    click(/^continue$/i);
    click(/ppl electric/i);
    click(/^continue$/i);
    click(/city water authority/i);
    // Trash is always asked when the request includes it.
    click('No trash service at this home');
    expect(heading('Review and Submit')).toBeInTheDocument();
}

describe('stored sheet to seller form', () => {
    it('rebuilds Home Basics choices from the stored sheet', () => {
        expect(sellerPrefillToWizardState(storedSheet)).toMatchObject({
            water_source: 'city',
            sewer_type: 'septic',
            fuels_present: ['oil'],
            primary_heating_type: 'oil',
            // Trash is no longer a tick box; a row on the sheet is a trash answer.
            optional_utilities: [],
        });
    });

    it('keeps an electric heating type that has no fuel provider and tolerates empty values', () => {
        expect(sellerPrefillToWizardState({ water_source: null, sewer_type: 'bogus', heating_type: 'electric', utilities: [] })).toMatchObject({
            // An empty or invalid stored value is unanswered, not "Not Sure".
            water_source: null, sewer_type: null, fuels_present: ['electric'], primary_heating_type: 'electric', optional_utilities: [],
        });
        // "No trash service" is never assumed from a missing row.
        expect(sellerPrefillToWizardState(storedSheet)).not.toHaveProperty('no_trash_service');
        expect(sellerPrefillToWizardState({ water_source: 'well', sewer_type: null, heating_type: 'not_sure', utilities: [] })).toMatchObject({
            fuels_present: [], primary_heating_type: null,
        });
    });

    it('drops categories that were not requested and the meter number when it is not collected', () => {
        const prefill = buildSellerPrefill({}, [
            { category: 'electric', entry_mode: 'free_text', display_name: 'Power', meter_number: 'M-1', confidence_score: '0.80' },
            { category: 'cable', entry_mode: 'free_text', display_name: 'Cable Co' },
            { category: 'electric', entry_mode: 'free_text', display_name: 'Duplicate Row' },
        ], { requestedCategories: ['electric'], collectElectricMeterNumber: false });
        expect(prefill.utilities).toEqual([
            expect.objectContaining({ category: 'electric', display_name: 'Power', meter_number: null, confidence_score: 0.8 }),
        ]);
    });
});

describe('SellerWizard editing sessions', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('opens a reopened request on Review with the stored answers and submits for that session', async () => {
        renderWizard({ editVersion: 1, prefill: storedSheet });

        expect(heading('Review and Submit')).toBeInTheDocument();
        expect(screen.getByTestId('review-reopened-notice')).toBeInTheDocument();
        expect(screen.getByText('Corrected Power Co')).toBeInTheDocument();
        expect(screen.getByText('City Water Authority')).toBeInTheDocument();
        expect(screen.getByText('Hauler Co')).toBeInTheDocument();
        expect(screen.getByTestId('review-electric-meter-number')).toHaveValue('M-77');
        expect(screen.getByText('Septic System')).toBeInTheDocument();

        click(/submit/i);
        await waitFor(() => expect(postedBodies(fetchMock)).toHaveLength(1));
        const body = postedBodies(fetchMock)[0];
        expect(body.edit_version).toBe(1);
        expect(body.submission_key).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
        expect(body).toMatchObject({ water_source: 'city', sewer_type: 'septic', primary_heating_type: 'oil' });
        expect(body.utilities.electric).toMatchObject({ entry_mode: 'free_text', display_name: 'Corrected Power Co', contact_phone: '555-0100', meter_number: 'M-77', hidden: false });
        expect(body.utilities.oil).toMatchObject({ entry_mode: 'unknown', hidden: false });
        expect(body.utilities.trash.extra).toMatchObject({ trash_pickup_days: ['mon'] });
    });

    it('lets the seller change one stored answer and return to Review', async () => {
        renderWizard({ editVersion: 1, prefill: storedSheet });
        fireEvent.click(screen.getByLabelText('Edit Water'));
        expect(within(screen.getByTestId('seller-utility-current-water')).getByText('City Water Authority')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('seller-utility-skip-water'));
        expect(heading('Review and Submit')).toBeInTheDocument();

        click(/submit/i);
        await waitFor(() => expect(postedBodies(fetchMock)).toHaveLength(1));
        expect(postedBodies(fetchMock)[0].utilities.water.entry_mode).toBe('unknown');
        expect(postedBodies(fetchMock)[0].utilities.electric.display_name).toBe('Corrected Power Co');
    });

    it('discards a draft from an earlier session instead of overriding the stored sheet', async () => {
        // First session: answers typed and left as a draft on this device.
        const first = renderWizard();
        completeFirstSessionToReview();
        await waitFor(() => expect(readDraft()?.state?.utilities?.electric?.display_name).toBe('PPL Electric'));
        expect(readDraft().editVersion).toBe(0);
        first.unmount();

        // The coordinator corrected the sheet and reopened it.
        renderWizard({ editVersion: 1, prefill: storedSheet });
        expect(heading('Review and Submit')).toBeInTheDocument();
        expect(screen.getByText('Corrected Power Co')).toBeInTheDocument();
        expect(screen.queryByText('PPL Electric')).not.toBeInTheDocument();

        await waitFor(() => expect(readDraft()?.editVersion).toBe(1));
        expect(readDraft().state.utilities.electric.display_name).toBe('Corrected Power Co');
    });

    it('discards a draft that has no session number when the request has been reopened', () => {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
            v: 2, currentStep: 4, utilityIndex: 0,
            state: { ...sellerPrefillToWizardState(storedSheet), utilities: { electric: { entry_mode: 'free_text', display_name: 'Old Draft Power', hidden: false } } },
        }));
        renderWizard({ editVersion: 1, prefill: storedSheet });
        expect(screen.getByText('Corrected Power Co')).toBeInTheDocument();
        expect(screen.queryByText('Old Draft Power')).not.toBeInTheDocument();
    });

    it('keeps a draft from the current session over the stored sheet', async () => {
        const first = renderWizard({ editVersion: 1, prefill: storedSheet });
        fireEvent.click(screen.getByLabelText('Edit Water'));
        fireEvent.click(screen.getByTestId('seller-utility-skip-water'));
        await waitFor(() => expect(readDraft()?.state?.utilities?.water?.entry_mode).toBe('unknown'));
        first.unmount();

        renderWizard({ editVersion: 1, prefill: storedSheet });
        expect(await screen.findByRole('heading', { name: 'Review and Submit', level: 3 })).toBeInTheDocument();
        await waitFor(() => expect(screen.queryByText('City Water Authority')).not.toBeInTheDocument());
        expect(screen.getByText('Corrected Power Co')).toBeInTheDocument();
    });

    it('ignores a draft left on the success screen', () => {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ v: 2, editVersion: 0, currentStep: 5, state: { water_source: 'city' } }));
        renderWizard();
        expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
        expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    });

    it('asks Home Basics again when the stored sheet has an HOA billing choice that conflicts with a No', () => {
        renderWizard({
            editVersion: 1,
            hoa: { has_hoa: 'no' },
            prefill: { ...storedSheet, water_source: 'hoa' },
        });
        expect(heading('Home Basics')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent(/update your water selection/i);
        expect(screen.getByRole('button', { name: /^continue$/i })).toBeDisabled();
    });

    it('shows the already-submitted notice and keeps no draft when the server refuses a stale tab', async () => {
        fetchMock.mockImplementation(async () => new Response(JSON.stringify({ code: 'ALREADY_SUBMITTED' }), { status: 409 }));
        renderWizard();
        completeFirstSessionToReview();
        await waitFor(() => expect(readDraft()).not.toBeNull());

        click(/submit/i);
        expect(await screen.findByTestId('seller-notice-submitted')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
        await settle();
        expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    });

    it('offers a reload when the form was reopened or closed after this page loaded', async () => {
        fetchMock.mockImplementation(async () => new Response(JSON.stringify({ code: 'STALE_SESSION' }), { status: 409 }));
        renderWizard();
        completeFirstSessionToReview();

        click(/submit/i);
        expect(await screen.findByTestId('seller-notice-stale')).toBeInTheDocument();
        expect(screen.getByTestId('seller-notice-reload')).toBeInTheDocument();
        await settle();
        expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    });

    it('reuses the retry key after a lost response and issues a new one when answers change', async () => {
        fetchMock.mockRejectedValueOnce(new TypeError('network down'));
        renderWizard();
        completeFirstSessionToReview();

        click(/submit/i);
        expect(await screen.findByTestId('review-submit-error')).toBeInTheDocument();
        // The key survives in the draft, so a reload can still retry safely.
        await waitFor(() => expect(readDraft()?.submissionAttempt?.key).toBe(postedBodies(fetchMock)[0].submission_key));

        fetchMock.mockRejectedValueOnce(new TypeError('network down'));
        fireEvent.click(screen.getByTestId('review-submit-retry'));
        await waitFor(() => expect(postedBodies(fetchMock)).toHaveLength(2));
        expect(postedBodies(fetchMock)[1].submission_key).toBe(postedBodies(fetchMock)[0].submission_key);
        expect(await screen.findByTestId('review-submit-error')).toBeInTheDocument();

        // Changed answers are a different submission.
        fireEvent.change(screen.getByTestId('review-electric-meter-number'), { target: { value: 'M-NEW' } });
        fireEvent.click(screen.getByTestId('review-submit-retry'));
        await waitFor(() => expect(postedBodies(fetchMock)).toHaveLength(3));
        expect(postedBodies(fetchMock)[2].submission_key).not.toBe(postedBodies(fetchMock)[0].submission_key);
        expect(await screen.findByRole('heading', { name: 'All Done!' })).toBeInTheDocument();
    });

    it('leaves no draft behind after a successful submission', async () => {
        renderWizard();
        completeFirstSessionToReview();
        await waitFor(() => expect(readDraft()).not.toBeNull());

        click(/submit/i);
        expect(await screen.findByRole('heading', { name: 'All Done!' })).toBeInTheDocument();
        await settle();
        expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    });
});

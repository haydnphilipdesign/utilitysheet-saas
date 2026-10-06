import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderSuggestion, UtilityCategory } from '@/types';
import { SellerWizard } from '@/components/seller-form/SellerWizard';
import { buildSellerPrefill, type SellerPrefill } from '@/lib/seller-form/prefill';

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

const TOKEN = 'seller-wizard-basics-trash-cable-token';
const DRAFT_KEY = `us_seller_draft:${TOKEN}`;

const suggestions = {
    electric: [{ display_name: 'PPL Electric', confidence: 0.9 }],
    water: [{ display_name: 'City Water Authority', confidence: 0.9 }],
    trash: [{ display_name: 'GreenCart Waste', confidence: 0.9 }],
    internet: [{ display_name: 'Blue Ridge Fiber', confidence: 0.9, contact_phone: '555-0106', contact_website: 'https://fiber.example', canonical_id: 'blue-ridge-fiber' }],
    cable: [{ display_name: 'Valley Cable', confidence: 0.9 }],
    gas: [], sewer: [], propane: [], oil: [],
} as Record<UtilityCategory, ProviderSuggestion[]>;

function renderWizard(options: {
    categories?: UtilityCategory[];
    hoa?: boolean;
    isDemo?: boolean;
    editVersion?: number;
    prefill?: SellerPrefill;
} = {}) {
    return render(
        <SellerWizard
            token={TOKEN}
            isDemo={options.isDemo}
            initialRequestData={{
                property_address: '123 Test Lane',
                utility_categories: options.categories ?? ['electric', 'water', 'sewer', 'trash', 'internet', 'cable'],
                collect_electric_meter_number: false,
                collect_hoa_questions: options.hoa === true,
                packet_mode: 'simple',
                advanced_modules: [],
                advanced_packet_data: {},
                edit_version: options.editVersion,
                prefill: options.prefill,
            }}
            initialSuggestions={suggestions}
        />
    );
}

const heading = (name: string | RegExp) => screen.getByRole('heading', { name, level: 3 });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const continueButton = () => screen.getByRole('button', { name: /^continue$/i });
const pressed = (name: string | RegExp) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

function answerBasics() {
    click('Private Well');
    click('Septic System');
}

async function submitAndReadBody(fetchMock: ReturnType<typeof vi.fn>) {
    click(/submit/i);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/seller/${TOKEN}`, expect.objectContaining({ method: 'POST' })));
    const call = fetchMock.mock.calls.find(([url]) => url === `/api/seller/${TOKEN}`);
    return JSON.parse(call?.[1]?.body as string) as Record<string, unknown> & {
        utilities: Record<string, Record<string, unknown> | undefined>;
    };
}

function saveDraft(draft: Record<string, unknown>) {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ v: 2, editVersion: 0, ...draft }));
}

const answeredElectric = { entry_mode: 'suggested_confirmed', display_name: 'PPL Electric', raw_text: null, meter_number: null, hidden: false };

describe('seller form: required basics, trash always asked, same as internet', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('Water Source and Sewer Type', () => {
        it('start with nothing selected and block Continue, with the reason, until both are answered', () => {
            renderWizard({ hoa: true });
            click(/get started/i);

            for (const name of ['Private Well', 'Septic System', /Public Water/, /Public Sewer/]) {
                expect(pressed(name)).toBe('false');
            }
            // Water and sewer "Not Sure" follow the HOA one.
            const notSure = screen.getAllByRole('button', { name: /^Not Sure$/ });
            expect(notSure).toHaveLength(3);
            notSure.forEach((button) => expect(button).toHaveAttribute('aria-pressed', 'false'));

            expect(continueButton()).toBeDisabled();
            expect(continueButton()).toHaveAccessibleDescription('Choose a water and sewer option above to continue.');
            // An unanswered question is not explained as an HOA correction.
            expect(screen.queryByRole('status')).not.toBeInTheDocument();

            click('Private Well');
            expect(continueButton()).toBeDisabled();
            expect(screen.getByText('Choose a sewer option above to continue.')).toBeInTheDocument();

            click('Septic System');
            expect(continueButton()).toBeEnabled();
            expect(screen.queryByText(/option above to continue/)).not.toBeInTheDocument();
        });

        it('accept Not Sure as a deliberate answer and leave the HOA question skippable', async () => {
            renderWizard({ hoa: true, categories: ['electric'] });
            click(/get started/i);
            const [, waterNotSure, sewerNotSure] = screen.getAllByRole('button', { name: /^Not Sure$/ });
            fireEvent.click(waterNotSure);
            fireEvent.click(sewerNotSure);
            expect(waterNotSure).toHaveAttribute('aria-pressed', 'true');
            expect(continueButton()).toBeEnabled();

            fireEvent.click(continueButton());
            fireEvent.click(screen.getByTestId('seller-utility-skip-electric'));
            expect(within(screen.getByTestId('review-hoa')).getByText('Not answered')).toBeInTheDocument();

            const body = await submitAndReadBody(fetchMock);
            expect(body).toMatchObject({ water_source: 'not_sure', sewer_type: 'not_sure', has_hoa: null });
        });

        it('explain a choice cleared by an HOA No, and only that one', () => {
            renderWizard({ hoa: true });
            click(/get started/i);
            fireEvent.click(screen.getAllByRole('button', { name: /included in hoa/i })[0]);
            fireEvent.click(screen.getByTestId('has-hoa-no'));

            // Water was cleared by the No; sewer was simply never answered.
            expect(screen.getByRole('status')).toHaveTextContent('update your water selection.');
            expect(continueButton()).toHaveAccessibleDescription('Choose a water and sewer option above to continue.');

            click(/Public Water/);
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
            expect(continueButton()).toBeDisabled();
            click('Septic System');
            expect(continueButton()).toBeEnabled();
        });

        it('apply the same rule in the demo and the saved-form preview', () => {
            renderWizard({ isDemo: true });
            click(/get started/i);
            expect(continueButton()).toBeDisabled();
            answerBasics();
            expect(continueButton()).toBeEnabled();
        });

        it('send a draft with an unanswered question back to Home Basics', () => {
            saveDraft({
                currentStep: 4,
                state: { water_source: 'well', sewer_type: null, fuels_present: [], optional_utilities: [], no_trash_service: true, utilities: { electric: answeredElectric } },
            });
            renderWizard();
            expect(heading('Home Basics')).toBeInTheDocument();
            expect(pressed('Private Well')).toBe('true');
            expect(continueButton()).toBeDisabled();
        });
    });

    describe('Trash & Recycling', () => {
        it('is asked without a tick box, and the tick boxes cover only Internet and Cable/TV', () => {
            renderWizard();
            click(/get started/i);
            const tickBoxes = within(screen.getByRole('group', { name: /do you have these utilities/i })).getAllByRole('button');
            expect(tickBoxes.map((button) => button.textContent)).toEqual(['Internet', 'Cable/TV']);

            answerBasics();
            fireEvent.click(continueButton());
            click(/ppl electric/i);
            expect(heading(/Trash/)).toBeInTheDocument();
        });

        it('shows no tick boxes when only trash would have been optional', () => {
            renderWizard({ categories: ['electric', 'trash'] });
            click(/get started/i);
            expect(screen.queryByText(/do you have these utilities/i)).not.toBeInTheDocument();
        });

        it('is not asked when the request does not include trash', () => {
            renderWizard({ categories: ['electric'] });
            click(/get started/i);
            answerBasics();
            fireEvent.click(continueButton());
            click(/ppl electric/i);
            expect(heading('Review and Submit')).toBeInTheDocument();
        });

        it('keeps "I\'m not sure" as an answer that stays on the sheet', async () => {
            renderWizard({ categories: ['electric', 'trash'] });
            click(/get started/i);
            answerBasics();
            fireEvent.click(continueButton());
            click(/ppl electric/i);

            fireEvent.click(screen.getByTestId('seller-utility-skip-trash'));
            expect(screen.getByTestId('seller-trash-details-step')).toBeInTheDocument();
            click(/^continue$/i);

            const body = await submitAndReadBody(fetchMock);
            expect(body.utilities.trash).toMatchObject({ entry_mode: 'unknown', hidden: false });
        });

        it('leaves trash off the sheet for "No trash service at this home" and skips the pickup questions', async () => {
            renderWizard({ categories: ['electric', 'trash'] });
            click(/get started/i);
            answerBasics();
            fireEvent.click(continueButton());
            click(/ppl electric/i);

            click('No trash service at this home');
            expect(screen.queryByTestId('seller-trash-details-step')).not.toBeInTheDocument();
            expect(heading('Review and Submit')).toBeInTheDocument();
            expect(screen.getByText('No trash service at this home')).toBeInTheDocument();

            const body = await submitAndReadBody(fetchMock);
            // The server stores no row for a hidden entry.
            expect(body.utilities.trash).toMatchObject({ entry_mode: null, display_name: null, hidden: true });
            expect(body.utilities.electric).toMatchObject({ hidden: false });
            expect(body).not.toHaveProperty('no_trash_service');
        });

        it('lets the seller replace "No trash service" with a provider, and the reverse', async () => {
            renderWizard({ categories: ['electric', 'trash'] });
            click(/get started/i);
            answerBasics();
            fireEvent.click(continueButton());
            click(/ppl electric/i);
            click('No trash service at this home');

            fireEvent.click(screen.getByLabelText('Edit Trash & Recycling'));
            expect(within(screen.getByTestId('seller-utility-current-trash')).getByText('No trash service at this home')).toBeInTheDocument();
            // Keeping it returns without the pickup questions.
            fireEvent.click(screen.getByTestId('seller-utility-keep-trash'));
            expect(heading('Review and Submit')).toBeInTheDocument();

            fireEvent.click(screen.getByLabelText('Edit Trash & Recycling'));
            click(/greencart waste/i);
            click(/save & return to review/i);
            expect(screen.getByText('GreenCart Waste')).toBeInTheDocument();
            expect(screen.queryByText('No trash service at this home')).not.toBeInTheDocument();

            fireEvent.click(screen.getByLabelText('Edit Trash & Recycling'));
            click('No trash service at this home');
            expect(screen.queryByText('GreenCart Waste')).not.toBeInTheDocument();

            const body = await submitAndReadBody(fetchMock);
            expect(body.utilities.trash).toMatchObject({ entry_mode: null, display_name: null, hidden: true });
        });
    });

    describe('Same as Internet on Cable/TV', () => {
        function reachCable(answerInternet: () => void) {
            renderWizard({ categories: ['electric', 'water', 'sewer', 'internet', 'cable'] });
            click(/get started/i);
            click(/Public Water/);
            click(/Public Sewer/);
            click('Internet');
            click('Cable/TV');
            fireEvent.click(continueButton());
            click(/ppl electric/i);
            click(/city water authority/i);
            // No shortcut on Sewer after Water.
            expect(heading('Sewer Provider')).toBeInTheDocument();
            expect(screen.queryByTestId('seller-utility-same-as-internet')).not.toBeInTheDocument();
            fireEvent.click(screen.getByTestId('seller-utility-skip-sewer'));
            expect(heading('Internet Provider')).toBeInTheDocument();
            expect(screen.queryByTestId('seller-utility-same-as-internet')).not.toBeInTheDocument();
            answerInternet();
            expect(heading('Cable/TV Provider')).toBeInTheDocument();
        }

        it('is offered first, is not preselected, and copies the name only', async () => {
            reachCable(() => click(/blue ridge fiber/i));

            const offer = screen.getByTestId('seller-utility-same-as-internet');
            expect(offer).toHaveTextContent('Same as Internet: Blue Ridge Fiber');
            const valleyCable = screen.getByRole('button', { name: /valley cable/i });
            expect(offer.compareDocumentPosition(valleyCable) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
            // An offer, not an answer.
            expect(screen.queryByTestId('seller-utility-current-cable')).not.toBeInTheDocument();

            fireEvent.click(offer);
            expect(heading('Review and Submit')).toBeInTheDocument();

            const body = await submitAndReadBody(fetchMock);
            expect(body.utilities.internet).toMatchObject({ display_name: 'Blue Ridge Fiber', contact_phone: '555-0106', canonical_id: 'blue-ridge-fiber' });
            expect(body.utilities.cable).toMatchObject({
                entry_mode: 'free_text',
                display_name: 'Blue Ridge Fiber',
                raw_text: 'Blue Ridge Fiber',
                canonical_id: null,
                confidence_score: null,
                contact_phone: null,
                contact_url: null,
                hidden: false,
            });
        });

        it('leaves the seller free to choose something else', async () => {
            reachCable(() => click(/blue ridge fiber/i));
            click(/valley cable/i);
            const body = await submitAndReadBody(fetchMock);
            expect(body.utilities.cable).toMatchObject({ entry_mode: 'suggested_confirmed', display_name: 'Valley Cable' });
        });

        it('is not offered when Internet has no named provider', () => {
            reachCable(() => fireEvent.click(screen.getByTestId('seller-utility-skip-internet')));
            expect(screen.queryByTestId('seller-utility-same-as-internet')).not.toBeInTheDocument();
        });
    });

    describe('drafts saved before this change', () => {
        const oldState = (overrides: Record<string, unknown> = {}) => ({
            water_source: 'not_sure',
            sewer_type: 'not_sure',
            heating_type: 'not_sure',
            fuels_present: [],
            primary_heating_type: null,
            trash_handled_by: 'not_sure',
            optional_utilities: [],
            packet_mode: 'simple',
            advanced_modules: [],
            advanced_module_exclusions: {},
            advanced: {},
            utilities: { electric: answeredElectric },
            ...overrides,
        });

        it('keep an untouched "Not Sure" and ask the trash step the draft never saw, then return to Review', async () => {
            saveDraft({ currentStep: 4, utilityIndex: 0, state: oldState() });
            renderWizard({ categories: ['electric', 'trash'] });

            expect(await screen.findByRole('heading', { name: /Trash/, level: 3 })).toBeInTheDocument();
            expect(screen.queryByTestId('seller-utility-current-trash')).not.toBeInTheDocument();
            click('No trash service at this home');
            expect(heading('Review and Submit')).toBeInTheDocument();

            const body = await submitAndReadBody(fetchMock);
            expect(body).toMatchObject({ water_source: 'not_sure', sewer_type: 'not_sure' });
            expect(body.utilities.electric).toMatchObject({ display_name: 'PPL Electric' });
            expect(body.utilities.trash).toMatchObject({ hidden: true });
        });

        it('stop at the trash step when the draft was on a later provider step', async () => {
            saveDraft({
                currentStep: 2,
                utilityIndex: 1,
                state: oldState({ optional_utilities: ['internet'], utilities: { electric: answeredElectric, internet: { entry_mode: null, display_name: null, raw_text: null, hidden: false } } }),
            });
            renderWizard({ categories: ['electric', 'trash', 'internet'] });

            expect(await screen.findByRole('heading', { name: /Trash/, level: 3 })).toBeInTheDocument();
            fireEvent.click(screen.getByTestId('seller-utility-skip-trash'));
            click(/^continue$/i);
            expect(heading('Internet Provider')).toBeInTheDocument();
        });

        it('keep a trash answer the seller had ticked and given', async () => {
            saveDraft({
                currentStep: 4,
                state: oldState({
                    optional_utilities: ['trash'],
                    utilities: { electric: answeredElectric, trash: { entry_mode: 'free_text', display_name: 'Hauler Co', raw_text: 'Hauler Co', hidden: false } },
                }),
            });
            renderWizard({ categories: ['electric', 'trash'] });

            expect(await screen.findByRole('heading', { name: 'Review and Submit', level: 3 })).toBeInTheDocument();
            expect(screen.getByText('Hauler Co')).toBeInTheDocument();
        });

        it('ask again when the trash box had been unticked after answering', async () => {
            saveDraft({
                currentStep: 4,
                state: oldState({
                    utilities: { electric: answeredElectric, trash: { entry_mode: 'free_text', display_name: 'Hauler Co', raw_text: 'Hauler Co', hidden: true } },
                }),
            });
            renderWizard({ categories: ['electric', 'trash'] });

            expect(await screen.findByRole('heading', { name: /Trash/, level: 3 })).toBeInTheDocument();
            expect(screen.queryByText('Hauler Co')).not.toBeInTheDocument();
        });

        it('do not disturb a draft that is still on Home Basics', async () => {
            saveDraft({ currentStep: 1, state: oldState({ water_source: 'well' }) });
            renderWizard({ categories: ['electric', 'trash'] });

            expect(await screen.findByRole('heading', { name: 'Home Basics', level: 3 })).toBeInTheDocument();
            expect(pressed('Private Well')).toBe('true');
            expect(continueButton()).toBeEnabled();
        });
    });

    describe('reopened requests', () => {
        const categories: UtilityCategory[] = ['electric', 'water', 'trash'];
        const electricRow = { category: 'electric', entry_mode: 'free_text', display_name: 'Corrected Power Co', raw_text: 'Corrected Power Co', extra: {} };
        const trashRow = { category: 'trash', entry_mode: 'free_text', display_name: 'Hauler Co', raw_text: 'Hauler Co', extra: { trash_pickup_days: ['mon'], trash_pickup_day: 'mon' } };
        const sheet = (request: { water_source: string | null; sewer_type: string | null }, rows: Record<string, unknown>[] = [electricRow, trashRow]) =>
            buildSellerPrefill({ ...request, heating_type: null }, rows, { requestedCategories: categories, collectElectricMeterNumber: false });

        it('open on Home Basics when the stored water or sewer value is empty, then return to Review', async () => {
            renderWizard({ categories, editVersion: 1, prefill: sheet({ water_source: null, sewer_type: 'septic' }) });

            expect(heading('Home Basics')).toBeInTheDocument();
            expect(pressed('Septic System')).toBe('true');
            screen.getAllByRole('button', { name: /^Not Sure$/ }).forEach((button) => expect(button).toHaveAttribute('aria-pressed', 'false'));
            expect(continueButton()).toBeDisabled();
            expect(screen.getByText('Choose a water option above to continue.')).toBeInTheDocument();

            // The new answer adds a provider step; the stored ones are not asked again.
            click(/Public Water/);
            fireEvent.click(continueButton());
            expect(heading('Water Provider')).toBeInTheDocument();
            click(/city water authority/i);
            expect(heading('Review and Submit')).toBeInTheDocument();
            expect(screen.getByTestId('review-reopened-notice')).toBeInTheDocument();

            const body = await submitAndReadBody(fetchMock);
            expect(body).toMatchObject({ water_source: 'city', sewer_type: 'septic', edit_version: 1 });
            expect(body.utilities.electric).toMatchObject({ display_name: 'Corrected Power Co' });
        });

        it('still open on Review when both stored values are present, including a stored Not Sure', () => {
            renderWizard({ categories, editVersion: 1, prefill: sheet({ water_source: 'not_sure', sewer_type: 'septic' }) });
            expect(heading('Review and Submit')).toBeInTheDocument();
        });

        it('ask the trash step first when the sheet has no trash row, instead of showing an answer nobody gave', async () => {
            renderWizard({ categories, editVersion: 1, prefill: sheet({ water_source: 'well', sewer_type: 'septic' }, [electricRow]) });

            expect(heading(/Trash/)).toBeInTheDocument();
            expect(screen.queryByTestId('seller-utility-current-trash')).not.toBeInTheDocument();

            // One tap confirms, and the stored answers are not asked again.
            click('No trash service at this home');
            expect(heading('Review and Submit')).toBeInTheDocument();
            expect(screen.getByTestId('review-reopened-notice')).toBeInTheDocument();

            const body = await submitAndReadBody(fetchMock);
            expect(body.utilities.trash).toMatchObject({ hidden: true });
            expect(body.utilities.electric).toMatchObject({ display_name: 'Corrected Power Co', hidden: false });
        });

        it('ask Home Basics and then the trash step when both are missing', () => {
            renderWizard({ categories, editVersion: 1, prefill: sheet({ water_source: null, sewer_type: 'septic' }, [electricRow]) });

            expect(heading('Home Basics')).toBeInTheDocument();
            click('Private Well');
            fireEvent.click(continueButton());
            expect(heading(/Trash/)).toBeInTheDocument();
            fireEvent.click(screen.getByTestId('seller-utility-skip-trash'));
            click(/save & return to review|^continue$/i);
            expect(heading('Review and Submit')).toBeInTheDocument();
        });

        it('do not ask about trash when the request does not include it', () => {
            const prefill = buildSellerPrefill({ water_source: 'well', sewer_type: 'septic', heating_type: null }, [electricRow], { requestedCategories: ['electric'], collectElectricMeterNumber: false });
            renderWizard({ categories: ['electric'], editVersion: 1, prefill });
            expect(heading('Review and Submit')).toBeInTheDocument();
        });

        it('keep a stored trash provider and its schedule', async () => {
            renderWizard({ categories, editVersion: 1, prefill: sheet({ water_source: 'well', sewer_type: 'septic' }) });
            expect(heading('Review and Submit')).toBeInTheDocument();

            expect(screen.getByText('Hauler Co')).toBeInTheDocument();
            const body = await submitAndReadBody(fetchMock);
            expect(body.utilities.trash).toMatchObject({ display_name: 'Hauler Co', hidden: false, extra: { trash_pickup_days: ['mon'] } });
        });
    });
});

import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdvancedModuleKey, ProviderSuggestion, UtilityCategory } from '@/types';
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

const TOKEN = 'seller-wizard-navigation-test-token';

const suggestions = {
    electric: [{ display_name: 'PPL Electric', confidence: 0.9 }, { display_name: 'Met-Ed', confidence: 0.8 }],
    water: [{ display_name: 'City Water Authority', confidence: 0.9 }],
    internet: [{ display_name: 'Service Electric', confidence: 0.9 }],
    gas: [],
    sewer: [],
    trash: [],
    cable: [],
    propane: [],
    oil: [],
} as Record<UtilityCategory, ProviderSuggestion[]>;

function renderWizard(options: {
    meter?: boolean;
    advancedModules?: AdvancedModuleKey[];
} = {}) {
    return render(
        <SellerWizard
            token={TOKEN}
            initialRequestData={{
                property_address: '123 Test Lane',
                utility_categories: ['electric', 'water', 'internet'],
                collect_electric_meter_number: options.meter === true,
                collect_hoa_questions: false,
                packet_mode: options.advancedModules ? 'advanced' : 'simple',
                advanced_modules: options.advancedModules ?? [],
                advanced_packet_data: {},
            }}
            initialSuggestions={suggestions}
        />
    );
}

const heading = (name: string | RegExp) => screen.getByRole('heading', { name, level: 3 });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

/** Welcome, Home Basics with public water, then electric and water answered. */
function completeToReview({ meter = false }: { meter?: boolean } = {}) {
    click(/get started/i);
    click(/public water/i);
    click(/^continue$/i);
    click(/ppl electric/i);
    if (meter) {
        fireEvent.change(screen.getByTestId('seller-electric-meter-number'), { target: { value: 'M-100' } });
        click(/^continue$/i);
    }
    click(/city water authority/i);
}

async function submitAndReadBody(fetchMock: ReturnType<typeof vi.fn>) {
    click(/submit/i);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/seller/${TOKEN}`, expect.objectContaining({ method: 'POST' })));
    const call = fetchMock.mock.calls.find(([url]) => url === `/api/seller/${TOKEN}`);
    return JSON.parse(call?.[1]?.body as string) as { utilities: Record<string, { display_name: string | null; entry_mode: string | null; meter_number?: string | null; hidden: boolean }> };
}

describe('SellerWizard revisiting answers', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('does not promise a question count or a duration, and shows the step total only once it is known', () => {
        renderWizard();
        expect(screen.queryByText(/quick questions/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/minutes/i)).not.toBeInTheDocument();

        click(/get started/i);
        expect(heading('Home Basics')).toBeInTheDocument();
        expect(screen.queryByText(/^\d+ of \d+$/)).not.toBeInTheDocument();

        click(/public water/i);
        click(/^continue$/i);
        expect(screen.getByText('2 of 4')).toBeInTheDocument();
    });

    it('shows the earlier answer after Back and keeps it without answering again', async () => {
        renderWizard();
        click(/get started/i);
        click(/public water/i);
        click(/^continue$/i);
        click(/ppl electric/i);
        expect(heading('Water Provider')).toBeInTheDocument();
        expect(screen.queryByTestId('seller-utility-current-water')).not.toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Back'));
        expect(heading('Electric Provider')).toBeInTheDocument();
        expect(within(screen.getByTestId('seller-utility-current-electric')).getByText('PPL Electric')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('seller-utility-keep-electric'));
        expect(heading('Water Provider')).toBeInTheDocument();
        click(/city water authority/i);

        const body = await submitAndReadBody(fetchMock);
        expect(body.utilities.electric).toMatchObject({ display_name: 'PPL Electric', entry_mode: 'suggested_confirmed' });
    });

    it('keeps the earlier answer when a search is cancelled', () => {
        renderWizard();
        completeToReview();
        fireEvent.click(screen.getByLabelText('Edit Water'));
        click(/search for another/i);
        fireEvent.change(screen.getByTestId('seller-provider-search-input'), { target: { value: 'Other' } });
        click(/cancel search/i);
        expect(within(screen.getByTestId('seller-utility-current-water')).getByText('City Water Authority')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('seller-utility-keep-water'));
        expect(heading('Review and Submit')).toBeInTheDocument();
    });

    it('returns to Review after editing one provider, including its meter step', async () => {
        renderWizard({ meter: true });
        completeToReview({ meter: true });
        expect(heading('Review and Submit')).toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Edit Electric'));
        expect(heading('Electric Provider')).toBeInTheDocument();
        click(/met-ed/i);

        // The meter number typed earlier is still there.
        expect(screen.getByTestId('seller-electric-meter-number')).toHaveValue('M-100');
        click(/save & return to review/i);
        expect(heading('Review and Submit')).toBeInTheDocument();

        const body = await submitAndReadBody(fetchMock);
        expect(body.utilities.electric).toMatchObject({ display_name: 'Met-Ed', meter_number: 'M-100' });
        expect(body.utilities.water).toMatchObject({ display_name: 'City Water Authority' });
    });

    it('goes back to Review from a provider edit without changing the answer', async () => {
        renderWizard();
        completeToReview();
        fireEvent.click(screen.getByLabelText('Edit Water'));
        fireEvent.click(screen.getByLabelText('Back'));
        expect(heading('Review and Submit')).toBeInTheDocument();

        const body = await submitAndReadBody(fetchMock);
        expect(body.utilities.water).toMatchObject({ display_name: 'City Water Authority' });
    });

    it('returns straight to Review when a Home Basics edit adds nothing', () => {
        renderWizard();
        completeToReview();
        click('Edit Home Basics');
        expect(heading('Home Basics')).toBeInTheDocument();
        click(/^continue$/i);
        expect(heading('Review and Submit')).toBeInTheDocument();
    });

    it('asks only about a utility added by a Home Basics edit, then returns to Review', async () => {
        renderWizard();
        completeToReview();
        click('Edit Home Basics');
        click(/internet/i);
        click(/^continue$/i);

        expect(heading('Internet Provider')).toBeInTheDocument();
        click(/service electric/i);
        expect(heading('Review and Submit')).toBeInTheDocument();

        const body = await submitAndReadBody(fetchMock);
        expect(body.utilities.electric).toMatchObject({ display_name: 'PPL Electric' });
        expect(body.utilities.water).toMatchObject({ display_name: 'City Water Authority' });
        expect(body.utilities.internet).toMatchObject({ display_name: 'Service Electric', hidden: false });
    });

    it('visits a handoff section enabled by a Home Basics edit before returning to Review', () => {
        renderWizard({ advancedModules: ['service_providers', 'mailbox_access'] });
        click(/get started/i);
        click(/public water/i);
        // Opt out of Mailbox & Home Access on the first pass.
        fireEvent.click(screen.getByTestId('advanced-group-mailbox_access'));
        click(/^continue$/i);
        click(/ppl electric/i);
        click(/city water authority/i);
        expect(heading('Home Service Contacts')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('advanced-continue'));
        expect(heading('Review and Submit')).toBeInTheDocument();

        click('Edit Home Basics');
        fireEvent.click(screen.getByTestId('advanced-group-mailbox_access'));
        click(/^continue$/i);

        // Not the provider steps, and not the section already completed.
        expect(heading('Mailbox & Home Access')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('advanced-continue'));
        expect(heading('Review and Submit')).toBeInTheDocument();
    });

    it('visits a new utility and then a new handoff section from the same Home Basics edit', () => {
        renderWizard({ advancedModules: ['service_providers', 'mailbox_access'] });
        click(/get started/i);
        click(/public water/i);
        fireEvent.click(screen.getByTestId('advanced-group-mailbox_access'));
        click(/^continue$/i);
        click(/ppl electric/i);
        click(/city water authority/i);
        fireEvent.click(screen.getByTestId('advanced-continue'));

        click('Edit Home Basics');
        click(/internet/i);
        fireEvent.click(screen.getByTestId('advanced-group-mailbox_access'));
        click(/^continue$/i);

        expect(heading('Internet Provider')).toBeInTheDocument();
        click(/service electric/i);
        expect(heading('Mailbox & Home Access')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('advanced-continue'));
        expect(heading('Review and Submit')).toBeInTheDocument();
    });

    it('restores a draft saved mid-edit with the answer shown and the return to Review intact', async () => {
        const first = renderWizard();
        completeToReview();
        fireEvent.click(screen.getByLabelText('Edit Water'));
        await waitFor(() => {
            const draft = JSON.parse(localStorage.getItem(`us_seller_draft:${TOKEN}`) || '{}');
            expect(draft.navigationMode).toBe('review_edit');
            expect(draft.utilityIndex).toBe(1);
        });
        first.unmount();

        renderWizard();
        expect(await screen.findByRole('heading', { name: 'Water Provider' })).toBeInTheDocument();
        expect(within(screen.getByTestId('seller-utility-current-water')).getByText('City Water Authority')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('seller-utility-keep-water'));
        expect(heading('Review and Submit')).toBeInTheDocument();
    });

    it('still restores a draft written before the navigation mode was generalized', async () => {
        const first = renderWizard({ advancedModules: ['mailbox_access'] });
        completeToReview();
        fireEvent.click(screen.getByTestId('advanced-continue'));
        fireEvent.click(screen.getByLabelText('Edit Mailbox & Home Access'));
        const key = `us_seller_draft:${TOKEN}`;
        await waitFor(() => expect(JSON.parse(localStorage.getItem(key) || '{}').navigationMode).toBe('review_edit'));
        first.unmount();

        const legacy = JSON.parse(localStorage.getItem(key) as string);
        legacy.advancedNavigationMode = legacy.navigationMode;
        delete legacy.navigationMode;
        delete legacy.reviewedAdvancedModules;
        localStorage.setItem(key, JSON.stringify(legacy));

        renderWizard({ advancedModules: ['mailbox_access'] });
        expect(await screen.findByRole('button', { name: /save & return to review/i })).toBeInTheDocument();
    });
});

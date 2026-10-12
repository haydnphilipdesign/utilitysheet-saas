import React, { ComponentPropsWithoutRef, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UtilityStep } from '@/components/seller-form/steps/UtilityStep';
import type { WizardState } from '@/components/seller-form/SellerWizard';
import { createEmptyHoaAnswers } from '@/lib/packet/hoa';
import type { ProviderSuggestion, UtilityCategory } from '@/types';

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: ComponentPropsWithoutRef<'div'>) => <div {...props}>{children}</div>,
    },
}));

const trackEventMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/analytics/events', () => ({ trackEvent: trackEventMock }));

function createWizardState(): WizardState {
    const emptyUtility = {
        entry_mode: null,
        display_name: null,
        raw_text: null,
        meter_number: null,
        hidden: false,
    };

    return {
        water_source: 'not_sure',
        sewer_type: 'not_sure',
        heating_type: 'not_sure',
        fuels_present: [],
        primary_heating_type: null,
        ...createEmptyHoaAnswers(),
        trash_handled_by: 'not_sure',
        optional_utilities: [],
        no_trash_service: false,
        packet_mode: 'simple',
        advanced_modules: [],
        advanced_module_exclusions: {},
        advanced: {},
        utilities: {
            electric: { ...emptyUtility },
            gas: { ...emptyUtility },
            propane: { ...emptyUtility },
            oil: { ...emptyUtility },
            water: { ...emptyUtility },
            sewer: { ...emptyUtility },
            trash: { ...emptyUtility },
            internet: { ...emptyUtility },
            cable: { ...emptyUtility },
        },
    };
}

const WATER_SUGGESTIONS: ProviderSuggestion[] = [
    { display_name: 'Pennsylvania American Water', confidence: 0.9 },
    { display_name: 'Aqua Pennsylvania', confidence: 0.7 },
];

function SearchHarness({ onNext = vi.fn(), suggestions = WATER_SUGGESTIONS }: {
    onNext?: () => void;
    suggestions?: ProviderSuggestion[];
}) {
    const [state, setState] = useState<WizardState>(createWizardState());
    const updateState = (
        cat: UtilityCategory,
        updates: Partial<WizardState['utilities'][UtilityCategory]>
    ) => {
        setState((prev) => ({
            ...prev,
            utilities: { ...prev.utilities, [cat]: { ...prev.utilities[cat], ...updates } },
        }));
    };

    return (
        <>
            <UtilityStep
                category="water"
                categoryLabel="Water"
                state={state}
                updateState={updateState}
                suggestions={suggestions}
                token="test-token"
                onNext={onNext}
                onBack={vi.fn()}
            />
            <pre data-testid="utility-state-json">{JSON.stringify(state.utilities)}</pre>
        </>
    );
}

function readWater() {
    return (JSON.parse(screen.getByTestId('utility-state-json').textContent || '{}') as WizardState['utilities']).water;
}

describe('UtilityStep provider search', () => {
    const fetchMock = vi.fn();

    function respondWith(results: ProviderSuggestion[]) {
        fetchMock.mockImplementation(async () => new Response(JSON.stringify(results), { status: 200 }));
    }

    function openSearch() {
        fireEvent.click(screen.getByRole('button', { name: /search for another|search providers/i }));
        return screen.getByTestId('seller-provider-search-input');
    }

    function type(input: HTMLElement, value: string) {
        fireEvent.change(input, { target: { value } });
    }

    async function wait(ms: number) {
        await act(async () => {
            await vi.advanceTimersByTimeAsync(ms);
        });
    }

    function searchedQueries() {
        return fetchMock.mock.calls.map(([url]) => new URL(String(url), 'http://localhost').searchParams.get('query'));
    }

    beforeEach(() => {
        vi.useFakeTimers();
        fetchMock.mockReset();
        trackEventMock.mockReset();
        respondWith([]);
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('calls national names common providers, not suggestions for the area', () => {
        const { unmount } = render(<SearchHarness />);
        expect(screen.getByText('Suggested for your area')).toBeInTheDocument();
        unmount();

        render(<SearchHarness suggestions={[
            { display_name: 'Xfinity (Comcast)', confidence: 0.6, is_common: true },
            { display_name: 'Spectrum', confidence: 0.6, is_common: true },
        ]} />);
        expect(screen.getByText('Common providers')).toBeInTheDocument();
        expect(screen.queryByText('Suggested for your area')).not.toBeInTheDocument();
    });

    it('shows a loaded suggestion that matches the typed name without asking the server', async () => {
        const onNext = vi.fn();
        render(<SearchHarness onNext={onNext} />);

        type(openSearch(), 'aqua');
        await wait(5_000);

        expect(fetchMock).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: /aqua pennsylvania/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /pennsylvania american water/i })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /aqua pennsylvania/i }));
        expect(readWater()).toMatchObject({ entry_mode: 'suggested_confirmed', display_name: 'Aqua Pennsylvania' });
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('asks the server once when a six-letter name with no local match is typed', async () => {
        render(<SearchHarness />);
        const input = openSearch();

        for (const value of ['h', 'hi', 'hil', 'hill', 'hillt', 'hillto']) {
            type(input, value);
            await wait(200);
        }
        expect(fetchMock).not.toHaveBeenCalled();

        await wait(900);
        expect(searchedQueries()).toEqual(['hillto']);
    });

    it('does not search a short name by itself, and shows a single match after Search is pressed', async () => {
        respondWith([{ display_name: 'PPL Water Services', confidence: 0.9 }]);
        const onNext = vi.fn();
        render(<SearchHarness onNext={onNext} />);

        type(openSearch(), 'ppl');
        await wait(5_000);
        expect(fetchMock).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('seller-provider-search-run'));
        await wait(0);

        expect(searchedQueries()).toEqual(['ppl']);
        fireEvent.click(screen.getByRole('button', { name: /ppl water services/i }));
        expect(readWater()).toMatchObject({ entry_mode: 'search_selected', display_name: 'PPL Water Services' });
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('searches at once on Enter and does not repeat it when the pause ends', async () => {
        render(<SearchHarness />);
        const input = openSearch();

        type(input, 'hilltop');
        fireEvent.keyDown(input, { key: 'Enter' });
        await wait(0);
        expect(searchedQueries()).toEqual(['hilltop']);

        await wait(5_000);
        fireEvent.keyDown(input, { key: 'Enter' });
        await wait(0);
        expect(searchedQueries()).toEqual(['hilltop']);
    });

    it('can search wider when a loaded suggestion already matches', async () => {
        respondWith([
            { display_name: 'Aqua Pennsylvania', confidence: 0.9 },
            { display_name: 'Aqua Ohio', confidence: 0.6 },
        ]);
        render(<SearchHarness />);

        type(openSearch(), 'aqua');
        fireEvent.click(screen.getByTestId('seller-provider-search-run'));
        await wait(0);

        expect(screen.getAllByRole('button', { name: /aqua pennsylvania/i })).toHaveLength(1);
        expect(screen.getByRole('button', { name: /aqua ohio/i })).toBeInTheDocument();
    });

    it('offers the typed name before any search has run', async () => {
        const onNext = vi.fn();
        render(<SearchHarness onNext={onNext} />);

        type(openSearch(), 'Hilltop Water Co-op');
        fireEvent.click(screen.getByTestId('seller-provider-use-typed'));

        expect(fetchMock).not.toHaveBeenCalled();
        expect(readWater()).toMatchObject({ entry_mode: 'free_text', display_name: 'Hilltop Water Co-op' });
        expect(trackEventMock).toHaveBeenCalledWith(
            'seller_provider_search_no_results_committed',
            expect.objectContaining({ category: 'water', searched: false, result_count: 0 })
        );
    });

    it('says so when a search finds nothing and keeps the typed name available', async () => {
        render(<SearchHarness />);

        type(openSearch(), 'hilltop');
        await wait(900);

        expect(searchedQueries()).toEqual(['hilltop']);
        expect(screen.getByText(/no matches in our directory/i)).toBeInTheDocument();
        expect(screen.getByTestId('seller-provider-use-typed')).toHaveTextContent('Use "hilltop"');
        expect(screen.queryByTestId('seller-provider-search-run')).not.toBeInTheDocument();
    });

    it('drops results that belong to an earlier query', async () => {
        respondWith([{ display_name: 'Hilltop Water Co-op', confidence: 0.9 }]);
        render(<SearchHarness />);
        const input = openSearch();

        type(input, 'hilltop');
        await wait(900);
        expect(screen.getByRole('button', { name: /hilltop water co-op/i })).toBeInTheDocument();

        type(input, 'hilltop x');
        expect(screen.queryByRole('button', { name: /hilltop water co-op/i })).not.toBeInTheDocument();
    });
});

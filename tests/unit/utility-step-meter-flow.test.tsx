import React, { ComponentPropsWithoutRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UtilityStep } from '@/components/seller-form/steps/UtilityStep';
import type { WizardState } from '@/components/seller-form/SellerWizard';
import { createEmptyHoaAnswers } from '@/lib/packet/hoa';
import type { ProviderSuggestion, UtilityCategory } from '@/types';

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: ComponentPropsWithoutRef<'div'>) => <div {...props}>{children}</div>,
    },
}));

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

function StatefulUtilityStep({
    category = 'electric',
    collectElectricMeterNumber = true,
    onNext = vi.fn(),
    onBack = vi.fn(),
    suggestions = [{ display_name: 'Met-Ed (FirstEnergy)', confidence: 0.95 }],
}: {
    category?: UtilityCategory;
    collectElectricMeterNumber?: boolean;
    onNext?: () => void;
    onBack?: () => void;
    suggestions?: ProviderSuggestion[];
}) {
    const [state, setState] = useState<WizardState>(createWizardState());

    const updateState = (
        cat: UtilityCategory,
        updates: Partial<WizardState['utilities'][UtilityCategory]>
    ) => {
        setState((prev) => ({
            ...prev,
            utilities: {
                ...prev.utilities,
                [cat]: { ...prev.utilities[cat], ...updates },
            },
        }));
    };

    return (
        <>
            <UtilityStep
                category={category}
                categoryLabel={category.charAt(0).toUpperCase() + category.slice(1)}
                state={state}
                updateState={updateState}
                suggestions={suggestions}
                token="test-token"
                collectElectricMeterNumber={collectElectricMeterNumber}
                onNext={onNext}
                onBack={onBack}
            />
            <pre data-testid="utility-state-json">{JSON.stringify(state.utilities)}</pre>
        </>
    );
}

function readUtilityState() {
    return JSON.parse(screen.getByTestId('utility-state-json').textContent || '{}') as WizardState['utilities'];
}

describe('UtilityStep electric meter flow', () => {
    it('does not auto-advance on electric suggestion selection and shows meter step', () => {
        const onNext = vi.fn();
        render(<StatefulUtilityStep onNext={onNext} />);

        fireEvent.click(screen.getByRole('button', { name: /met-ed/i }));

        expect(onNext).not.toHaveBeenCalled();
        expect(screen.getByText('Selected Provider')).toBeInTheDocument();
        expect(screen.getByTestId('seller-electric-meter-number')).toBeInTheDocument();
    });

    it('continues with entered meter number and keeps the entered value in state', () => {
        const onNext = vi.fn();
        render(<StatefulUtilityStep onNext={onNext} />);

        fireEvent.click(screen.getByRole('button', { name: /met-ed/i }));

        const input = screen.getByTestId('seller-electric-meter-number') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'ELEC-12345' } });
        expect(input.value).toBe('ELEC-12345');

        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('offers a single Continue on the meter step and keeps what was typed', () => {
        const onNext = vi.fn();
        render(<StatefulUtilityStep onNext={onNext} />);

        fireEvent.click(screen.getByRole('button', { name: /met-ed/i }));
        fireEvent.change(screen.getByTestId('seller-electric-meter-number'), { target: { value: 'ELEC-12345' } });

        expect(screen.queryByRole('button', { name: /without meter number/i })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(readUtilityState().electric.meter_number).toBe('ELEC-12345');
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('shows no earlier answer before the seller has answered', () => {
        render(<StatefulUtilityStep />);
        expect(screen.queryByTestId('seller-utility-current-electric')).not.toBeInTheDocument();
    });

    it('keeps a named answer and its meter number when returning to the provider list', () => {
        const onNext = vi.fn();
        render(<StatefulUtilityStep onNext={onNext} />);

        fireEvent.click(screen.getByRole('button', { name: /met-ed/i }));
        fireEvent.change(screen.getByTestId('seller-electric-meter-number'), { target: { value: 'ELEC-12345' } });
        fireEvent.click(screen.getByRole('button', { name: /change provider/i }));

        expect(screen.getByTestId('seller-utility-current-electric')).toHaveTextContent('Met-Ed (FirstEnergy)');
        fireEvent.click(screen.getByTestId('seller-utility-keep-electric'));

        expect(screen.getByTestId('seller-electric-meter-number')).toHaveValue('ELEC-12345');
        expect(readUtilityState().electric).toMatchObject({ entry_mode: 'suggested_confirmed', display_name: 'Met-Ed (FirstEnergy)' });
        expect(onNext).not.toHaveBeenCalled();
    });

    it('keeps a typed-in provider answer', async () => {
        const onNext = vi.fn();
        vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })));
        try {
            render(<StatefulUtilityStep category="water" onNext={onNext} suggestions={[]} />);

            fireEvent.click(screen.getByRole('button', { name: /search providers/i }));
            fireEvent.change(screen.getByTestId('seller-provider-search-input'), { target: { value: 'Hilltop Water Co-op' } });
            fireEvent.click(await screen.findByTestId('seller-provider-use-typed'));
            expect(onNext).toHaveBeenCalledTimes(1);

            // The parent would move on; staying mounted here stands in for coming Back.
            fireEvent.click(await screen.findByRole('button', { name: /cancel search/i }));
            expect(screen.getByTestId('seller-utility-current-water')).toHaveTextContent('Hilltop Water Co-op');
            fireEvent.click(screen.getByTestId('seller-utility-keep-water'));

            expect(readUtilityState().water).toMatchObject({ entry_mode: 'free_text', display_name: 'Hilltop Water Co-op' });
            expect(onNext).toHaveBeenCalledTimes(2);
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('keeps a "Not sure" answer without opening the meter step', () => {
        const onNext = vi.fn();
        const { unmount } = render(<StatefulUtilityStep onNext={onNext} />);
        fireEvent.click(screen.getByTestId('seller-utility-skip-electric'));
        expect(onNext).toHaveBeenCalledTimes(1);

        expect(screen.getByTestId('seller-utility-current-electric')).toHaveTextContent('Not sure');
        fireEvent.click(screen.getByTestId('seller-utility-keep-electric'));

        expect(screen.queryByTestId('seller-electric-meter-number')).not.toBeInTheDocument();
        expect(readUtilityState().electric.entry_mode).toBe('unknown');
        expect(onNext).toHaveBeenCalledTimes(2);
        unmount();
    });

    it('keeps a trash answer and its schedule, reopening the schedule step', () => {
        const onNext = vi.fn();
        render(
            <StatefulUtilityStep
                category="trash"
                onNext={onNext}
                suggestions={[{ display_name: 'City Waste Services', confidence: 0.9 }]}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /city waste services/i }));
        fireEvent.click(screen.getByTestId('seller-trash-pickup-day-thu'));
        fireEvent.click(screen.getByRole('button', { name: /change provider/i }));
        fireEvent.click(screen.getByTestId('seller-utility-keep-trash'));

        expect(screen.getByTestId('seller-trash-details-step')).toBeInTheDocument();
        expect(readUtilityState().trash.extra).toMatchObject({ trash_pickup_days: ['thu'] });
        expect(onNext).not.toHaveBeenCalled();
    });

    it('electric "I don\'t know" skips meter step and advances immediately', () => {
        const onNext = vi.fn();
        render(<StatefulUtilityStep onNext={onNext} />);

        fireEvent.click(screen.getByTestId('seller-utility-skip-electric'));

        expect(onNext).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId('seller-electric-meter-number')).not.toBeInTheDocument();
    });

    it('non-electric provider selection still auto-advances immediately', () => {
        const onNext = vi.fn();
        render(
            <StatefulUtilityStep
                category="water"
                onNext={onNext}
                suggestions={[{ display_name: 'City Water Authority', confidence: 0.9 }]}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /city water authority/i }));

        expect(onNext).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId('seller-electric-meter-number')).not.toBeInTheDocument();
    });

    it('back from meter step returns to provider list and does not call parent onBack', () => {
        const onBack = vi.fn();
        render(<StatefulUtilityStep onBack={onBack} />);

        fireEvent.click(screen.getByRole('button', { name: /met-ed/i }));
        expect(screen.getByText('Selected Provider')).toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Back to providers'));

        expect(onBack).not.toHaveBeenCalled();
        expect(screen.queryByText('Selected Provider')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /met-ed/i })).toBeInTheDocument();
    });

    it('trash suggestion selection opens trash details step before advancing', () => {
        const onNext = vi.fn();
        render(
            <StatefulUtilityStep
                category="trash"
                onNext={onNext}
                suggestions={[{ display_name: 'City Waste Services', confidence: 0.9 }]}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /city waste services/i }));

        expect(onNext).not.toHaveBeenCalled();
        expect(screen.getByTestId('seller-trash-details-step')).toBeInTheDocument();
    });

    it('trash "I don\'t know" still opens trash details step', () => {
        const onNext = vi.fn();
        render(
            <StatefulUtilityStep
                category="trash"
                onNext={onNext}
                suggestions={[{ display_name: 'City Waste Services', confidence: 0.9 }]}
            />
        );

        fireEvent.click(screen.getByTestId('seller-utility-skip-trash'));

        expect(onNext).not.toHaveBeenCalled();
        expect(screen.getByTestId('seller-trash-details-step')).toBeInTheDocument();
    });

    it('trash details persist and recycling days clear when recycling is set to no', () => {
        const onNext = vi.fn();
        render(
            <StatefulUtilityStep
                category="trash"
                onNext={onNext}
                suggestions={[{ display_name: 'City Waste Services', confidence: 0.9 }]}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /city waste services/i }));

        fireEvent.click(screen.getByTestId('seller-trash-recycling-yes'));
        fireEvent.click(screen.getByTestId('seller-trash-pickup-day-thu'));
        fireEvent.click(screen.getByTestId('seller-recycling-pickup-day-fri'));
        fireEvent.click(screen.getByTestId('seller-trash-recycling-no'));
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        const utilityState = readUtilityState();
        expect(utilityState.trash.extra).toMatchObject({
            has_recycling: 'no',
            trash_pickup_days: ['thu'],
            trash_pickup_day: 'thu',
            recycling_pickup_day: null,
            recycling_pickup_days: [],
        });
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('recycling pickup supports multiple days with the shared day picker', () => {
        const onNext = vi.fn();
        render(
            <StatefulUtilityStep
                category="trash"
                onNext={onNext}
                suggestions={[{ display_name: 'City Waste Services', confidence: 0.9 }]}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /city waste services/i }));

        fireEvent.click(screen.getByTestId('seller-trash-recycling-yes'));
        fireEvent.click(screen.getByTestId('seller-recycling-pickup-day-fri'));
        fireEvent.click(screen.getByTestId('seller-recycling-pickup-day-mon'));
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        const utilityState = readUtilityState();
        expect(utilityState.trash.extra).toMatchObject({
            has_recycling: 'yes',
            recycling_pickup_days: ['mon', 'fri'],
            recycling_pickup_day: 'mon',
        });
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('"Not sure" is exclusive with weekday selections for trash pickup', () => {
        const onNext = vi.fn();
        render(
            <StatefulUtilityStep
                category="trash"
                onNext={onNext}
                suggestions={[{ display_name: 'City Waste Services', confidence: 0.9 }]}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /city waste services/i }));

        fireEvent.click(screen.getByTestId('seller-trash-pickup-day-mon'));
        fireEvent.click(screen.getByTestId('seller-trash-pickup-not_sure'));
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        const utilityState = readUtilityState();
        expect(utilityState.trash.extra).toMatchObject({
            trash_pickup_days: [],
            trash_pickup_day: 'not_sure',
        });
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('trash details allow selecting multiple pickup days', () => {
        const onNext = vi.fn();
        render(
            <StatefulUtilityStep
                category="trash"
                onNext={onNext}
                suggestions={[{ display_name: 'City Waste Services', confidence: 0.9 }]}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /city waste services/i }));

        fireEvent.click(screen.getByLabelText('Monday'));
        fireEvent.click(screen.getByLabelText('Thursday'));
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        const utilityState = readUtilityState();
        expect(utilityState.trash.extra).toMatchObject({
            trash_pickup_days: ['mon', 'thu'],
            trash_pickup_day: 'mon',
        });
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('back from trash details returns to provider list and does not call parent onBack', () => {
        const onBack = vi.fn();
        render(
            <StatefulUtilityStep
                category="trash"
                onBack={onBack}
                suggestions={[{ display_name: 'City Waste Services', confidence: 0.9 }]}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /city waste services/i }));
        expect(screen.getByTestId('seller-trash-details-step')).toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Back to providers'));

        expect(onBack).not.toHaveBeenCalled();
        expect(screen.queryByTestId('seller-trash-details-step')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /city waste services/i })).toBeInTheDocument();
    });
});

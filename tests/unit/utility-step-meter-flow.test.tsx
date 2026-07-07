import React, { ComponentPropsWithoutRef, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UtilityStep } from '@/components/seller-form/steps/UtilityStep';
import type { WizardState } from '@/components/seller-form/SellerWizard';
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

    it('continue without meter clears meter and advances', async () => {
        const onNext = vi.fn();
        render(<StatefulUtilityStep onNext={onNext} />);

        fireEvent.click(screen.getByRole('button', { name: /met-ed/i }));

        const input = screen.getByTestId('seller-electric-meter-number') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'ELEC-12345' } });
        fireEvent.click(screen.getByRole('button', { name: /continue without meter number/i }));

        await waitFor(() => {
            expect((screen.getByTestId('seller-electric-meter-number') as HTMLInputElement).value).toBe('');
        });
        expect(onNext).toHaveBeenCalledTimes(1);
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

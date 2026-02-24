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
    return {
        water_source: 'not_sure',
        sewer_type: 'not_sure',
        heating_type: 'not_sure',
        fuels_present: [],
        primary_heating_type: null,
        trash_handled_by: 'not_sure',
        optional_utilities: [],
        utilities: {
            electric: {
                entry_mode: null,
                display_name: null,
                raw_text: null,
                meter_number: null,
                hidden: false,
            },
            water: {
                entry_mode: null,
                display_name: null,
                raw_text: null,
                meter_number: null,
                hidden: false,
            },
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
    onNext?: ReturnType<typeof vi.fn>;
    onBack?: ReturnType<typeof vi.fn>;
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
    );
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

        fireEvent.click(screen.getByRole('button', { name: "I don't know" }));

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
});

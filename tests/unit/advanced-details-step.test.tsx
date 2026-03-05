import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdvancedDetailsStep } from '@/components/seller-form/steps/AdvancedDetailsStep';
import type { AdvancedModuleKey, AdvancedPacketData } from '@/types';
import { sellerSubmissionBodySchema } from '@/lib/validation/schemas';

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.ComponentPropsWithoutRef<'div'>) => <div {...props}>{children}</div>,
    },
}));

function StatefulAdvancedStep({ moduleKey }: { moduleKey: AdvancedModuleKey }) {
    const [advanced, setAdvanced] = useState<AdvancedPacketData>({});

    return (
        <>
            <AdvancedDetailsStep
                moduleKey={moduleKey}
                moduleIndex={0}
                moduleCount={1}
                advanced={advanced}
                updateAdvanced={(updates) => setAdvanced((prev) => ({ ...prev, ...updates }))}
                onBack={vi.fn()}
                onNext={vi.fn()}
            />
            <pre data-testid="advanced-json">{JSON.stringify(advanced)}</pre>
        </>
    );
}

function readAdvancedState() {
    return JSON.parse(screen.getByTestId('advanced-json').textContent || '{}') as AdvancedPacketData;
}

describe('AdvancedDetailsStep module UX', () => {
    it('supports irrigation day chips and month selects with schema-compatible values', () => {
        render(<StatefulAdvancedStep moduleKey="irrigation_seasonal_controls" />);

        fireEvent.click(screen.getByTestId('irrigation-day-mon'));
        fireEvent.click(screen.getByTestId('irrigation-day-wed'));

        fireEvent.change(screen.getByTestId('irrigation-season-start-month'), {
            target: { value: 'apr' },
        });
        fireEvent.change(screen.getByTestId('irrigation-season-end-month'), {
            target: { value: 'oct' },
        });

        const advanced = readAdvancedState();
        expect(advanced.irrigation_seasonal_controls?.watering_days).toEqual(['mon', 'wed']);
        expect(advanced.irrigation_seasonal_controls?.irrigation_season_start_month).toBe('apr');
        expect(advanced.irrigation_seasonal_controls?.irrigation_season_end_month).toBe('oct');

        const parsed = sellerSubmissionBodySchema.safeParse({
            water_source: 'not_sure',
            sewer_type: 'not_sure',
            heating_type: 'not_sure',
            fuels_present: [],
            primary_heating_type: null,
            trash_handled_by: 'not_sure',
            utilities: {},
            packet_mode: 'advanced',
            advanced_modules: ['irrigation_seasonal_controls'],
            advanced,
        });

        expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe(true);
    });

    it('uses tel input types for provider contact fields', () => {
        render(<StatefulAdvancedStep moduleKey="lawn_exterior" />);

        const lawnPhone = screen.getByLabelText('Lawn Care Phone');
        const snowPhone = screen.getByLabelText('Snow Removal Phone');

        expect(lawnPhone).toHaveAttribute('type', 'tel');
        expect(screen.queryByLabelText('Lawn Care Email')).not.toBeInTheDocument();
        expect(snowPhone).toHaveAttribute('type', 'tel');
    });
});

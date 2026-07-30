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

    it('collects the requested pool and other maintenance provider details', () => {
        render(<StatefulAdvancedStep moduleKey="service_providers" />);

        fireEvent.change(screen.getByLabelText('Pool Service Provider'), {
            target: { value: 'Clearwater Pool Care' },
        });
        fireEvent.change(screen.getByLabelText('Pool Service Phone'), {
            target: { value: '(555) 300-4000' },
        });
        fireEvent.change(screen.getByLabelText('Other Maintenance Providers'), {
            target: { value: 'Handyman: Oak Street Home Services, (555) 300-5000' },
        });

        expect(screen.getByLabelText('Pool Service Phone')).toHaveAttribute('type', 'tel');
        expect(readAdvancedState().service_providers).toMatchObject({
            pool_service_provider_name: 'Clearwater Pool Care',
            pool_service_provider_phone: '(555) 300-4000',
            other_maintenance_providers: 'Handyman: Oak Street Home Services, (555) 300-5000',
        });
    });

    it('collects garage codes and the keys/remotes closing location', () => {
        render(<StatefulAdvancedStep moduleKey="mailbox_access" />);

        fireEvent.change(screen.getByLabelText('Garage Door Code'), {
            target: { value: '2468' },
        });
        fireEvent.change(screen.getByLabelText('Keys & Garage Remotes at Closing'), {
            target: { value: 'Kitchen counter in a labeled envelope' },
        });

        expect(readAdvancedState().mailbox_access).toMatchObject({
            garage_door_code: '2468',
            keys_and_garage_remotes_location: 'Kitchen counter in a labeled envelope',
        });
    });
});

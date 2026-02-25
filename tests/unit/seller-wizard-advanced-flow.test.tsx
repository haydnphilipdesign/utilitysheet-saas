import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderSuggestion, UtilityCategory } from '@/types';
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

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
    },
}));

const emptySuggestions: Record<UtilityCategory, ProviderSuggestion[]> = {
    electric: [],
    gas: [],
    water: [],
    sewer: [],
    trash: [],
    internet: [],
    cable: [],
    propane: [],
    oil: [],
};

function renderAdvancedWizard(overrides?: {
    advanced_modules?: Array<
        | 'lawn_exterior'
        | 'irrigation_seasonal_controls'
        | 'mailbox_access'
        | 'smart_home_security'
        | 'service_providers'
    >;
}) {
    return render(
        <SellerWizard
            token="seller-wizard-advanced-test-token"
            initialRequestData={{
                property_address: '123 Test Lane',
                utility_categories: ['electric'],
                collect_electric_meter_number: false,
                packet_mode: 'advanced',
                advanced_modules: overrides?.advanced_modules ?? ['service_providers', 'mailbox_access'],
                advanced_packet_data: {},
            }}
            initialSuggestions={emptySuggestions}
        />
    );
}

function renderSimpleWizard() {
    return render(
        <SellerWizard
            token="seller-wizard-simple-test-token"
            initialRequestData={{
                property_address: '123 Test Lane',
                utility_categories: ['electric'],
                collect_electric_meter_number: false,
                packet_mode: 'simple',
                advanced_modules: [],
                advanced_packet_data: {},
            }}
            initialSuggestions={emptySuggestions}
        />
    );
}

function advanceToFirstAdvancedModule() {
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    fireEvent.click(screen.getByRole('button', { name: "I don't know" }));
}

function advanceToReview() {
    advanceToFirstAdvancedModule();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
}

describe('SellerWizard advanced module step flow', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('renders enabled advanced modules as separate canonical-ordered steps with linear back/next', () => {
        renderAdvancedWizard();

        advanceToFirstAdvancedModule();

        expect(screen.getByText('Mailbox & Access (1 of 2)')).toBeInTheDocument();
        expect(screen.getByText('Mailbox & Access')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /continue/i }));
        expect(screen.getByText('Service Providers (2 of 2)')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /back/i }));
        expect(screen.getByText('Mailbox & Access (1 of 2)')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /continue/i }));
        fireEvent.click(screen.getByRole('button', { name: /continue/i }));
        expect(screen.getByText('Review & Submit')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
        expect(screen.getByText('Service Providers (2 of 2)')).toBeInTheDocument();
    });

    it('applies Home Basics module group toggles including mailbox access', () => {
        renderAdvancedWizard({
            advanced_modules: [
                'lawn_exterior',
                'irrigation_seasonal_controls',
                'mailbox_access',
                'smart_home_security',
                'service_providers',
            ],
        });

        fireEvent.click(screen.getByRole('button', { name: /get started/i }));

        fireEvent.click(screen.getByTestId('advanced-group-outdoor_irrigation'));
        fireEvent.click(screen.getByTestId('advanced-group-smart_home_security'));
        fireEvent.click(screen.getByTestId('advanced-group-mailbox_access'));

        fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
        fireEvent.click(screen.getByRole('button', { name: "I don't know" }));

        expect(screen.getByText('Service Providers (1 of 1)')).toBeInTheDocument();
        expect(screen.queryByText('Mailbox & Access (1 of 2)')).not.toBeInTheDocument();
    });

    it('supports per-module review edit flow and returns directly to review on continue/back', () => {
        renderAdvancedWizard();

        advanceToReview();

        fireEvent.click(screen.getByTitle('Edit Mailbox & Access'));
        expect(screen.getByText('Mailbox & Access (1 of 2)')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /save & return to review/i })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /save & return to review/i }));
        expect(screen.getByText('Review & Submit')).toBeInTheDocument();

        fireEvent.click(screen.getByTitle('Edit Service Providers'));
        expect(screen.getByText('Service Providers (2 of 2)')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
        expect(screen.getByText('Review & Submit')).toBeInTheDocument();
    });

    it('skips advanced step when no advanced modules are enabled', () => {
        renderAdvancedWizard({ advanced_modules: [] });

        fireEvent.click(screen.getByRole('button', { name: /get started/i }));
        fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
        fireEvent.click(screen.getByRole('button', { name: "I don't know" }));

        expect(screen.getByText('Review & Submit')).toBeInTheDocument();
    });

    it('does not show advanced module selectors on Home Basics in simple mode', () => {
        renderSimpleWizard();

        fireEvent.click(screen.getByRole('button', { name: /get started/i }));

        expect(screen.queryByText(/transition detail modules/i)).not.toBeInTheDocument();
    });
});

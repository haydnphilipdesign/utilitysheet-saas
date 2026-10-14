import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SellerLayout } from '@/components/seller-form/SellerLayout';

const ADDRESS = '12 Synthetic Street, Faketown, PA 18301';

describe('SellerLayout header', () => {
    afterEach(() => cleanup());

    it('names the property for screen readers and keeps the full address available', () => {
        render(
            <SellerLayout progress={24} stepName="Electric Provider" stepNumber={2} stepTotal={12} completedCount={1} totalCount={3} address={ADDRESS} brandProfile={{ name: 'Synthetic Realty' }}>
                <div>Body</div>
            </SellerLayout>
        );
        expect(screen.getByRole('heading', { level: 1, name: 'Synthetic Realty' })).toBeInTheDocument();
        expect(screen.getByTestId('seller-header-address')).toHaveAttribute('title', ADDRESS);
        expect(screen.getByTestId('seller-header-address')).toHaveTextContent(`Property: ${ADDRESS}`);
        expect(screen.getByTestId('seller-header-address-wide')).toHaveAttribute('title', ADDRESS);
    });

    it('exposes progress as a progressbar and announces the step once', () => {
        render(
            <SellerLayout progress={24.4} stepName="Electric Provider" stepNumber={2} stepTotal={12} completedCount={1} totalCount={3} address={ADDRESS}>
                <div>Body</div>
            </SellerLayout>
        );
        const bar = screen.getByRole('progressbar', { name: 'Form progress' });
        expect(bar).toHaveAttribute('aria-valuenow', '24');
        expect(bar).toHaveAttribute('aria-valuetext', 'Electric Provider, step 2 of 12, 24% complete');
        expect(screen.getByTestId('seller-step-announcement')).toHaveAttribute('aria-live', 'polite');
        expect(screen.getByTestId('seller-step-announcement')).toHaveTextContent('Electric Provider, step 2 of 12');
        // One visible copy of the count, whatever the screen size.
        expect(screen.getAllByText('2 of 12')).toHaveLength(1);
    });

    it('leaves out progress on screens that are not a form step', () => {
        render(
            <SellerLayout progress={100} stepName="Submitted" showProgress={false} completedCount={0} totalCount={0} address={ADDRESS}>
                <div>Body</div>
            </SellerLayout>
        );
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        expect(screen.queryByText('100%')).not.toBeInTheDocument();
    });

    it('selects contrast-checked accent variables for text and fills', () => {
        const { container } = render(
            <SellerLayout progress={10} stepName="Welcome" completedCount={0} totalCount={0} brandProfile={{ name: 'Synthetic Realty', primary_color: '#facc15' }}>
                <div>Body</div>
            </SellerLayout>
        );
        const root = container.firstElementChild as HTMLElement;
        expect(root.style.getPropertyValue('--brand-accent')).toBe('#facc15');
        expect(root.style.getPropertyValue('--brand-accent-contrast')).toBe('#111827');
        expect(root.className).toContain('[--brand-accent-text:var(--brand-accent-ink)]');
        expect(root.className).toContain('dark:[--brand-accent-text:var(--brand-accent-ink-dark)]');
    });
});

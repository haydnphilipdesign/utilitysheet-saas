import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SellerLayout } from '@/components/seller-form/SellerLayout';

class MockResizeObserver {
    callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
    }

    observe() {
        this.callback([], this as unknown as ResizeObserver);
    }

    disconnect() {}
}

describe('SellerLayout dynamic header offset', () => {
    let mockHeight = 120;

    beforeEach(() => {
        mockHeight = 120;
        vi.stubGlobal('ResizeObserver', MockResizeObserver);
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
            x: 0,
            y: 0,
            width: 1000,
            height: mockHeight,
            top: 0,
            right: 1000,
            bottom: mockHeight,
            left: 0,
            toJSON: () => ({}),
        }));
    });

    afterEach(() => {
        vi.restoreAllMocks();
        cleanup();
    });

    it('sets main content top padding from measured header height and updates on resize', async () => {
        render(
            <SellerLayout
                progress={33}
                stepName="Electric Provider"
                completedCount={1}
                totalCount={3}
                address="123 Test Lane"
            >
                <div>Body Content</div>
            </SellerLayout>
        );

        const main = screen.getByText('Body Content').closest('main');
        expect(main).not.toBeNull();

        await waitFor(() => {
            expect(main).toHaveStyle('padding-top: 136px');
        });

        mockHeight = 176;
        act(() => {
            window.dispatchEvent(new Event('resize'));
        });

        await waitFor(() => {
            expect(main).toHaveStyle('padding-top: 192px');
        });
    });

    it('applies measured offset with or without address content', async () => {
        render(
            <SellerLayout
                progress={10}
                stepName="Welcome"
                completedCount={0}
                totalCount={3}
            >
                <div>No Address Body</div>
            </SellerLayout>
        );

        const withoutAddressMain = screen.getByText('No Address Body').closest('main');
        expect(withoutAddressMain).not.toBeNull();

        await waitFor(() => {
            expect(withoutAddressMain).toHaveStyle('padding-top: 136px');
        });

        cleanup();

        mockHeight = 164;
        render(
            <SellerLayout
                progress={10}
                stepName="Welcome"
                completedCount={0}
                totalCount={3}
                address="111 Main St"
            >
                <div>With Address Body</div>
            </SellerLayout>
        );

        const withAddressMain = screen.getByText('With Address Body').closest('main');
        expect(withAddressMain).not.toBeNull();

        await waitFor(() => {
            expect(withAddressMain).toHaveStyle('padding-top: 180px');
        });
    });
});

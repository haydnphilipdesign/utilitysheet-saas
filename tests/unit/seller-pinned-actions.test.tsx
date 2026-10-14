import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePinnedActions, wizardPinnedActions } from '@/components/seller-form/pinned-actions';
import { SellerLayout } from '@/components/seller-form/SellerLayout';
import { ReviewStep } from '@/components/seller-form/steps/ReviewStep';
import type { WizardState } from '@/components/seller-form/SellerWizard';

// JSDOM has no layout, so sticky positioning and measurements are covered by
// tests/seller-pinned-actions.spec.ts; this checks the state behind them.

function Step() {
    const pinned = usePinnedActions();
    return (
        <div>
            <input aria-label="Association Name" />
            <textarea aria-label="Notes" />
            <input type="checkbox" aria-label="Monday" />
            <div {...pinned} className={wizardPinnedActions} data-testid="actions">
                <button type="button">Continue</button>
            </div>
        </div>
    );
}

const state = {
    has_hoa: 'no', water_source: 'hoa', sewer_type: 'public', fuels_present: [], primary_heating_type: null,
    utilities: {}, advanced_module_exclusions: {}, no_trash_service: false,
} as unknown as WizardState;

function renderReview(props: Partial<React.ComponentProps<typeof ReviewStep>> = {}) {
    return render(
        <ReviewStep state={state} visibleUtilities={[]} onBack={() => {}} onEditBasics={() => {}} onSubmit={async () => {}} submitting={false} {...props} />
    );
}

describe('pinned step actions', () => {
    afterEach(() => cleanup());

    it('un-pins while a text field is focused and pins again for other controls', () => {
        render(<Step />);
        const actions = screen.getByTestId('actions');
        expect(actions).not.toHaveAttribute('data-typing');

        act(() => screen.getByLabelText('Association Name').focus());
        expect(actions).toHaveAttribute('data-typing');
        // Moving between text fields keeps it un-pinned.
        act(() => screen.getByLabelText('Notes').focus());
        expect(actions).toHaveAttribute('data-typing');

        act(() => screen.getByLabelText('Monday').focus());
        expect(actions).not.toHaveAttribute('data-typing');
        act(() => screen.getByLabelText('Notes').focus());
        act(() => screen.getByLabelText('Notes').blur());
        expect(actions).not.toHaveAttribute('data-typing');
    });

    it('waits for a press to finish before pinning again, so the tap that left the field still lands', () => {
        vi.useFakeTimers();
        try {
            render(<Step />);
            const actions = screen.getByTestId('actions');
            act(() => screen.getByLabelText('Association Name').focus());
            expect(actions).toHaveAttribute('data-typing');

            // Mouse press on another control: focus moves before the button is released.
            act(() => {
                document.dispatchEvent(new Event('pointerdown'));
                screen.getByLabelText('Monday').focus();
            });
            expect(actions).toHaveAttribute('data-typing');
            act(() => {
                document.dispatchEvent(new Event('pointerup'));
            });
            expect(actions).toHaveAttribute('data-typing');
            act(() => vi.runAllTimers());
            expect(actions).not.toHaveAttribute('data-typing');

            // Back to a text field before the release: stays un-pinned.
            act(() => screen.getByLabelText('Notes').focus());
            act(() => {
                document.dispatchEvent(new Event('pointerdown'));
                screen.getByLabelText('Monday').focus();
                document.dispatchEvent(new Event('pointerup'));
                screen.getByLabelText('Notes').focus();
                vi.runAllTimers();
            });
            expect(actions).toHaveAttribute('data-typing');
        } finally {
            vi.useRealTimers();
        }
    });

    it('applies the pinned styles only through the phone variant', () => {
        expect(wizardPinnedActions.split(' ').every((cls) => cls.startsWith('pinbar:'))).toBe(true);
        expect(wizardPinnedActions).toContain('pinbar:sticky');
        expect(wizardPinnedActions).toContain('pinbar:data-[typing]:static');
        expect(wizardPinnedActions).toContain('env(safe-area-inset-bottom)');
    });

    it('brings a submit error into view when it appears and when Review returns after sending', () => {
        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;
        const error = { kind: 'network' as const, message: 'Check your connection.' };

        const { rerender, unmount } = renderReview();
        expect(screen.getByTestId('review-actions')).toHaveClass('pinbar:sticky');
        expect(scrollIntoView).not.toHaveBeenCalled();
        rerender(<ReviewStep state={state} visibleUtilities={[]} onBack={() => {}} onEditBasics={() => {}} onSubmit={async () => {}} submitting={false} submitError={error} />);
        expect(scrollIntoView).toHaveBeenCalledTimes(1);
        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
        // Unrelated re-renders do not scroll again.
        rerender(<ReviewStep state={state} visibleUtilities={[]} onBack={() => {}} onEditBasics={() => {}} onSubmit={async () => {}} submitting={false} submitError={error} collectHoaQuestions={false} />);
        expect(scrollIntoView).toHaveBeenCalledTimes(1);
        unmount();

        // The wizard swaps Review for the sending screen, so a failure arrives with a fresh Review.
        renderReview({ submitError: error });
        expect(scrollIntoView).toHaveBeenCalledTimes(2);
        expect(screen.getByTestId('review-submit-error')).toBeInTheDocument();
    });

    it('shows the seller-form wording for an HOA-billed answer on Review', () => {
        renderReview();
        expect(screen.getByText('Paid by HOA')).toBeInTheDocument();
        expect(screen.queryByText('Included in HOA / Condo Fee')).not.toBeInTheDocument();
    });
});

describe('SellerLayout width and test banner', () => {
    afterEach(() => cleanup());

    it('widens the header and the content together on large screens only when asked', () => {
        const { container, rerender } = render(
            <SellerLayout progress={90} stepName="Review" completedCount={1} totalCount={1}><div>Body</div></SellerLayout>
        );
        const root = () => container.firstElementChild as HTMLElement;
        const column = 'lg:max-w-[var(--seller-column)]';
        expect(container.querySelector('header > div')).toHaveClass('max-w-2xl', column);
        expect(container.querySelector('main')).toHaveClass('max-w-2xl', column);
        expect(root().style.getPropertyValue('--seller-column')).toBe('42rem');
        rerender(<SellerLayout progress={90} stepName="Review" completedCount={1} totalCount={1} wide><div>Body</div></SellerLayout>);
        expect(root().style.getPropertyValue('--seller-column')).toBe('64rem');
    });

    it('keeps the test banner to one short sentence with Exit test on every size', () => {
        render(
            <SellerLayout progress={5} stepName="Welcome" completedCount={0} totalCount={1} isTestDrive><div>Body</div></SellerLayout>
        );
        const banner = screen.getByTestId('seller-test-drive-banner');
        expect(banner).toHaveTextContent('Test mode: use made-up answers.');
        expect(banner.querySelector('.hidden')).toBeNull();
        const exit = screen.getByRole('link', { name: 'Exit test' });
        expect(exit).toHaveAttribute('href', '/dashboard');
    });
});

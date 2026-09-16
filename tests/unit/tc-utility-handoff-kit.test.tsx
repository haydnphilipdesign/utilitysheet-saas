import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import TcUtilityHandoffKitPage from '@/app/(marketing)/tc-utility-handoff-kit/page';

describe('TC Utility Handoff Kit page', () => {
    it('publishes ungated templates and a tagged product path', () => {
        render(<TcUtilityHandoffKitPage />);

        expect(screen.getByRole('heading', { name: /tc utility handoff kit/i })).toBeInTheDocument();
        expect(screen.getByText(/never request account numbers/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /create your seller link/i })).toHaveAttribute(
            'href',
            '/auth/signup?utm_source=handoff-kit&utm_medium=resource&utm_campaign=90-day-tc-growth&utm_content=kit-cta'
        );
    });

    it('offers copyable emails for listing intake, listing-side closing prep, and buyer-side forwarding', () => {
        render(<TcUtilityHandoffKitPage />);

        for (const title of ['Listing welcome', 'Listing side, closing prep', 'Buyer side, via listing agent']) {
            expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: `Copy ${title} email` })).toBeInTheDocument();
        }

        expect(screen.getByText(/while we get your listing started/i)).toBeInTheDocument();
        expect(screen.getByText(/as we prepare for closing/i)).toBeInTheDocument();

        const buyerCard = screen.getByRole('heading', { name: 'Buyer side, via listing agent' }).closest('[data-slot="card"]');
        expect(buyerCard).not.toBeNull();
        const buyerBody = within(buyerCard as HTMLElement).getByText(/forward this short form to your seller/i);
        expect(buyerBody).toHaveTextContent('Hi [Listing Agent First Name],');
        expect(buyerBody).toHaveTextContent(/meant for the seller to complete/i);
    });
});

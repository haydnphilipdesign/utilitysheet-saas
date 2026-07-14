import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import TcUtilityHandoffKitPage from '@/app/(marketing)/tc-utility-handoff-kit/page';

describe('TC Utility Handoff Kit page', () => {
    it('publishes ungated templates and a tagged product path', () => {
        render(<TcUtilityHandoffKitPage />);

        expect(screen.getByRole('heading', { name: /tc utility handoff kit/i })).toBeInTheDocument();
        expect(screen.getByText('Hi [Seller First Name],')).toBeInTheDocument();
        expect(screen.getByText(/never request account numbers/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /create your seller link/i })).toHaveAttribute(
            'href',
            '/auth/signup?utm_source=handoff-kit&utm_medium=resource&utm_campaign=90-day-tc-growth&utm_content=kit-cta'
        );
    });
});

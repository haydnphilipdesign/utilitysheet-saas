import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FeedbackDialog } from '@/components/feedback-dialog';

describe('FeedbackDialog', () => {
    it('gives the icon-only trigger a clear accessible name', () => {
        render(<FeedbackDialog />);

        expect(screen.getByRole('button', { name: 'Send feedback' })).toHaveClass('min-h-11', 'min-w-11');
    });
});

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { NormaSuitePanel } from '@/components/norma-suite-panel';

beforeEach(() => {
    localStorage.clear();
});

describe('NormaSuitePanel', () => {
    it('lets users dismiss the dashboard strip persistently', async () => {
        render(<NormaSuitePanel />);

        expect(await screen.findByText('Part of Norma')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /dismiss part of norma banner/i }));

        await waitFor(() => {
            expect(screen.queryByText('Part of Norma')).not.toBeInTheDocument();
        });
        expect(localStorage.getItem('utilitysheet:norma-suite-strip-dismissed')).toBe('true');
    });

    it('keeps the dashboard strip hidden after it has been dismissed', async () => {
        localStorage.setItem('utilitysheet:norma-suite-strip-dismissed', 'true');

        render(<NormaSuitePanel />);

        await waitFor(() => {
            expect(screen.queryByText('Part of Norma')).not.toBeInTheDocument();
        });
    });
});

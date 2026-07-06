import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import UtilitySheetPdfPreview from '@/components/branding/UtilitySheetPdfPreview';
import { getPacketTitle } from '@/lib/branding/deliverable';
import { ADVANCED_MODULE_LABELS } from '@/lib/packet/modules';
import type { BrandProfileFormData } from '@/types';

vi.mock('next/image', () => ({
    default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
        // eslint-disable-next-line @next/next/no-img-element
        return <img {...props} alt={props.alt || ''} />;
    },
}));

const baseBranding: BrandProfileFormData = {
    name: 'Acme Realty',
    primary_color: '#2563eb',
    secondary_color: '#1e40af',
    is_default: true,
};

describe('UtilitySheetPdfPreview mode awareness', () => {
    it('shows the simple title and no mode toggle for Free accounts', () => {
        render(<UtilitySheetPdfPreview branding={baseBranding} isPro={false} />);

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(getPacketTitle('simple'));
        expect(screen.queryByRole('button', { name: 'Advanced' })).not.toBeInTheDocument();
        expect(screen.getByText('Home Basics')).toBeInTheDocument();
    });

    it('ignores an advanced defaultMode for Free accounts', () => {
        render(<UtilitySheetPdfPreview branding={baseBranding} isPro={false} defaultMode="advanced" />);

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(getPacketTitle('simple'));
        expect(screen.queryByRole('button', { name: 'Advanced' })).not.toBeInTheDocument();
    });

    it('exposes a Simple/Advanced toggle for Pro accounts and defaults to simple', () => {
        render(<UtilitySheetPdfPreview branding={baseBranding} isPro />);

        expect(screen.getByRole('button', { name: 'Simple' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Advanced' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(getPacketTitle('simple'));
    });

    it('switches to the advanced title and sample advanced sections when toggled', () => {
        render(<UtilitySheetPdfPreview branding={baseBranding} isPro />);

        fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(getPacketTitle('advanced'));
        // A representative advanced section renders with canonical module titles.
        expect(screen.getByText(ADVANCED_MODULE_LABELS.service_providers)).toBeInTheDocument();
        // Advanced deliverables omit Home Basics.
        expect(screen.queryByText('Home Basics')).not.toBeInTheDocument();
    });

    it('seeds the initial mode from defaultMode for Pro accounts', () => {
        render(<UtilitySheetPdfPreview branding={baseBranding} isPro defaultMode="advanced" />);

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(getPacketTitle('advanced'));
        expect(screen.getByText(ADVANCED_MODULE_LABELS.service_providers)).toBeInTheDocument();
    });
});

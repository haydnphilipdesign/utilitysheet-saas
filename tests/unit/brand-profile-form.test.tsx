import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { routerBackMock, generateTestPdfMock } = vi.hoisted(() => ({
    routerBackMock: vi.fn(),
    generateTestPdfMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ back: routerBackMock, push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('next/image', () => ({
    default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
        // eslint-disable-next-line @next/next/no-img-element
        return <img {...props} alt={props.alt || ''} />;
    },
}));

vi.mock('@/lib/test-pdf-generator', () => ({
    generateTestPdf: generateTestPdfMock,
}));

import BrandProfileForm from '@/components/branding/BrandProfileForm';
import { DEFAULT_BUYER_STEPS } from '@/lib/constants';
import type { BrandProfileFormData } from '@/types';

const savedProfile: BrandProfileFormData = {
    name: 'Acme Realty',
    logo_url: 'https://example.com/logo.png',
    primary_color: '#2563eb',
    secondary_color: '#059669',
    contact_name: 'Jane Smith',
    is_default: false,
    buyer_next_steps: ['Custom step one', 'Custom step two'],
    next_steps_title: 'Move-In Checklist',
    show_powered_by: true,
    show_generation_date: true,
    message_templates: {},
};

function lastSubmitted(onSubmit: ReturnType<typeof vi.fn>): BrandProfileFormData {
    return onSubmit.mock.calls.at(-1)?.[0] as BrandProfileFormData;
}

/** Buyer steps and display options live in the PDF Content tab. */
function openPdfContentTab() {
    fireEvent.click(screen.getByRole('tab', { name: /pdf content/i }));
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('BrandProfileForm clear/reset persistence', () => {
    it('submits logo_url as explicit null after Remove so the API clears it', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        render(<BrandProfileForm initialData={savedProfile} onSubmit={onSubmit} isEditing isPro />);

        fireEvent.click(screen.getByRole('button', { name: /remove/i }));
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());
        expect(lastSubmitted(onSubmit).logo_url).toBeNull();
    });

    it('submits buyer_next_steps as explicit null after resetting to the standard steps', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        render(<BrandProfileForm initialData={savedProfile} onSubmit={onSubmit} isEditing isPro />);

        openPdfContentTab();
        fireEvent.click(screen.getByRole('button', { name: /use standard steps/i }));
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());
        const submitted = lastSubmitted(onSubmit);
        expect(submitted.buyer_next_steps).toBeNull();
        expect(submitted.next_steps_title).toBe('');
    });

    it('drops blank steps on submit and falls back to defaults when all are blank', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        render(
            <BrandProfileForm
                initialData={{ ...savedProfile, buyer_next_steps: ['Keep me', '   '] }}
                onSubmit={onSubmit}
                isEditing
                isPro
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /remove/i })); // dirty the form
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());
        expect(lastSubmitted(onSubmit).buyer_next_steps).toEqual(['Keep me']);
    });
});

describe('BrandProfileForm buyer-steps default/custom state', () => {
    it('shows the standard steps read-only when no custom list is saved', () => {
        render(
            <BrandProfileForm
                initialData={{ ...savedProfile, buyer_next_steps: null, next_steps_title: '' }}
                onSubmit={vi.fn()}
                isEditing
                isPro
            />
        );

        openPdfContentTab();
        expect(screen.getByText('Using the standard steps:')).toBeInTheDocument();
        expect(screen.getByText(DEFAULT_BUYER_STEPS[0])).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /customize steps/i })).toBeEnabled();
        expect(screen.queryByRole('button', { name: /add step/i })).not.toBeInTheDocument();
    });

    it('switches to an editable list seeded with the standard steps on customize', () => {
        render(
            <BrandProfileForm
                initialData={{ ...savedProfile, buyer_next_steps: null, next_steps_title: '' }}
                onSubmit={vi.fn()}
                isEditing
                isPro
            />
        );

        openPdfContentTab();
        fireEvent.click(screen.getByRole('button', { name: /customize steps/i }));

        expect(screen.getByRole('button', { name: /add step/i })).toBeInTheDocument();
        expect(screen.getByLabelText('Step 1')).toHaveValue(DEFAULT_BUYER_STEPS[0]);
    });

    it('disables customization for Free accounts', () => {
        render(
            <BrandProfileForm
                initialData={{ ...savedProfile, buyer_next_steps: null }}
                onSubmit={vi.fn()}
                isEditing
                isPro={false}
            />
        );

        openPdfContentTab();
        expect(screen.getByRole('button', { name: /customize steps/i })).toBeDisabled();
    });
});

describe('BrandProfileForm validation and save state', () => {
    it('disables save until the form is dirty and enables it after a change', () => {
        render(<BrandProfileForm initialData={savedProfile} onSubmit={vi.fn()} isEditing isPro />);

        const saveButton = screen.getByRole('button', { name: /save changes/i });
        expect(saveButton).toBeDisabled();

        fireEvent.change(screen.getByLabelText(/brand name/i), { target: { value: 'New Name' } });
        expect(saveButton).toBeEnabled();
        expect(screen.getByText('Unsaved changes. The preview already reflects them.')).toBeInTheDocument();
    });

    it('blocks save and shows an error for an empty brand name', () => {
        render(<BrandProfileForm initialData={savedProfile} onSubmit={vi.fn()} isEditing isPro />);

        const nameInput = screen.getByLabelText(/brand name/i);
        fireEvent.change(nameInput, { target: { value: '   ' } });
        fireEvent.blur(nameInput);

        expect(screen.getByRole('alert')).toHaveTextContent('Brand name is required.');
        expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    });

    it('blocks save for an invalid primary color', () => {
        render(<BrandProfileForm initialData={savedProfile} onSubmit={vi.fn()} isEditing isPro />);

        fireEvent.change(screen.getByLabelText('Primary color hex value'), { target: { value: 'blue' } });

        expect(screen.getByRole('alert')).toHaveTextContent(/hex color/i);
        expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    });
});

describe('BrandProfileForm information architecture', () => {
    it('groups the editor into Brand, PDF Content, and Messages tabs', () => {
        render(<BrandProfileForm initialData={savedProfile} onSubmit={vi.fn()} isEditing isPro />);

        expect(screen.getByRole('tab', { name: /brand/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /pdf content/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /messages/i })).toBeInTheDocument();
    });

    it('keeps message templates profile-scoped inside the Messages tab with the email-only secondary color', async () => {
        render(<BrandProfileForm initialData={savedProfile} onSubmit={vi.fn()} isEditing isPro />);

        fireEvent.click(screen.getByRole('tab', { name: /messages/i }));

        expect(await screen.findByText(/request message templates/i)).toBeInTheDocument();
        expect(screen.getByText(/used in branded emails sent to sellers/i)).toBeInTheDocument();
        expect(screen.getByText(/these never\s+appear on the pdf/i)).toBeInTheDocument();
    });

    it('shows the ownership scope when provided', () => {
        render(
            <BrandProfileForm
                initialData={savedProfile}
                onSubmit={vi.fn()}
                isEditing
                isPro
                scopeLabel="Team profile · Acme Realty"
            />
        );

        expect(screen.getByText('Team profile · Acme Realty')).toBeInTheDocument();
    });

    it('marks the default-profile toggle Pro-only for Free accounts', () => {
        render(<BrandProfileForm initialData={savedProfile} onSubmit={vi.fn()} isEditing isPro={false} />);

        // Base UI renders a disabled switch as a span with aria-disabled.
        expect(screen.getByRole('switch', { name: /default profile/i })).toHaveAttribute('aria-disabled', 'true');
    });
});

describe('BrandProfileForm test PDF', () => {
    it('downloads the test PDF using the previewed mode', async () => {
        generateTestPdfMock.mockResolvedValue(undefined);
        render(<BrandProfileForm initialData={savedProfile} onSubmit={vi.fn()} isEditing isPro />);

        fireEvent.click(screen.getAllByRole('button', { name: 'Advanced' })[0]);
        fireEvent.click(screen.getAllByRole('button', { name: /download test pdf/i })[0]);

        await waitFor(() => expect(generateTestPdfMock).toHaveBeenCalled());
        expect(generateTestPdfMock.mock.calls[0][1]).toBe('advanced');
    });

    it('always requests the Simple sheet for Free accounts', async () => {
        generateTestPdfMock.mockResolvedValue(undefined);
        render(<BrandProfileForm initialData={savedProfile} onSubmit={vi.fn()} isEditing isPro={false} />);

        fireEvent.click(screen.getAllByRole('button', { name: /download test pdf/i })[0]);

        await waitFor(() => expect(generateTestPdfMock).toHaveBeenCalled());
        expect(generateTestPdfMock.mock.calls[0][1]).toBe('simple');
    });
});

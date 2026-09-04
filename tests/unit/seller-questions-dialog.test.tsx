import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SellerQuestionsDialog } from '@/components/seller-questions/SellerQuestionsDialog';
import { ADVANCED_MODULE_KEYS } from '@/lib/packet/modules';
import type { SellerQuestionConfiguration } from '@/lib/packet/seller-questions';

const SIMPLE_FREE_CONFIG: SellerQuestionConfiguration = {
    packetMode: 'simple',
    utilityCategories: ['electric', 'water', 'trash'],
    advancedModules: [...ADVANCED_MODULE_KEYS],
    advancedModuleExclusions: {},
};

const HANDOFF_CONFIG: SellerQuestionConfiguration = {
    packetMode: 'advanced',
    utilityCategories: ['electric'],
    advancedModules: [...ADVANCED_MODULE_KEYS],
    advancedModuleExclusions: { mailbox_access: ['garage_door_code'] },
};

function openDialog(configuration: SellerQuestionConfiguration) {
    render(<SellerQuestionsDialog configuration={configuration} />);
    fireEvent.click(screen.getByRole('button', { name: /preview seller questions/i }));
}

function openInventoryTab() {
    fireEvent.click(screen.getByRole('tab', { name: 'All questions' }));
}

describe('SellerQuestionsDialog', () => {
    it('opens from a trigger available in Simple mode', () => {
        openDialog(SIMPLE_FREE_CONFIG);

        expect(screen.getByRole('heading', { name: 'Seller questions' })).toBeInTheDocument();
        expect(screen.getByText(/Simple Utility Sheet/)).toBeInTheDocument();
    });

    it('previews only the configured utility sections in Simple mode', () => {
        openDialog(SIMPLE_FREE_CONFIG);
        const preview = screen.getByRole('tabpanel');

        expect(within(preview).getByRole('heading', { name: 'Home Basics' })).toBeInTheDocument();
        expect(within(preview).getByRole('heading', { name: 'Electric' })).toBeInTheDocument();
        expect(within(preview).getByRole('heading', { name: 'Water' })).toBeInTheDocument();
        expect(within(preview).queryByRole('heading', { name: 'Internet' })).not.toBeInTheDocument();
        expect(within(preview).queryByRole('heading', { name: 'Mailbox & Home Access' })).not.toBeInTheDocument();
    });

    it('previews handoff sections and omits excluded questions in Property Handoff Packet mode', () => {
        openDialog(HANDOFF_CONFIG);
        const preview = screen.getByRole('tabpanel');

        expect(within(preview).getByRole('heading', { name: 'Mailbox & Home Access' })).toBeInTheDocument();
        expect(within(preview).queryByText('Garage Door Code')).not.toBeInTheDocument();
        expect(within(preview).getByText('Mailbox Location')).toBeInTheDocument();
    });

    it('states that a seller only reaches sections that apply', () => {
        openDialog(SIMPLE_FREE_CONFIG);

        expect(
            screen.getByText(/Sellers only reach a section when it applies to their home/i)
        ).toBeInTheDocument();
    });

    it('shows the visibility condition on each previewed utility section', () => {
        openDialog(SIMPLE_FREE_CONFIG);
        const preview = screen.getByRole('tabpanel');

        expect(within(preview).getByText(/Always asked, on every seller form/i)).toBeInTheDocument();
        expect(
            within(preview).getByText(/Asked when the seller answers Public Water on Home Basics/i)
        ).toBeInTheDocument();
        expect(
            within(preview).getByText(/Asked when the seller confirms the home has Trash & Recycling/i)
        ).toBeInTheDocument();
    });

    it('lists every built-in question on the inventory tab, even in Simple mode', () => {
        openDialog(SIMPLE_FREE_CONFIG);
        openInventoryTab();
        const inventory = screen.getByRole('tabpanel');

        expect(within(inventory).getByText(/built-in questions/)).toBeInTheDocument();
        expect(within(inventory).getByText('Garage Door Code')).toBeInTheDocument();
        expect(within(inventory).getByText('Pool Service Provider')).toBeInTheDocument();
        expect(within(inventory).getByRole('heading', { name: 'Cable/TV' })).toBeInTheDocument();
    });

    it('marks handoff questions as not included while the form is in Simple mode', () => {
        openDialog(SIMPLE_FREE_CONFIG);
        openInventoryTab();
        const inventory = screen.getByRole('tabpanel');
        const garageRow = within(inventory).getByText('Garage Door Code').closest('li');

        expect(garageRow).not.toBeNull();
        expect(within(garageRow as HTMLElement).getByText('Not included')).toBeInTheDocument();
    });

    it('marks an excluded question as not included and a kept one as included', () => {
        openDialog(HANDOFF_CONFIG);
        openInventoryTab();
        const inventory = screen.getByRole('tabpanel');

        const garageRow = within(inventory).getByText('Garage Door Code').closest('li') as HTMLElement;
        const mailboxRow = within(inventory).getByText('Mailbox Location').closest('li') as HTMLElement;

        expect(within(garageRow).getByText('Not included')).toBeInTheDocument();
        expect(within(mailboxRow).getByText('Included')).toBeInTheDocument();
    });

    it('filters the inventory by search term', () => {
        openDialog(SIMPLE_FREE_CONFIG);
        openInventoryTab();

        fireEvent.change(screen.getByRole('textbox', { name: /search all built-in seller questions/i }), {
            target: { value: 'mailbox' },
        });

        const inventory = screen.getByRole('tabpanel');
        expect(within(inventory).getByText('Mailbox Location')).toBeInTheDocument();
        expect(within(inventory).queryByText('Pool Service Provider')).not.toBeInTheDocument();
    });

    it('tells the user when nothing matches a search', () => {
        openDialog(SIMPLE_FREE_CONFIG);
        openInventoryTab();

        fireEvent.change(screen.getByRole('textbox', { name: /search all built-in seller questions/i }), {
            target: { value: 'front door code' },
        });

        expect(screen.getByText(/No built-in question matches that search/i)).toBeInTheDocument();
    });
});

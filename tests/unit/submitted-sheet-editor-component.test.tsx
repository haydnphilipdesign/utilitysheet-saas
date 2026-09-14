import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    router: { push: vi.fn() },
    generatePacketPdf: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('next/navigation', () => ({ useRouter: () => mocks.router }));
vi.mock('@/lib/pdf-generator', () => ({ generatePacketPdf: mocks.generatePacketPdf }));
vi.mock('sonner', () => ({ toast: mocks.toast }));

import { SubmittedSheetEditor } from '@/components/requests/SubmittedSheetEditor';
import {
    buildSubmittedSheetEditorPayload,
    buildSubmittedSheetUtilityInsertRows,
    type SubmittedSheetEditableRequestRecord,
} from '@/lib/submitted-sheet/editor';
import type { SubmittedSheetEditableUtilities, UtilityEntry } from '@/types';

function entry(fields: Partial<UtilityEntry> & Pick<UtilityEntry, 'category'>): UtilityEntry {
    return {
        id: `entry_${fields.category}`,
        request_id: 'req_1',
        entry_mode: 'free_text',
        display_name: null,
        raw_text: null,
        meter_number: null,
        canonical_id: null,
        confidence_score: null,
        contact_phone: null,
        contact_url: null,
        extra: {},
        created_at: '',
        updated_at: '',
        ...fields,
    };
}

let request: SubmittedSheetEditableRequestRecord;
let rows: UtilityEntry[];
let patchBodies: Array<Record<string, unknown>>;

function payload() {
    return buildSubmittedSheetEditorPayload({ requestData: request, utilityEntries: rows, collectElectricMeterNumber: true });
}

function jsonResponse(body: unknown, status = 200) {
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    patchBodies = [];
    request = {
        id: 'req_1',
        public_token: 'token_1',
        account_id: 'acct_1',
        property_address: '1418 Briarcliff Road, Charlotte, NC 28207',
        seller_name: 'Morgan Avery',
        closing_date: '2026-10-15',
        status: 'submitted',
        updated_at: '2026-09-01T14:00:00.000Z',
        packet_mode: 'simple',
        utility_categories: ['electric', 'gas', 'trash', 'internet'],
        water_source: 'city',
        sewer_type: 'public',
        heating_type: 'not_sure',
    } as unknown as SubmittedSheetEditableRequestRecord;
    rows = [
        entry({ category: 'electric', display_name: 'Duke Energy', raw_text: 'Duke Energy' }),
        entry({ category: 'gas', entry_mode: 'unknown' }),
        entry({ category: 'trash', entry_mode: 'unknown', extra: { trash_pickup_days: ['tue'], trash_pickup_day: 'tue' } }),
    ];

    global.fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
            const body = JSON.parse(String(init.body));
            patchBodies.push(body);
            rows = buildSubmittedSheetUtilityInsertRows(body.utilities as SubmittedSheetEditableUtilities).map((row) => entry(row));
            request = {
                ...request,
                property_address: body.propertyAddress,
                water_source: body.homeBasics.waterSource,
                sewer_type: body.homeBasics.sewerType,
                heating_type: body.homeBasics.heatingType,
                updated_at: '2026-09-14T12:00:00.000Z',
            };
        }
        return jsonResponse(payload());
    }) as typeof fetch;
});

async function renderEditor() {
    render(<SubmittedSheetEditor requestId="req_1" />);
    await screen.findByRole('heading', { name: 'Edit Info Sheet' });
}

const card = (category: string) => within(screen.getByTestId(`utility-card-${category}`));

describe('SubmittedSheetEditor', () => {
    it('labels and summarizes seller "Not sure" answers instead of showing blank fields', async () => {
        await renderEditor();

        expect(card('gas').getByRole('radio', { name: 'Not sure' })).toBeChecked();
        expect(card('trash').getByRole('radio', { name: 'Not sure' })).toBeChecked();
        expect(card('internet').getByRole('radio', { name: 'Leave off sheet' })).toBeChecked();
        expect(card('electric').getByLabelText('Provider name')).toHaveValue('Duke Energy');

        const summary = within(screen.getByTestId('not-sure-summary'));
        expect(summary.getByText('3 answers print as “Not sure.”')).toBeInTheDocument();
        for (const label of ['Natural Gas', 'Trash & Recycling', 'Heating type']) {
            expect(summary.getByRole('button', { name: label })).toBeInTheDocument();
        }
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    });

    it('requires a provider name before saving a replaced "Not sure" answer', async () => {
        await renderEditor();

        fireEvent.click(card('trash').getByRole('radio', { name: 'Provider' }));
        const nameInput = card('trash').getByLabelText('Provider name');
        await waitFor(() => expect(nameInput).toHaveFocus());

        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        expect(await screen.findByText('Enter the provider name, or choose Not sure.')).toBeInTheDocument();
        expect(nameInput).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByRole('status')).toHaveTextContent('Fix the highlighted fields to save.');
        expect(patchBodies).toHaveLength(0);
    });

    it('saves a replaced provider, a removed utility, and a corrected home basic', async () => {
        await renderEditor();

        fireEvent.click(card('trash').getByRole('radio', { name: 'Provider' }));
        fireEvent.change(card('trash').getByLabelText('Provider name'), { target: { value: 'Republic Services' } });
        fireEvent.click(card('gas').getByRole('radio', { name: 'Leave off sheet' }));
        fireEvent.change(screen.getByLabelText('Heating type'), { target: { value: 'natural_gas' } });

        expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes');
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        await screen.findByText('All changes saved');
        const [body] = patchBodies as Array<{ utilities: SubmittedSheetEditableUtilities; homeBasics: unknown }>;
        expect(body.utilities.trash).toMatchObject({ status: 'provider', providerName: 'Republic Services' });
        expect(body.utilities.gas?.status).toBe('not_included');
        expect(body.homeBasics).toEqual({ waterSource: 'city', sewerType: 'public', heatingType: 'natural_gas' });

        expect(card('trash').getByRole('radio', { name: 'Provider' })).toBeChecked();
        expect(card('trash').getByLabelText('Provider name')).toHaveValue('Republic Services');
        expect(card('gas').getByRole('radio', { name: 'Leave off sheet' })).toBeChecked();
        expect(screen.queryByTestId('not-sure-summary')).not.toBeInTheDocument();
    });

    it('asks before discarding unsaved changes', async () => {
        await renderEditor();

        fireEvent.change(screen.getByLabelText('Property address'), { target: { value: '1418 Briarcliff Rd, Charlotte, NC 28207' } });
        fireEvent.click(screen.getByRole('button', { name: 'Back to request' }));

        expect(await screen.findByText('Discard unsaved changes?')).toBeInTheDocument();
        expect(mocks.router.push).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
        expect(mocks.router.push).toHaveBeenCalledWith('/dashboard/requests/req_1');
    });

    it('saves unsaved changes before downloading the PDF', async () => {
        await renderEditor();

        fireEvent.change(screen.getByLabelText('Property address'), { target: { value: '1418 Briarcliff Rd, Charlotte, NC 28207' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save & download PDF' }));

        await waitFor(() => expect(mocks.generatePacketPdf).toHaveBeenCalledWith('token_1'));
        expect(patchBodies).toHaveLength(1);
        expect(patchBodies[0].propertyAddress).toBe('1418 Briarcliff Rd, Charlotte, NC 28207');
    });

    it('keeps edits and explains when a save fails', async () => {
        await renderEditor();
        const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
        fetchMock.mockImplementationOnce(async () => jsonResponse({ error: 'Failed to update submitted sheet data' }, 500));

        fireEvent.change(screen.getByLabelText('Property address'), { target: { value: '1418 Briarcliff Rd, Charlotte, NC 28207' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        expect(await screen.findByText('Changes not saved yet. Try saving again.')).toBeInTheDocument();
        expect(screen.getByLabelText('Property address')).toHaveValue('1418 Briarcliff Rd, Charlotte, NC 28207');
        // Save feedback lives in the save bar; a toast would cover the sticky Save button on phones.
        expect(mocks.toast.error).not.toHaveBeenCalled();
    });
});

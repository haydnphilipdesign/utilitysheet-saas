import { fireEvent, render, screen, within } from '@testing-library/react';
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
import { normalizeHoaAnswers } from '@/lib/packet/hoa';
import {
    buildSubmittedSheetEditorPayload,
    type SubmittedSheetEditableRequestRecord,
} from '@/lib/submitted-sheet/editor';
import type { HoaAnswers } from '@/types';

let request: SubmittedSheetEditableRequestRecord;
let patchBodies: Array<{ hoa?: HoaAnswers }>;

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
        status: 'submitted',
        updated_at: '2026-10-01T14:00:00.000Z',
        packet_mode: 'simple',
        utility_categories: ['electric'],
        water_source: 'city',
        sewer_type: 'public',
        heating_type: 'electric',
        has_hoa: 'yes',
        hoa_name: 'Lakeview Commons HOA',
        hoa_management_phone: '(555) 204-8890',
        hoa_dues_amount: '$240',
        hoa_dues_frequency: 'quarterly',
    } as unknown as SubmittedSheetEditableRequestRecord;

    global.fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
            const body = JSON.parse(String(init.body));
            patchBodies.push(body);
            // Mirrors the route: stored answers are the normalized ones.
            request = { ...request, ...normalizeHoaAnswers(body.hoa), updated_at: '2026-10-01T15:00:00.000Z' };
        }
        return jsonResponse(buildSubmittedSheetEditorPayload({
            requestData: request,
            utilityEntries: [],
            collectElectricMeterNumber: false,
        }));
    }) as typeof fetch;
});

async function renderEditor() {
    render(<SubmittedSheetEditor requestId="req_1" />);
    await screen.findByRole('heading', { name: 'Edit sheet' });
    return within(screen.getByTestId('hoa-card'));
}

describe('SubmittedSheetEditor HOA answers', () => {
    it('shows the seller’s association answers for editing', async () => {
        const hoa = await renderEditor();

        expect(hoa.getByLabelText('Part of an HOA or condo association')).toHaveValue('yes');
        expect(hoa.getByLabelText('Association name')).toHaveValue('Lakeview Commons HOA');
        expect(hoa.getByLabelText('Contact phone')).toHaveValue('(555) 204-8890');
        expect(hoa.getByLabelText('Dues amount')).toHaveValue('$240');
        expect(hoa.getByLabelText('Dues billed')).toHaveValue('quarterly');
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    });

    it('saves a corrected association detail', async () => {
        const hoa = await renderEditor();

        fireEvent.change(hoa.getByLabelText('Contact email'), { target: { value: 'office@lakeview.example' } });
        fireEvent.change(hoa.getByLabelText('Dues billed'), { target: { value: 'monthly' } });
        expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes');

        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        await screen.findByText('All changes saved');

        expect(patchBodies[0].hoa).toMatchObject({
            has_hoa: 'yes',
            hoa_name: 'Lakeview Commons HOA',
            hoa_management_email: 'office@lakeview.example',
            hoa_dues_frequency: 'monthly',
        });
        expect(hoa.getByLabelText('Contact email')).toHaveValue('office@lakeview.example');
    });

    it('hides the details for a No and tells the coordinator they are not kept', async () => {
        const hoa = await renderEditor();

        fireEvent.change(hoa.getByLabelText('Part of an HOA or condo association'), { target: { value: 'no' } });

        expect(hoa.queryByLabelText('Association name')).not.toBeInTheDocument();
        expect(hoa.getByText(/only kept when this is set to Yes/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        await screen.findByText('All changes saved');

        expect(patchBodies[0].hoa?.has_hoa).toBe('no');
        expect(request.has_hoa).toBe('no');
        expect(request.hoa_name).toBeNull();
    });

    it('lists a Not sure answer with the other answers that print as Not sure', async () => {
        request = { ...request, has_hoa: 'not_sure' } as SubmittedSheetEditableRequestRecord;
        await renderEditor();

        const summary = within(screen.getByTestId('not-sure-summary'));
        expect(summary.getByRole('button', { name: 'HOA / condo association' })).toBeInTheDocument();
    });

    it('warns against passwords on the field that prints on the sheet', async () => {
        const hoa = await renderEditor();

        expect(hoa.getByLabelText('Payments and documents')).toHaveAccessibleDescription(/passwords or account numbers/i);
    });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

// End-to-end data path for submitted-sheet edits without a database: the real editor
// route saves into an in-memory request, then the real packet data builder and PDF HTML
// builder read it back, the same way the web packet and PDF downloads do.

const mocks = vi.hoisted(() => ({
    getUserMock: vi.fn(),
    getOrCreateAccountMock: vi.fn(),
    getAccountByIdMock: vi.fn(),
    getOrganizationByIdMock: vi.fn(),
    getRequestByIdMock: vi.fn(),
    getUtilityEntriesByRequestIdMock: vi.fn(),
    updateSubmittedRequestDataMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/stack/server', () => ({ stackServerApp: { getUser: mocks.getUserMock } }));
vi.mock('@/lib/neon/queries', () => ({
    getOrCreateAccount: mocks.getOrCreateAccountMock,
    getAccountById: mocks.getAccountByIdMock,
    getOrganizationById: mocks.getOrganizationByIdMock,
    getRequestById: mocks.getRequestByIdMock,
    getRequestByToken: vi.fn(),
    getUtilityEntriesByRequestId: mocks.getUtilityEntriesByRequestIdMock,
    updateSubmittedRequestData: mocks.updateSubmittedRequestDataMock,
    getBrandProfile: vi.fn().mockResolvedValue(null),
    getDefaultBrandProfile: vi.fn().mockResolvedValue(null),
    getIntakeLinkByAccountId: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/address/structured-address', () => ({ buildStructuredPropertyAddress: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/network/client-ip', () => ({ getClientIpOrNull: () => '127.0.0.1' }));

import { GET, PATCH } from '@/app/api/requests/[id]/submitted-data/route';
import { getPacketDataByRequestId } from '@/lib/packet/packet-data';
import { buildPacketPdfHtml } from '@/lib/pdf/packet-html';
import type { SubmittedSheetEditorPayload, UtilityEntry } from '@/types';

type StoredRequest = Record<string, unknown> & { updated_at: string };

let storedRequest: StoredRequest;
let storedRows: UtilityEntry[];

function row(fields: Partial<UtilityEntry> & Pick<UtilityEntry, 'category'>): UtilityEntry {
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

const params = { params: Promise.resolve({ id: 'req_1' }) };

async function openEditor(): Promise<SubmittedSheetEditorPayload> {
    const response = await GET(new Request('http://localhost/api/requests/req_1/submitted-data'), params);
    expect(response.status).toBe(200);
    return response.json();
}

async function save(editor: SubmittedSheetEditorPayload, changes: Partial<{ propertyAddress: string; homeBasics: unknown; utilities: unknown }>) {
    const response = await PATCH(new Request('http://localhost/api/requests/req_1/submitted-data', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            updatedAt: editor.request.updatedAt,
            propertyAddress: editor.request.propertyAddress,
            homeBasics: {
                waterSource: editor.request.waterSource,
                sewerType: editor.request.sewerType,
                heatingType: editor.request.heatingType,
            },
            utilities: editor.editor.utilities,
            advanced: {},
            ...changes,
        }),
    }), params);
    expect(response.status).toBe(200);
    return response.json() as Promise<SubmittedSheetEditorPayload>;
}

async function renderOutput() {
    const packet = await getPacketDataByRequestId('req_1');
    if (packet.status !== 'ok') throw new Error(`packet status ${packet.status}`);
    return { packet: packet.data, html: buildPacketPdfHtml(packet.data).html };
}

describe('submitted sheet edit pipeline', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        const account = { id: 'acct_1', subscription_status: 'pro', active_organization_id: null, notification_preferences: {} };
        mocks.getUserMock.mockResolvedValue({ id: 'user_1', primaryEmail: 'agent@example.com', displayName: 'Agent' });
        mocks.getOrCreateAccountMock.mockResolvedValue(account);
        mocks.getAccountByIdMock.mockResolvedValue(account);
        mocks.getOrganizationByIdMock.mockResolvedValue(null);

        storedRequest = {
            id: 'req_1',
            account_id: 'acct_1',
            organization_id: null,
            public_token: 'token_1',
            property_address: '1418 Briarcliff Road, Charlotte, NC 28207',
            created_at: '2026-09-01T14:00:00.000Z',
            status: 'submitted',
            updated_at: '2026-09-01T14:00:00.000Z',
            packet_mode: 'simple',
            utility_categories: ['electric', 'gas', 'trash', 'internet'],
            water_source: 'city',
            sewer_type: 'public',
            heating_type: 'not_sure',
        };
        storedRows = [
            row({ category: 'electric', display_name: 'Duke Energy', raw_text: 'Duke Energy' }),
            row({ category: 'gas', entry_mode: 'unknown' }),
            row({
                category: 'trash',
                entry_mode: 'unknown',
                extra: { has_recycling: 'yes', trash_pickup_days: ['tue'], trash_pickup_day: 'tue' },
            }),
        ];

        mocks.getRequestByIdMock.mockImplementation(async () => ({ ...storedRequest }));
        mocks.getUtilityEntriesByRequestIdMock.mockImplementation(async () => storedRows.map((entry) => ({ ...entry })));
        mocks.updateSubmittedRequestDataMock.mockImplementation(async (_id: string, data: {
            expectedUpdatedAt: string;
            propertyAddress: string;
            homeBasics?: { waterSource: string | null; sewerType: string | null; heatingType: string | null } | null;
            utilityEntries: Array<Partial<UtilityEntry> & Pick<UtilityEntry, 'category'>>;
        }) => {
            if (data.expectedUpdatedAt !== storedRequest.updated_at) return null;
            storedRows = data.utilityEntries.map((entry) => row(entry));
            storedRequest = {
                ...storedRequest,
                property_address: data.propertyAddress,
                updated_at: new Date(Date.parse(storedRequest.updated_at) + 60_000).toISOString(),
                ...(data.homeBasics ? {
                    water_source: data.homeBasics.waterSource,
                    sewer_type: data.homeBasics.sewerType,
                    heating_type: data.homeBasics.heatingType,
                } : {}),
            };
            return { ...storedRequest };
        });
    });

    it('keeps "Not sure" answers on the packet and PDF when an unrelated field is saved', async () => {
        const editor = await openEditor();
        expect(editor.editor.utilities.gas?.status).toBe('not_sure');

        await save(editor, { propertyAddress: '1418 Briarcliff Rd, Charlotte, NC 28207' });

        const { packet, html } = await renderOutput();
        expect(packet.utilities.map((utility) => [utility.category, utility.provider_name])).toEqual([
            ['electric', 'Duke Energy'],
            ['gas', 'Not sure'],
            ['trash', 'Not sure'],
        ]);
        expect(html).toContain('1418 Briarcliff Rd, Charlotte, NC 28207');
    });

    it('replaces a trash "Not sure" provider, removes gas, and clears a home basic across reopen, packet, and PDF', async () => {
        const editor = await openEditor();
        const utilities = editor.editor.utilities;

        await save(editor, {
            homeBasics: { waterSource: 'city', sewerType: 'public', heatingType: null },
            utilities: {
                ...utilities,
                gas: { ...utilities.gas, status: 'not_included' },
                trash: { ...utilities.trash, status: 'provider', providerName: 'Republic Services' },
            },
        });

        const reopened = await openEditor();
        expect(reopened.editor.utilities.trash).toMatchObject({ status: 'provider', providerName: 'Republic Services' });
        expect(reopened.editor.utilities.gas?.status).toBe('not_included');
        expect(reopened.request.heatingType).toBeNull();

        const { packet, html } = await renderOutput();
        expect(packet.utilities.map((utility) => utility.category)).toEqual(['electric', 'trash']);
        expect(html).toContain('Republic Services');
        expect(html).toContain('Trash pickup: Tuesday');
        expect(html).not.toContain('Not sure');
        expect(html).not.toContain('Heating Type');
        expect(html).toContain('Water Source');
    });

    it('can leave a "Not sure" trash utility off the sheet entirely', async () => {
        const editor = await openEditor();
        await save(editor, {
            utilities: { ...editor.editor.utilities, trash: { ...editor.editor.utilities.trash, status: 'not_included' } },
        });

        const { packet, html } = await renderOutput();
        expect(packet.utilities.map((utility) => utility.category)).toEqual(['electric', 'gas']);
        expect(html).not.toContain('Trash pickup');
    });
});

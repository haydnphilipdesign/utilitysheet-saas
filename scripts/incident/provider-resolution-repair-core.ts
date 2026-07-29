import { z } from 'zod';
import { PROVIDER_RESOLUTION_INCIDENT_ID } from './provider-resolution-core';

const decisionEntrySchema = z.object({
    entryId: z.string().uuid(),
    requestId: z.string().uuid(),
    category: z.string().min(1).max(64),
    expectedUpdatedAt: z.string().datetime(),
    expectedProviderName: z.string().max(300),
    expectedPhone: z.string().nullable(),
    expectedUrl: z.string().nullable(),
    action: z.enum([
        'fill_missing',
        'customer_confirmation',
        'leave_unchanged',
    ]),
    proposedPhone: z.string().nullable(),
    proposedUrl: z.string().nullable(),
});

const decisionFileSchema = z.object({
    incidentId: z.literal(PROVIDER_RESOLUTION_INCIDENT_ID),
    generatedAt: z.string().datetime(),
    entries: z.array(decisionEntrySchema).max(500),
});

export type ProviderResolutionDecisionFile = z.infer<typeof decisionFileSchema>;
export type ProviderResolutionDecision = z.infer<typeof decisionEntrySchema>;

export interface CurrentIncidentEntry {
    entryId: string;
    requestId: string;
    category: string;
    updatedAt: string;
    providerName: string;
    contactPhone: string | null;
    contactUrl: string | null;
}

export interface IncidentContactRepair {
    entryId: string;
    requestId: string;
    category: string;
    expectedUpdatedAt: string;
    expectedProviderName: string;
    expectedPhone: string | null;
    expectedUrl: string | null;
    proposedPhone: string | null;
    proposedUrl: string | null;
    changedFields: Array<'contact_phone' | 'contact_url'>;
}

export function parseProviderResolutionDecisions(
    input: unknown
): ProviderResolutionDecisionFile {
    return decisionFileSchema.parse(input);
}

export function buildIncidentContactRepairPlan(
    decisions: ProviderResolutionDecisionFile,
    currentRows: CurrentIncidentEntry[]
): IncidentContactRepair[] {
    const currentById = new Map(currentRows.map((row) => [row.entryId, row]));
    const repairs: IncidentContactRepair[] = [];

    for (const decision of decisions.entries) {
        if (decision.action !== 'fill_missing') continue;
        const current = currentById.get(decision.entryId);
        if (!current) {
            throw new Error(`Entry ${decision.entryId} no longer exists`);
        }
        if (
            current.requestId !== decision.requestId ||
            current.category !== decision.category ||
            current.updatedAt !== decision.expectedUpdatedAt ||
            current.providerName !== decision.expectedProviderName ||
            current.contactPhone !== decision.expectedPhone ||
            current.contactUrl !== decision.expectedUrl
        ) {
            throw new Error(`Entry ${decision.entryId} changed after report generation`);
        }
        if (
            (current.contactPhone && decision.proposedPhone) ||
            (current.contactUrl && decision.proposedUrl)
        ) {
            throw new Error(`Entry ${decision.entryId} would overwrite an existing contact field`);
        }

        const proposedPhone = current.contactPhone ? null : decision.proposedPhone;
        const proposedUrl = current.contactUrl ? null : decision.proposedUrl;
        const changedFields: Array<'contact_phone' | 'contact_url'> = [];
        if (proposedPhone) changedFields.push('contact_phone');
        if (proposedUrl) changedFields.push('contact_url');
        if (changedFields.length === 0) continue;

        repairs.push({
            entryId: decision.entryId,
            requestId: decision.requestId,
            category: decision.category,
            expectedUpdatedAt: decision.expectedUpdatedAt,
            expectedProviderName: decision.expectedProviderName,
            expectedPhone: decision.expectedPhone,
            expectedUrl: decision.expectedUrl,
            proposedPhone,
            proposedUrl,
            changedFields,
        });
    }

    return repairs;
}

export function assertRepairApplyAuthorized(params: {
    apply: boolean;
    confirm: string | null;
    adminId: string | null;
    adminWritesDisabled: boolean;
}): void {
    if (!params.apply) return;
    if (params.adminWritesDisabled) {
        throw new Error('ADMIN_WRITES_DISABLED=true; incident repair is blocked');
    }
    if (params.confirm !== PROVIDER_RESOLUTION_INCIDENT_ID) {
        throw new Error(`Apply requires --confirm ${PROVIDER_RESOLUTION_INCIDENT_ID}`);
    }
    if (!params.adminId || !z.string().uuid().safeParse(params.adminId).success) {
        throw new Error('Apply requires a valid --admin-id UUID');
    }
}

export function summarizeIncidentContactRepairs(repairs: IncidentContactRepair[]) {
    return {
        selected: repairs.length,
        requests: new Set(repairs.map((repair) => repair.requestId)).size,
        phoneFields: repairs.filter((repair) => repair.proposedPhone).length,
        urlFields: repairs.filter((repair) => repair.proposedUrl).length,
    };
}

import type { ProviderIncidentSegment } from '@/lib/email/provider-incident-update';

export interface ProviderIncidentRecipientCandidate {
    accountId: string;
    email: string;
    fullName: string | null;
    paid: boolean;
    affected: boolean;
}

export interface ProviderIncidentRecipient {
    accountId: string;
    email: string;
    firstName: string | null;
    segment: ProviderIncidentSegment;
}

function normalizeEmail(raw: string): string {
    const email = raw.trim().toLowerCase();
    const at = email.lastIndexOf('@');
    if (at === -1) return email;
    let local = email.slice(0, at);
    const domain = email.slice(at + 1);
    if (domain === 'gmail.com' || domain === 'googlemail.com') {
        local = local.split('+')[0].replace(/\./g, '');
    }
    return `${local}@${domain}`;
}

function firstName(value: string | null): string | null {
    const first = value?.trim().split(/\s+/)[0] || '';
    return first && first.length <= 80 ? first : null;
}

export function segmentProviderIncidentRecipients(params: {
    candidates: ProviderIncidentRecipientCandidate[];
    reportingAccountId: string;
    excludedEmails: string[];
    excludedDomains: string[];
}): ProviderIncidentRecipient[] {
    const excludedEmails = new Set(params.excludedEmails.map(normalizeEmail));
    const excludedDomains = new Set(params.excludedDomains.map((value) => value.toLowerCase()));
    const byEmail = new Map<string, ProviderIncidentRecipient>();

    for (const candidate of params.candidates) {
        const email = candidate.email.trim().toLowerCase();
        const normalized = normalizeEmail(email);
        const domain = normalized.slice(normalized.lastIndexOf('@') + 1);
        if (
            !email.includes('@') ||
            excludedEmails.has(normalized) ||
            excludedDomains.has(domain)
        ) {
            continue;
        }

        let segment: ProviderIncidentSegment | null = null;
        if (candidate.accountId === params.reportingAccountId) {
            segment = 'reporting_customer';
        } else if (candidate.affected && candidate.paid) {
            segment = 'affected_paid';
        } else if (candidate.affected) {
            segment = 'affected_non_billed';
        } else if (candidate.paid) {
            segment = 'paid_goodwill';
        }
        if (!segment) continue;

        const next = {
            accountId: candidate.accountId,
            email,
            firstName: firstName(candidate.fullName),
            segment,
        };
        const existing = byEmail.get(normalized);
        const priority = [
            'paid_goodwill',
            'affected_non_billed',
            'affected_paid',
            'reporting_customer',
        ];
        if (!existing || priority.indexOf(next.segment) > priority.indexOf(existing.segment)) {
            byEmail.set(normalized, next);
        }
    }

    return Array.from(byEmail.values()).sort((a, b) => (
        a.segment.localeCompare(b.segment) || a.accountId.localeCompare(b.accountId)
    ));
}

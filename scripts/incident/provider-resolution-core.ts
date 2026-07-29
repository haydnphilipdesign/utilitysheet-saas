import { canonicalProviderKey } from '@/lib/providers/canonicalize';
import type {
    ContactResolutionDiagnostic,
} from '@/lib/providers/contact-service';
import type {
    ProviderSearchDiagnostic,
} from '@/lib/providers/suggestion-service';
import type { UtilityCategory } from '@/types';

export const PROVIDER_RESOLUTION_INCIDENT_ID = 'provider-resolution-2026-07';

const AUTOMATIC_SEARCH_SOURCES = new Set([
    'ai_primary',
    'ai_verify',
    'ai_recovery',
]);
const MIN_AUTOMATIC_CONFIDENCE = 0.8;

export type IncidentDisposition =
    | 'automatic_contact_repair'
    | 'needs_customer_confirmation'
    | 'leave_unchanged';

export interface IncidentEntry {
    entryId: string;
    requestId: string;
    propertyAddress: string;
    category: UtilityCategory;
    entryMode: string | null;
    providerName: string;
    contactPhone: string | null;
    contactUrl: string | null;
    updatedAt: string;
}

export interface IncidentRepairProposal {
    disposition: IncidentDisposition;
    reasons: string[];
    proposedPhone: string | null;
    proposedUrl: string | null;
}

export interface IncidentReviewRow {
    entry: IncidentEntry;
    search: ProviderSearchDiagnostic;
    contact: ContactResolutionDiagnostic;
    proposal: IncidentRepairProposal;
}

export interface IncidentReport {
    incidentId: string;
    generatedAt: string;
    startedAt: string;
    endedAt: string;
    rows: IncidentReviewRow[];
}

function normalizePhone(value: string | null | undefined): string | null {
    if (!value) return null;
    const digits = value.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
    return digits.length === 10 ? digits : null;
}

function normalizedHost(value: string | null | undefined): string | null {
    if (!value) return null;
    try {
        return new URL(value).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
        return null;
    }
}

function ambiguousDisposition(entryMode: string | null): IncidentDisposition {
    return entryMode === 'suggested_confirmed' || entryMode === 'search_selected'
        ? 'needs_customer_confirmation'
        : 'leave_unchanged';
}

export function classifyIncidentEntry(params: {
    entry: IncidentEntry;
    search: ProviderSearchDiagnostic;
    contact: ContactResolutionDiagnostic;
}): IncidentRepairProposal {
    const { entry, search, contact } = params;
    const fallbackDisposition = ambiguousDisposition(entry.entryMode);
    const noChange = (reason: string): IncidentRepairProposal => ({
        disposition: fallbackDisposition,
        reasons: [reason],
        proposedPhone: null,
        proposedUrl: null,
    });

    if (!entry.providerName.trim()) {
        return noChange('No provider name was recorded.');
    }

    if (entry.contactPhone && entry.contactUrl) {
        return {
            disposition: 'leave_unchanged',
            reasons: ['Both contact fields are already populated.'],
            proposedPhone: null,
            proposedUrl: null,
        };
    }

    if (!AUTOMATIC_SEARCH_SOURCES.has(search.outcome.source)) {
        return noChange(`Fresh provider search source was ${search.outcome.source}.`);
    }

    const providerKey = canonicalProviderKey(entry.providerName);
    const exact = search.suggestions.find(
        (suggestion) => canonicalProviderKey(suggestion.display_name) === providerKey
    );
    if (!exact) {
        return noChange('Fresh location-aware search did not return an exact provider-name match.');
    }

    if (exact.confidence < MIN_AUTOMATIC_CONFIDENCE) {
        return noChange('Fresh provider confidence was below the automatic-repair threshold.');
    }

    if (contact.failure || !contact.contact) {
        return noChange('Fresh contact resolution did not return a usable contact.');
    }

    const contactPhone = normalizePhone(contact.contact.customer_service_phone);
    const suggestionPhone = normalizePhone(exact.contact_phone);
    const phoneCorroborated = Boolean(
        contactPhone && suggestionPhone && contactPhone === suggestionPhone
    );

    const suggestionHost = normalizedHost(exact.contact_website);
    const contactHosts = [
        normalizedHost(contact.contact.main_website),
        normalizedHost(contact.contact.start_stop_service_url),
    ].filter((host): host is string => Boolean(host));
    const domainCorroborated = Boolean(
        suggestionHost && contactHosts.includes(suggestionHost)
    );

    if (!phoneCorroborated && !domainCorroborated) {
        return noChange('Independent provider search and contact lookup did not corroborate a phone or domain.');
    }

    const proposedPhone = entry.contactPhone
        ? null
        : contact.contact.customer_service_phone || null;
    const proposedUrl = entry.contactUrl
        ? null
        : contact.contact.start_stop_service_url || contact.contact.main_website || null;

    if (!proposedPhone && !proposedUrl) {
        return {
            disposition: 'leave_unchanged',
            reasons: ['No blank contact field had a verified replacement value.'],
            proposedPhone: null,
            proposedUrl: null,
        };
    }

    return {
        disposition: 'automatic_contact_repair',
        reasons: [
            'Provider name matched fresh location-aware search.',
            phoneCorroborated
                ? 'Phone matched across independent resolutions.'
                : 'Official website domain matched across independent resolutions.',
        ],
        proposedPhone,
        proposedUrl,
    };
}

export function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function safeJsonForScript(value: unknown): string {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026');
}

function buildDecisionSeed(row: IncidentReviewRow) {
    const automatic = row.proposal.disposition === 'automatic_contact_repair';
    return {
        entryId: row.entry.entryId,
        requestId: row.entry.requestId,
        category: row.entry.category,
        expectedUpdatedAt: row.entry.updatedAt,
        expectedProviderName: row.entry.providerName,
        expectedPhone: row.entry.contactPhone,
        expectedUrl: row.entry.contactUrl,
        action: automatic
            ? 'fill_missing'
            : row.proposal.disposition === 'needs_customer_confirmation'
                ? 'customer_confirmation'
                : 'leave_unchanged',
        proposedPhone: row.proposal.proposedPhone,
        proposedUrl: row.proposal.proposedUrl,
    };
}

export function renderIncidentReviewHtml(report: IncidentReport): string {
    const groups = new Map<string, IncidentReviewRow[]>();
    for (const row of report.rows) {
        const existing = groups.get(row.entry.requestId) || [];
        existing.push(row);
        groups.set(row.entry.requestId, existing);
    }

    const decisionSeed = report.rows.map(buildDecisionSeed);
    const sections = Array.from(groups.entries()).map(([requestId, rows]) => {
        const address = rows[0]?.entry.propertyAddress || '';
        const cards = rows.map((row) => {
            const automatic = row.proposal.disposition === 'automatic_contact_repair';
            const suggestions = row.search.suggestions.slice(0, 3)
                .map((item) => `${escapeHtml(item.display_name)} (${Math.round(item.confidence * 100)}%)`)
                .join('<br>');
            const control = automatic
                ? `<label><input type="checkbox" data-entry-id="${escapeHtml(row.entry.entryId)}" data-automatic checked> Include automatic repair</label>`
                : `<label>Decision
                    <select data-entry-id="${escapeHtml(row.entry.entryId)}" data-decision>
                        <option value="customer_confirmation"${row.proposal.disposition === 'needs_customer_confirmation' ? ' selected' : ''}>Needs customer confirmation</option>
                        <option value="leave_unchanged"${row.proposal.disposition === 'leave_unchanged' ? ' selected' : ''}>Leave unchanged</option>
                    </select>
                </label>`;

            return `<article class="entry ${automatic ? 'automatic' : 'review'}">
                <h3>${escapeHtml(row.entry.category)} · ${escapeHtml(row.entry.providerName || 'No provider')}</h3>
                <p><strong>Entry mode:</strong> ${escapeHtml(row.entry.entryMode || 'unknown')}</p>
                <p><strong>Current:</strong> ${escapeHtml(row.entry.contactPhone || 'no phone')} · ${escapeHtml(row.entry.contactUrl || 'no website')}</p>
                <p><strong>Proposed:</strong> ${escapeHtml(row.proposal.proposedPhone || 'no phone change')} · ${escapeHtml(row.proposal.proposedUrl || 'no website change')}</p>
                <p><strong>Fresh candidates:</strong><br>${suggestions || 'None'}</p>
                <p><strong>Why:</strong> ${row.proposal.reasons.map(escapeHtml).join(' ')}</p>
                ${control}
            </article>`;
        }).join('');

        return `<section class="sheet">
            <h2>${escapeHtml(address)}</h2>
            <p><a href="https://www.utilitysheet.com/admin/requests/${encodeURIComponent(requestId)}" target="_blank" rel="noreferrer">Open Admin request</a></p>
            ${cards}
        </section>`;
    }).join('');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>UtilitySheet incident review</title>
<style>
body{font-family:system-ui,sans-serif;max-width:1100px;margin:0 auto;padding:24px;background:#f6f8f7;color:#17211c}
.summary,.sheet{background:#fff;border:1px solid #d8e0dc;border-radius:12px;padding:18px;margin:16px 0}
.entry{border-left:4px solid #c28b25;background:#fbfbfa;padding:14px;margin:12px 0;border-radius:8px}
.entry.automatic{border-left-color:#15803d}.entry h3{margin-top:0}select{padding:6px}button{padding:10px 14px;background:#166534;color:#fff;border:0;border-radius:8px;font-weight:600}
</style>
</head>
<body>
<h1>Provider-resolution incident review</h1>
<div class="summary">
<p><strong>Incident:</strong> ${escapeHtml(report.incidentId)}</p>
<p><strong>Window:</strong> ${escapeHtml(report.startedAt)} through ${escapeHtml(report.endedAt)}</p>
<p><strong>Flagged entries:</strong> ${report.rows.length}</p>
<button id="export-decisions">Export decisions</button>
</div>
${sections}
<script id="decision-seed" type="application/json">${safeJsonForScript(decisionSeed)}</script>
<script>
document.getElementById('export-decisions').addEventListener('click', () => {
  const entries = JSON.parse(document.getElementById('decision-seed').textContent).map((entry) => {
    const automatic = document.querySelector('[data-automatic][data-entry-id="' + entry.entryId + '"]');
    const decision = document.querySelector('[data-decision][data-entry-id="' + entry.entryId + '"]');
    if (automatic) entry.action = automatic.checked ? 'fill_missing' : 'leave_unchanged';
    if (decision) entry.action = decision.value;
    return entry;
  });
  const payload = ${safeJsonForScript({
      incidentId: report.incidentId,
      generatedAt: report.generatedAt,
  })};
  payload.entries = entries;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = '${escapeHtml(report.incidentId)}-decisions.json';
  link.click();
  URL.revokeObjectURL(link.href);
});
</script>
</body>
</html>`;
}

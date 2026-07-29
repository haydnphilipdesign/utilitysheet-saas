export type ProviderIncidentSegment =
    | 'reporting_customer'
    | 'affected_paid'
    | 'paid_goodwill'
    | 'affected_non_billed';

export interface ProviderIncidentCommunicationState {
    hotfixDeployed: boolean;
    creditApplied: boolean;
    reviewComplete: boolean;
}

export interface ProviderIncidentEmail {
    subject: string;
    text: string;
    html: string;
}

function safeFirstName(value: string | null | undefined): string | null {
    const first = value?.trim().split(/\s+/)[0] || '';
    return first && first.length <= 80 ? first : null;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function buildProviderIncidentEmail(params: {
    segment: ProviderIncidentSegment;
    firstName?: string | null;
    state: ProviderIncidentCommunicationState;
}): ProviderIncidentEmail {
    const firstName = safeFirstName(params.firstName);
    const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
    const resolved = params.state.hotfixDeployed
        ? 'I rolled back the provider change and added safeguards around structured responses and fallback caching.'
        : 'I have rolled back the provider change while I finish validating additional safeguards.';
    const review = params.state.reviewComplete
        ? 'I reviewed the submitted sheets from the affected period. Missing contact details were repaired only where the recorded provider could be verified confidently; questionable provider names were left unchanged.'
        : 'I am reviewing submitted sheets from the affected period. I will fill missing contact details only where the recorded provider can be verified confidently, and I will not change a questionable provider name without confirmation.';
    const credit = params.state.creditApplied
        ? 'I applied a one-month credit to your UtilitySheet account. It will be used automatically on your next invoice; you do not need to do anything.'
        : 'I will apply a one-month credit to your UtilitySheet account after the billing review is complete.';

    let subject: string;
    let paragraphs: string[];
    if (params.segment === 'reporting_customer') {
        subject = 'I found the UtilitySheet provider issue';
        paragraphs = [
            greeting,
            'Thank you for telling me about the incorrect provider suggestions and missing contact information. I found the cause: a provider-resolution change released on July 24 sometimes returned no usable result, and UtilitySheet fallback and caching behavior could then show a plausible but incorrect company or leave contact information unresolved.',
            resolved,
            review,
            credit,
            'I am sorry this made extra work for you, especially on active transactions. Thank you again for flagging it.',
        ];
    } else if (params.segment === 'affected_paid') {
        subject = 'An apology and credit from UtilitySheet';
        paragraphs = [
            greeting,
            'I identified a provider-resolution issue that may have affected a UtilitySheet submitted between July 24 and July 29. It could cause a generic provider suggestion to appear or leave contact information unresolved.',
            resolved,
            review,
            credit,
            'I am sorry for the extra work and uncertainty this created.',
        ];
    } else if (params.segment === 'paid_goodwill') {
        subject = 'A UtilitySheet reliability update and account credit';
        paragraphs = [
            greeting,
            'I recently resolved a provider-resolution issue affecting some submitted UtilitySheets between July 24 and July 29. I have not identified an affected sheet in your workspace, but provider accuracy is core to the product and I want to handle the incident consistently.',
            credit,
            'No action is needed. If anything ever looks wrong in a UtilitySheet, reply directly and I will investigate it.',
        ];
    } else {
        subject = 'A UtilitySheet provider issue may have affected a submitted sheet';
        paragraphs = [
            greeting,
            'I identified a provider-resolution issue that may have affected a UtilitySheet submitted between July 24 and July 29. It could cause a generic provider suggestion to appear or leave contact information unresolved.',
            resolved,
            review,
            'I am sorry for the extra work and uncertainty this created. If you have a question about a specific sheet, reply directly and I will review it.',
        ];
    }

    const signature = 'Haydn\nUtilitySheet';
    return {
        subject,
        text: [...paragraphs, signature].join('\n\n'),
        html: `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;line-height:1.6;max-width:600px;margin:0 auto;padding:24px;">${paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}<p>Haydn<br>UtilitySheet</p></body></html>`,
    };
}

import type { ProductUpdate } from '@/types';

const REFERRAL_UPDATE_TIMESTAMP = '2026-07-15T09:00:00.000Z';
const SUBMITTED_EDITING_UPDATE_TIMESTAMP = '2026-03-31T09:00:00.000Z';
const PROVIDER_RESOLUTION_UPDATE_TIMESTAMP = '2026-07-29T17:00:00.000Z';
const REOPEN_UPDATE_TIMESTAMP = '2026-10-06T17:00:00.000Z';

/**
 * Hardcoded featured updates, newest first. The dashboard banner treats the
 * first merged update as "latest" for its dismissal logic, so adding a new
 * entry at the top re-surfaces the banner for everyone.
 */
export const FEATURED_PRODUCT_UPDATES: ProductUpdate[] = [
    {
        id: 'reopen-submitted-request-for-seller',
        title: 'New: Reopen a submitted request so the seller can correct it',
        body: [
            'If a seller submits something wrong, you can now send the request back to them instead of starting a new one.',
            '',
            '- Open the submitted request and choose "Reopen for Seller". The seller link becomes editable again and starts from the current info sheet, including any edits you made.',
            '- Available on every plan, including Free.',
            '- The seller\'s resubmission does not use another monthly submission.',
            '- The info sheet link and PDF are unavailable while the request is reopened. They return when the seller submits again.',
            '- "Close Without Changes" restores the info sheet as it was.',
            '- Reopening does not email the seller, so send them their link when you are ready.',
            '',
            'Pro and Team workspaces can still edit a submitted sheet directly.',
        ].join('\n'),
        category: 'feature',
        is_published: true,
        published_at: REOPEN_UPDATE_TIMESTAMP,
        created_by: null,
        created_at: REOPEN_UPDATE_TIMESTAMP,
        updated_at: REOPEN_UPDATE_TIMESTAMP,
    },
    {
        id: 'provider-resolution-incident-resolved',
        title: 'Resolved: Provider suggestions and contact lookup',
        body: [
            'Between July 24 and July 29, some provider lookups could return generic suggestions or omit contact information.',
            '',
            '- We restored the previous provider model.',
            '- Provider responses now use explicit structured validation.',
            '- Generic fallbacks and unresolved contact results expire quickly instead of remaining cached.',
            '- We are reviewing submitted sheets from the affected period.',
            '',
            'No action is needed for most sheets. If a provider itself cannot be verified confidently, we will contact the account owner before changing it.',
        ].join('\n'),
        category: 'bugfix',
        is_published: true,
        published_at: PROVIDER_RESOLUTION_UPDATE_TIMESTAMP,
        created_by: null,
        created_at: PROVIDER_RESOLUTION_UPDATE_TIMESTAMP,
        updated_at: PROVIDER_RESOLUTION_UPDATE_TIMESTAMP,
    },
    {
        id: 'referral-credit-program',
        title: 'New: Give a month of Pro, get a month of Pro',
        body: [
            'UtilitySheet now has a referral program.',
            '',
            '- Share your personal referral link with another TC or agent.',
            '- When they receive their first real seller submission, you earn a free month of Pro and they get a free Pro month too.',
            '- Credits apply to your bill automatically on Pro. On the free plan, they wait for you until you upgrade.',
            '- Earn up to 12 free months per year.',
            '',
            'Find your referral link under Settings, in the Referrals section.',
        ].join('\n'),
        category: 'feature',
        is_published: true,
        published_at: REFERRAL_UPDATE_TIMESTAMP,
        created_by: null,
        created_at: REFERRAL_UPDATE_TIMESTAMP,
        updated_at: REFERRAL_UPDATE_TIMESTAMP,
    },
    {
        id: 'built-in-submitted-sheet-editing',
        title: 'Edit submitted sheets after seller submission',
        body: [
            'Pro and Team workspaces can now update submitted info sheets from the authenticated dashboard.',
            '',
            '- Correct capitalization, address formatting, provider names, phone numbers, websites, and retroactive provider/contact changes.',
            '- Seller and public links stay read-only after submission.',
            '- Changes update the live info sheet and all future PDF downloads.',
            '- Previously emailed PDF attachments stay unchanged as past snapshots.',
            '- In Team workspaces, any teammate who already has access to the request can edit it.',
        ].join('\n'),
        category: 'feature',
        is_published: true,
        published_at: SUBMITTED_EDITING_UPDATE_TIMESTAMP,
        created_by: null,
        created_at: SUBMITTED_EDITING_UPDATE_TIMESTAMP,
        updated_at: SUBMITTED_EDITING_UPDATE_TIMESTAMP,
    },
];

export function mergeFeaturedProductUpdate(updates: ProductUpdate[]): ProductUpdate[] {
    const missingFeatured = FEATURED_PRODUCT_UPDATES.filter((featured) => (
        !updates.some((update) => update.id === featured.id || update.title === featured.title)
    ));
    if (missingFeatured.length === 0) return updates;

    return [...missingFeatured, ...updates].sort((a, b) => (
        new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime()
    ));
}

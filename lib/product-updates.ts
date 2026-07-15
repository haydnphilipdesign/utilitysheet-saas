import type { ProductUpdate } from '@/types';

const REFERRAL_UPDATE_TIMESTAMP = '2026-07-15T09:00:00.000Z';
const SUBMITTED_EDITING_UPDATE_TIMESTAMP = '2026-03-31T09:00:00.000Z';

/**
 * Hardcoded featured updates, newest first. The dashboard banner treats the
 * first merged update as "latest" for its dismissal logic, so adding a new
 * entry at the top re-surfaces the banner for everyone.
 */
export const FEATURED_PRODUCT_UPDATES: ProductUpdate[] = [
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

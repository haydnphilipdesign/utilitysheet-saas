import type { ProductUpdate } from '@/types';

const FEATURED_UPDATE_TIMESTAMP = '2026-03-31T09:00:00.000Z';

export const FEATURED_PRODUCT_UPDATE: ProductUpdate = {
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
    published_at: FEATURED_UPDATE_TIMESTAMP,
    created_by: null,
    created_at: FEATURED_UPDATE_TIMESTAMP,
    updated_at: FEATURED_UPDATE_TIMESTAMP,
};

export function mergeFeaturedProductUpdate(updates: ProductUpdate[]): ProductUpdate[] {
    const alreadyPresent = updates.some((update) => update.id === FEATURED_PRODUCT_UPDATE.id || update.title === FEATURED_PRODUCT_UPDATE.title);
    if (alreadyPresent) return updates;
    return [FEATURED_PRODUCT_UPDATE, ...updates];
}

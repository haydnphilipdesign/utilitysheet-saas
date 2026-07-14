import { sql } from '@/lib/neon/db';
import type { GrowthAttribution } from '@/lib/growth/attribution';

export async function saveFirstTouchGrowthAttribution(
    accountId: string,
    data: GrowthAttribution
) {
    if (!sql) return;

    await sql`
        INSERT INTO growth_attributions (
            account_id,
            source,
            medium,
            campaign,
            content,
            referral_code,
            landing_path
        ) VALUES (
            ${accountId},
            ${data.source},
            ${data.medium},
            ${data.campaign},
            ${data.content},
            ${data.referralCode},
            ${data.landingPath}
        )
        ON CONFLICT (account_id) DO NOTHING
    `;
}

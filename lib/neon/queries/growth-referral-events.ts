import { sql } from '@/lib/neon/db';

export type GrowthReferralEventType = 'impression' | 'click';
export type GrowthReferralSurface = 'packet_share_page';

export async function recordGrowthReferralEvent(params: {
    eventType: GrowthReferralEventType;
    surface: GrowthReferralSurface;
    referralCode: string | null;
}) {
    if (!sql) return;

    await sql`
        INSERT INTO growth_referral_events (event_type, surface, referral_code)
        VALUES (${params.eventType}, ${params.surface}, ${params.referralCode})
    `;
}

import { sql } from '@/lib/neon/db';

export type AccountSecurityEventAction =
    | 'email_change_started'
    | 'primary_email_changed'
    | 'password_changed'
    | 'password_reset_requested'
    | 'session_revoked'
    | 'other_sessions_revoked'
    | 'account_data_exported'
    | 'closure_readiness_viewed';

export async function updateAccountEmail(accountId: string, email: string) {
    if (!sql) return null;
    const result = await sql`
        UPDATE accounts
        SET email = ${email}, updated_at = NOW()
        WHERE id = ${accountId}
        RETURNING id, email, stripe_customer_id
    `;
    return result[0] || null;
}

export async function recordAccountSecurityEvent(data: {
    accountId: string;
    action: AccountSecurityEventAction;
    status?: 'success' | 'failure';
    metadata?: Record<string, string | number | boolean | null>;
}) {
    const event = {
        level: 'info',
        message: 'Account security event',
        accountId: data.accountId,
        action: data.action,
        status: data.status || 'success',
        metadata: data.metadata || {},
    };

    if (!sql) {
        console.info(JSON.stringify(event));
        return false;
    }

    try {
        const table = await sql`SELECT to_regclass('public.account_security_events') AS relation_name`;
        if (!table[0]?.relation_name) {
            console.info(JSON.stringify({ ...event, durableAuditAvailable: false }));
            return false;
        }

        await sql`
            INSERT INTO account_security_events (account_id, action, status, metadata)
            VALUES (
                ${data.accountId},
                ${data.action},
                ${data.status || 'success'},
                ${JSON.stringify(data.metadata || {})}::jsonb
            )
        `;
        return true;
    } catch (error) {
        console.error(JSON.stringify({
            ...event,
            level: 'error',
            message: 'Failed to persist account security event',
            error: error instanceof Error ? error.message : String(error),
        }));
        return false;
    }
}

export async function getAccountDataExport(accountId: string) {
    if (!sql) return null;

    const [account, memberships, profiles, intakeLinks, requests, entries, timeline, attribution, referrals, securityEvents] = await Promise.all([
        sql`
            SELECT id, email, full_name, company_name, phone, subscription_status,
                subscription_ends_at, onboarding_completed_at, notification_preferences,
                created_at, updated_at
            FROM accounts
            WHERE id = ${accountId}
        `,
        sql`
            SELECT o.id AS organization_id, o.name, om.role, o.subscription_status,
                o.subscription_ends_at, om.created_at AS joined_at
            FROM organization_members om
            JOIN organizations o ON o.id = om.organization_id
            WHERE om.account_id = ${accountId}
            ORDER BY om.created_at ASC
        `,
        sql`
            SELECT id, organization_id, name, primary_color, secondary_color,
                contact_name, contact_phone, contact_email, contact_website,
                disclaimer_text, company_name, professional_title, license_number,
                license_state, compliance_line, message_templates, is_default,
                buyer_next_steps, next_steps_title, show_powered_by,
                show_generation_date, welcome_message, created_at, updated_at
            FROM brand_profiles
            WHERE account_id = ${accountId}
            ORDER BY created_at ASC
        `,
        sql`
            SELECT is_active, default_brand_profile_id, default_utility_categories,
                default_packet_mode, advanced_modules, advanced_module_exclusions,
                created_at, updated_at
            FROM intake_links
            WHERE account_id = ${accountId}
        `,
        sql`
            SELECT id, organization_id, brand_profile_id, property_address,
                property_address_structured, seller_name, seller_email, seller_phone,
                closing_date, status, packet_mode, advanced_modules,
                advanced_module_exclusions, advanced_packet_data, utility_categories,
                water_source, sewer_type, heating_type, is_demo, created_at,
                updated_at, last_activity_at, metered_at, is_locked, locked_reason,
                locked_at, deleted_at
            FROM requests
            WHERE account_id = ${accountId}
            ORDER BY created_at ASC
        `,
        sql`
            SELECT ue.request_id, ue.category, ue.entry_mode, ue.display_name,
                ue.raw_text, ue.meter_number, ue.extra, ue.canonical_id,
                ue.contact_phone, ue.contact_url, ue.confidence_score,
                ue.created_at, ue.updated_at
            FROM utility_entries ue
            JOIN requests r ON r.id = ue.request_id
            WHERE r.account_id = ${accountId}
            ORDER BY ue.created_at ASC
        `,
        sql`
            SELECT el.request_id, el.event_type, el.created_at
            FROM event_logs el
            JOIN requests r ON r.id = el.request_id
            WHERE r.account_id = ${accountId}
            ORDER BY el.created_at ASC
        `,
        sql`
            SELECT source, medium, campaign, content, landing_path, captured_at
            FROM growth_attributions
            WHERE account_id = ${accountId}
        `,
        sql`
            SELECT
                COUNT(*) FILTER (WHERE referrer_account_id = ${accountId})::int AS earned_count,
                COUNT(*) FILTER (WHERE referrer_account_id = ${accountId} AND status = 'applied')::int AS applied_count,
                COALESCE(SUM(amount_cents) FILTER (WHERE referrer_account_id = ${accountId}), 0)::int AS earned_value_cents,
                COALESCE(SUM(amount_cents) FILTER (WHERE referrer_account_id = ${accountId} AND status = 'applied'), 0)::int AS applied_value_cents
            FROM referral_credits
        `,
        sql`
            SELECT action, status, metadata, created_at
            FROM account_security_events
            WHERE account_id = ${accountId}
                AND to_regclass('public.account_security_events') IS NOT NULL
            ORDER BY created_at ASC
        `.catch(() => []),
    ]);

    if (!account[0]) return null;
    return {
        account: account[0],
        memberships,
        brandingProfiles: profiles,
        sellerFormDefaults: intakeLinks[0] || null,
        requests,
        utilityEntries: entries,
        requestTimeline: timeline,
        growthAttribution: attribution[0] || null,
        referralSummary: referrals[0] || null,
        securityEvents,
    };
}

export async function getAccountClosureReadiness(accountId: string, email: string) {
    if (!sql) return null;

    const [account, workspaces, assets, invitations, referrals] = await Promise.all([
        sql`
            SELECT subscription_status, subscription_id, subscription_ends_at
            FROM accounts
            WHERE id = ${accountId}
        `,
        sql`
            SELECT
                o.id, o.name, om.role, o.subscription_status, o.subscription_id,
                COUNT(DISTINCT all_members.id)::int AS member_count,
                COUNT(DISTINCT all_members.id) FILTER (WHERE all_members.role = 'admin')::int AS admin_count,
                COUNT(DISTINCT oi.id) FILTER (WHERE oi.accepted_at IS NULL AND oi.expires_at > NOW())::int AS pending_invite_count,
                COUNT(DISTINCT bp.id) FILTER (WHERE bp.account_id = ${accountId})::int AS owned_profile_count,
                COUNT(DISTINCT r.id) FILTER (WHERE r.account_id = ${accountId})::int AS owned_request_count
            FROM organization_members om
            JOIN organizations o ON o.id = om.organization_id
            LEFT JOIN organization_members all_members ON all_members.organization_id = o.id
            LEFT JOIN organization_invitations oi ON oi.organization_id = o.id
            LEFT JOIN brand_profiles bp ON bp.organization_id = o.id
            LEFT JOIN requests r ON r.organization_id = o.id
            WHERE om.account_id = ${accountId}
            GROUP BY o.id, o.name, om.role, o.subscription_status, o.subscription_id, om.created_at
            ORDER BY om.created_at ASC
        `,
        sql`
            SELECT
                (SELECT COUNT(*)::int FROM requests WHERE account_id = ${accountId}) AS request_count,
                (SELECT COUNT(*)::int FROM brand_profiles WHERE account_id = ${accountId}) AS profile_count,
                (SELECT COUNT(*)::int FROM intake_links WHERE account_id = ${accountId}) AS seller_form_count,
                (SELECT COUNT(*)::int FROM requests WHERE account_id = ${accountId} AND status != 'draft') AS public_request_count
        `,
        sql`
            SELECT COUNT(*)::int AS count
            FROM organization_invitations
            WHERE lower(email) = ${email.trim().toLowerCase()}
                AND accepted_at IS NULL
                AND expires_at > NOW()
        `,
        sql`
            SELECT
                COUNT(*) FILTER (WHERE referrer_account_id = ${accountId} AND status = 'earned')::int AS unapplied_earned_count,
                COUNT(*) FILTER (WHERE referred_account_id = ${accountId})::int AS referred_record_count
            FROM referral_credits
        `,
    ]);

    if (!account[0]) return null;
    return {
        personalSubscription: account[0],
        workspaces,
        assets: assets[0] || {},
        pendingInvitationsAddressedToEmail: Number(invitations[0]?.count) || 0,
        referralRecords: referrals[0] || {},
    };
}

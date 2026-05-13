#!/usr/bin/env node

import { neon } from '@neondatabase/serverless';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_APP_URL = 'http://localhost:3000';
const DEFAULT_DEMO_EMAIL = 'demo.tc@utilitysheet.test';
const DEMO_ORGANIZATION_SLUG = 'utilitysheet-demo';
const DEMO_INTAKE_SLUG = 'utilitysheet-demo';
const DEMO_BRAND_NAME = 'UtilitySheet Demo';

function readEnvFile(path) {
    if (!existsSync(path)) return;
    const raw = readFileSync(path, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        const eq = trimmed.indexOf('=');
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        if (key && process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}

function loadLocalEnv() {
    readEnvFile(resolve(process.cwd(), '.env.local'));
    readEnvFile(resolve(process.cwd(), '.env'));
}

function normalizeBaseUrl(value) {
    const fallback = DEFAULT_APP_URL;
    const raw = String(value || '').trim() || fallback;
    return raw.replace(/\/+$/, '');
}

function token() {
    return crypto.randomUUID().replace(/-/g, '');
}

export function buildDemoSeedConfig(overrides = {}) {
    const appUrl = normalizeBaseUrl(
        overrides.appUrl ||
        process.env.DEMO_APP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        DEFAULT_APP_URL
    );
    const email = String(overrides.email || process.env.DEMO_ACCOUNT_EMAIL || DEFAULT_DEMO_EMAIL)
        .trim()
        .toLowerCase();
    const configuredAuthUserId = overrides.authUserId ?? process.env.DEMO_AUTH_USER_ID ?? null;
    const authUserId = configuredAuthUserId ? String(configuredAuthUserId).trim() : null;

    return {
        appUrl,
        account: {
            email,
            authUserId,
            fullName: 'Demo TC',
            companyName: 'UtilitySheet Demo',
            phone: '555-0100',
            stripeCustomerId: null,
            subscriptionId: null,
            subscriptionStatus: 'free',
            notificationPreferences: {
                seller_submissions: true,
                seller_submission_pdf_attachment: true,
                collect_electric_meter_number: true,
                contact_resolution: false,
                weekly_summary: false,
            },
        },
        organization: {
            name: 'UtilitySheet Demo',
            slug: DEMO_ORGANIZATION_SLUG,
            subscriptionStatus: 'team',
            seatQuantity: 3,
            stripeCustomerId: null,
            subscriptionId: null,
        },
        brand: {
            name: DEMO_BRAND_NAME,
            logoUrl: '/logo-sm.png',
            primaryColor: '#1e3a8a',
            secondaryColor: '#2563eb',
            contactName: 'Demo Coordinator',
            contactEmail: 'demo@utilitysheet.test',
            contactPhone: '555-0142',
            contactWebsite: 'https://utilitysheet.com',
            disclaimerText: 'Demo utility information prepared for marketing screenshots. All names, addresses, and provider details are fictional.',
            welcomeMessage: 'Utility provider details for buyer handoff. Please verify availability and transfer requirements directly with each provider.',
            nextStepsTitle: 'Buyer next steps',
            buyerNextSteps: [
                'Contact each provider to start service in your name before closing.',
                'Keep your settlement date handy when scheduling transfers.',
                'Ask each provider whether deposits or proof of ownership are required.',
                'Save this utility sheet with your closing documents for quick reference.',
            ],
        },
        intakeLink: {
            slug: DEMO_INTAKE_SLUG,
            url: `${appUrl}/i/${DEMO_INTAKE_SLUG}`,
            defaultPacketMode: 'simple',
            advancedModules: [],
            advancedModuleExclusions: {},
        },
        sampleRequest: {
            propertyAddress: '123 Main Street, Anytown, PA 18301',
            propertyAddressStructured: {
                street: '123 Main Street',
                city: 'Anytown',
                state: 'PA',
                zip: '18301',
                full: '123 Main Street, Anytown, PA 18301',
                confidence: 'high',
                issues: [],
                source: 'local',
            },
            sellerName: 'Jane Seller',
            sellerEmail: 'jane.seller@example.test',
            sellerPhone: '555-0198',
            closingDate: '2026-06-15',
            utilityCategories: ['electric', 'gas', 'water', 'sewer', 'trash', 'internet', 'cable'],
            waterSource: 'city',
            sewerType: 'public',
            heatingType: 'natural_gas',
        },
        sampleUtilities: [
            {
                category: 'electric',
                displayName: 'Keystone Electric Co.',
                contactPhone: '555-1001',
                contactUrl: 'https://example.test/keystone-electric/start',
                meterNumber: 'ELEC-48291',
            },
            {
                category: 'gas',
                displayName: 'Valley Natural Gas',
                contactPhone: '555-1002',
                contactUrl: 'https://example.test/valley-gas/start',
            },
            {
                category: 'water',
                displayName: 'Anytown Water Authority',
                contactPhone: '555-1003',
                contactUrl: 'https://example.test/anytown-water',
            },
            {
                category: 'sewer',
                displayName: 'Anytown Sewer Authority',
                contactPhone: '555-1004',
                contactUrl: 'https://example.test/anytown-sewer',
            },
            {
                category: 'trash',
                displayName: 'GreenCart Waste Services',
                contactPhone: '555-1005',
                contactUrl: 'https://example.test/greencart',
                extra: {
                    has_recycling: 'yes',
                    trash_pickup_day: 'thu',
                    recycling_pickup_day: 'thu',
                },
            },
            {
                category: 'internet',
                displayName: 'Blue Ridge Fiber',
                contactPhone: '555-1006',
                contactUrl: 'https://example.test/blue-ridge-fiber',
            },
            {
                category: 'cable',
                displayName: 'Blue Ridge Fiber',
                contactPhone: '555-1006',
                contactUrl: 'https://example.test/blue-ridge-fiber',
            },
        ],
    };
}

export function chooseCanonicalDemoAccount(accounts) {
    if (!Array.isArray(accounts) || accounts.length === 0) return null;

    const sorted = [...accounts].sort((a, b) => {
        const aHasAuth = typeof a?.auth_user_id === 'string' && a.auth_user_id.trim().length > 0;
        const bHasAuth = typeof b?.auth_user_id === 'string' && b.auth_user_id.trim().length > 0;
        if (aHasAuth !== bHasAuth) return aHasAuth ? -1 : 1;

        const aTime = new Date(a?.created_at || 0).getTime();
        const bTime = new Date(b?.created_at || 0).getTime();
        return aTime - bTime;
    });

    return sorted[0] || null;
}

async function getSingle(sql, query) {
    const rows = await query;
    return rows[0] || null;
}

async function ensureNoSlugCollision(sql, config, existingAccountId) {
    const slugOwner = await getSingle(sql, sql`
        SELECT account_id
        FROM intake_links
        WHERE slug = ${config.intakeLink.slug}
        LIMIT 1
    `);

    if (slugOwner && slugOwner.account_id !== existingAccountId) {
        throw new Error(
            `Safety stop: intake slug "${config.intakeLink.slug}" already belongs to another account (${slugOwner.account_id}).`
        );
    }
}

async function resetDemo(sql, config) {
    const existingAccounts = await sql`
        SELECT *
        FROM accounts
        WHERE lower(email) = ${config.account.email}
            OR (${config.account.authUserId}::text IS NOT NULL AND auth_user_id = ${config.account.authUserId})
        ORDER BY created_at ASC
    `;

    let account = chooseCanonicalDemoAccount(existingAccounts);
    if (!account) {
        account = await getSingle(sql, sql`
            INSERT INTO accounts (
                auth_user_id,
                email,
                full_name,
                company_name,
                phone,
                role,
                stripe_customer_id,
                subscription_status,
                subscription_id,
                subscription_ends_at,
                onboarding_completed_at,
                notification_preferences
            ) VALUES (
                ${config.account.authUserId},
                ${config.account.email},
                ${config.account.fullName},
                ${config.account.companyName},
                ${config.account.phone},
                'user',
                NULL,
                ${config.account.subscriptionStatus},
                NULL,
                NULL,
                NOW(),
                ${JSON.stringify(config.account.notificationPreferences)}::jsonb
            )
            RETURNING *
        `);
    } else {
        const nextAuthUserId = config.account.authUserId || account.auth_user_id || null;
        account = await getSingle(sql, sql`
            UPDATE accounts
            SET
                auth_user_id = ${nextAuthUserId},
                email = ${config.account.email},
                full_name = ${config.account.fullName},
                company_name = ${config.account.companyName},
                phone = ${config.account.phone},
                role = 'user',
                stripe_customer_id = NULL,
                subscription_status = ${config.account.subscriptionStatus},
                subscription_id = NULL,
                subscription_ends_at = NULL,
                onboarding_completed_at = COALESCE(onboarding_completed_at, NOW()),
                notification_preferences = ${JSON.stringify(config.account.notificationPreferences)}::jsonb,
                updated_at = NOW()
            WHERE id = ${account.id}
            RETURNING *
        `);
    }

    const duplicateAccountIds = existingAccounts
        .filter((candidate) => candidate.id !== account.id)
        .map((candidate) => candidate.id);

    let organization = await getSingle(sql, sql`
        SELECT *
        FROM organizations
        WHERE slug = ${config.organization.slug}
        LIMIT 1
    `);

    if (!organization) {
        organization = await getSingle(sql, sql`
            INSERT INTO organizations (
                name,
                slug,
                logo_url,
                stripe_customer_id,
                subscription_status,
                subscription_id,
                subscription_ends_at,
                seat_quantity
            ) VALUES (
                ${config.organization.name},
                ${config.organization.slug},
                ${config.brand.logoUrl},
                NULL,
                ${config.organization.subscriptionStatus},
                NULL,
                NULL,
                ${config.organization.seatQuantity}
            )
            RETURNING *
        `);
    } else {
        organization = await getSingle(sql, sql`
            UPDATE organizations
            SET
                name = ${config.organization.name},
                logo_url = ${config.brand.logoUrl},
                stripe_customer_id = NULL,
                subscription_status = ${config.organization.subscriptionStatus},
                subscription_id = NULL,
                subscription_ends_at = NULL,
                seat_quantity = ${config.organization.seatQuantity},
                updated_at = NOW()
            WHERE id = ${organization.id}
            RETURNING *
        `);
    }

    if (duplicateAccountIds.length > 0) {
        const duplicateRequestIds = await sql`
            SELECT id
            FROM requests
            WHERE account_id = ANY(${duplicateAccountIds}::uuid[])
        `;
        if (duplicateRequestIds.length > 0) {
            const ids = duplicateRequestIds.map((row) => row.id);
            await sql`DELETE FROM utility_entries WHERE request_id = ANY(${ids}::uuid[])`;
            await sql`DELETE FROM event_logs WHERE request_id = ANY(${ids}::uuid[])`;
            await sql`DELETE FROM requests WHERE id = ANY(${ids}::uuid[])`;
        }

        await sql`DELETE FROM intake_links WHERE account_id = ANY(${duplicateAccountIds}::uuid[])`;
        await sql`DELETE FROM brand_profiles WHERE account_id = ANY(${duplicateAccountIds}::uuid[])`;
        await sql`DELETE FROM organization_members WHERE account_id = ANY(${duplicateAccountIds}::uuid[])`;
        await sql`DELETE FROM accounts WHERE id = ANY(${duplicateAccountIds}::uuid[])`;
    }

    const throwawayOrgSlugs = ['demo-tc'];
    await sql`
        DELETE FROM organization_members
        WHERE account_id = ${account.id}
            AND organization_id IN (
                SELECT id
                FROM organizations
                WHERE id != ${organization.id}
                    AND slug = ANY(${throwawayOrgSlugs}::text[])
            )
    `;

    await sql`
        DELETE FROM organizations o
        WHERE o.id != ${organization.id}
            AND o.slug = ANY(${throwawayOrgSlugs}::text[])
            AND NOT EXISTS (
                SELECT 1
                FROM organization_members om
                WHERE om.organization_id = o.id
            )
    `;

    await sql`
        INSERT INTO organization_members (organization_id, account_id, role)
        VALUES (${organization.id}, ${account.id}, 'admin')
        ON CONFLICT (organization_id, account_id)
        DO UPDATE SET role = 'admin'
    `;

    account = await getSingle(sql, sql`
        UPDATE accounts
        SET active_organization_id = ${organization.id}, updated_at = NOW()
        WHERE id = ${account.id}
        RETURNING *
    `);

    await ensureNoSlugCollision(sql, config, account.id);

    const existingRequestIds = await sql`
        SELECT id
        FROM requests
        WHERE account_id = ${account.id}
            OR organization_id = ${organization.id}
    `;
    if (existingRequestIds.length > 0) {
        const ids = existingRequestIds.map((row) => row.id);
        await sql`DELETE FROM utility_entries WHERE request_id = ANY(${ids}::uuid[])`;
        await sql`DELETE FROM event_logs WHERE request_id = ANY(${ids}::uuid[])`;
        await sql`DELETE FROM requests WHERE id = ANY(${ids}::uuid[])`;
    }

    await sql`DELETE FROM brand_profiles WHERE organization_id = ${organization.id}`;

    const brand = await getSingle(sql, sql`
        INSERT INTO brand_profiles (
            account_id,
            organization_id,
            name,
            logo_url,
            primary_color,
            secondary_color,
            contact_name,
            contact_phone,
            contact_email,
            contact_website,
            disclaimer_text,
            message_templates,
            is_default,
            buyer_next_steps,
            next_steps_title,
            show_powered_by,
            show_generation_date,
            welcome_message
        ) VALUES (
            ${account.id},
            ${organization.id},
            ${config.brand.name},
            ${config.brand.logoUrl},
            ${config.brand.primaryColor},
            ${config.brand.secondaryColor},
            ${config.brand.contactName},
            ${config.brand.contactPhone},
            ${config.brand.contactEmail},
            ${config.brand.contactWebsite},
            ${config.brand.disclaimerText},
            '{}'::jsonb,
            TRUE,
            ${JSON.stringify(config.brand.buyerNextSteps)}::jsonb,
            ${config.brand.nextStepsTitle},
            FALSE,
            TRUE,
            ${config.brand.welcomeMessage}
        )
        RETURNING *
    `);

    const existingIntake = await getSingle(sql, sql`
        SELECT *
        FROM intake_links
        WHERE account_id = ${account.id}
        LIMIT 1
    `);

    const intakeLink = existingIntake
        ? await getSingle(sql, sql`
            UPDATE intake_links
            SET
                slug = ${config.intakeLink.slug},
                is_active = TRUE,
                default_packet_mode = ${config.intakeLink.defaultPacketMode},
                advanced_modules = ${config.intakeLink.advancedModules}::text[],
                advanced_module_exclusions = ${JSON.stringify(config.intakeLink.advancedModuleExclusions)}::jsonb,
                updated_at = NOW()
            WHERE id = ${existingIntake.id}
            RETURNING *
        `)
        : await getSingle(sql, sql`
            INSERT INTO intake_links (
                account_id,
                slug,
                is_active,
                default_packet_mode,
                advanced_modules,
                advanced_module_exclusions
            ) VALUES (
                ${account.id},
                ${config.intakeLink.slug},
                TRUE,
                ${config.intakeLink.defaultPacketMode},
                ${config.intakeLink.advancedModules}::text[],
                ${JSON.stringify(config.intakeLink.advancedModuleExclusions)}::jsonb
            )
            RETURNING *
        `);

    const request = await getSingle(sql, sql`
        INSERT INTO requests (
            account_id,
            organization_id,
            brand_profile_id,
            property_address,
            property_address_structured,
            seller_name,
            seller_email,
            seller_phone,
            closing_date,
            status,
            packet_mode,
            public_token,
            seller_token,
            utility_categories,
            water_source,
            sewer_type,
            heating_type,
            is_demo,
            metered_at,
            last_activity_at
        ) VALUES (
            ${account.id},
            ${organization.id},
            ${brand.id},
            ${config.sampleRequest.propertyAddress},
            ${JSON.stringify(config.sampleRequest.propertyAddressStructured)}::jsonb,
            ${config.sampleRequest.sellerName},
            ${config.sampleRequest.sellerEmail},
            ${config.sampleRequest.sellerPhone},
            ${config.sampleRequest.closingDate},
            'submitted',
            'simple',
            ${token()},
            ${token()},
            ${config.sampleRequest.utilityCategories}::text[],
            ${config.sampleRequest.waterSource},
            ${config.sampleRequest.sewerType},
            ${config.sampleRequest.heatingType},
            TRUE,
            NOW(),
            NOW()
        )
        RETURNING *
    `);

    for (const utility of config.sampleUtilities) {
        await sql`
            INSERT INTO utility_entries (
                request_id,
                category,
                entry_mode,
                display_name,
                raw_text,
                contact_phone,
                contact_url,
                meter_number,
                extra
            ) VALUES (
                ${request.id},
                ${utility.category},
                'free_text',
                ${utility.displayName},
                ${utility.displayName},
                ${utility.contactPhone || null},
                ${utility.contactUrl || null},
                ${utility.meterNumber || null},
                ${JSON.stringify(utility.extra || {})}::jsonb
            )
        `;
    }

    await sql`
        INSERT INTO event_logs (request_id, event_type, event_data)
        VALUES
            (${request.id}, 'request_created', ${JSON.stringify({ actor: 'seller', source: 'demo_seed', slug: config.intakeLink.slug })}::jsonb),
            (${request.id}, 'seller_submitted', ${JSON.stringify({ actor: 'seller', source: 'demo_seed' })}::jsonb)
    `;

    return {
        account,
        organization,
        brand,
        intakeLink,
        request,
        sellerLinkUrl: config.intakeLink.url,
        dashboardUrl: `${config.appUrl}/dashboard`,
        pdfUrl: `${config.appUrl}/packet/${request.public_token}/pdf`,
        packetUrl: `${config.appUrl}/packet/${request.public_token}`,
    };
}

function printHelp() {
    console.log(`
UtilitySheet demo seed/reset

Usage:
  npm run demo:reset

Environment:
  DATABASE_URL             Required. Also loaded from .env.local or .env.
  NEXT_PUBLIC_APP_URL      Used to print URLs. Defaults to http://localhost:3000.
  DEMO_APP_URL             Optional override for printed demo URLs.
  DEMO_ACCOUNT_EMAIL       Optional demo login email. Defaults to ${DEFAULT_DEMO_EMAIL}.
  DEMO_AUTH_USER_ID        Optional Stack auth user id. If omitted, the account is claimable by matching email.

Notes:
  This script only resets data for the configured demo email and the "${DEMO_ORGANIZATION_SLUG}" workspace.
  It sets Team access internally and leaves Stripe customer/subscription fields null.
`);
}

async function main() {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        printHelp();
        return;
    }

    loadLocalEnv();
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required. Add it to .env.local or set it in the shell before running demo:reset.');
    }

    const sql = neon(process.env.DATABASE_URL);
    const config = buildDemoSeedConfig();
    const result = await resetDemo(sql, config);

    console.log('UtilitySheet demo environment reset successfully.');
    console.log(`Demo email: ${config.account.email}`);
    console.log(`Demo workspace: ${config.organization.name}`);
    console.log(`Demo plan: Team`);
    console.log(`Reusable seller link: ${result.sellerLinkUrl}`);
    console.log(`Dashboard: ${result.dashboardUrl}`);
    console.log(`Sample request: ${result.dashboardUrl}/requests/${result.request.id}`);
    console.log(`Sample packet: ${result.packetUrl}`);
    console.log(`Sample PDF: ${result.pdfUrl}`);
    console.log('Stripe fields: null customer/subscription ids; no Stripe API calls were made.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    });
}

import { NextResponse } from 'next/server';
import {
    getAccountOrganizations,
    getBrandProfiles,
    getOrCreateIntakeLink,
    normalizeIntakeUtilityCategories,
    propagateAdvancedModuleDefaultsToOpenRequests,
    updateIntakeLinkPacketDefaults,
    updateIntakeLinkSellerFormDefaults,
    updateIntakeLinkSlug,
} from '@/lib/neon/queries';
import type { IntakeLink } from '@/lib/neon/queries/intake-links';
import { PACKET_MODE_LABELS, normalizeAdvancedModuleExclusions, normalizeAdvancedModules } from '@/lib/packet/modules';
import { stackServerApp } from '@/lib/stack/server';
import type { AdvancedModuleExclusions, AdvancedModuleKey, PacketMode } from '@/types';
import { ensureAccountActivation } from '@/lib/activation/ensure-account-activation';
import { intakeLinkUpdateBodySchema } from '@/lib/validation/schemas';
import { invalidRequestBodyResponse } from '@/lib/security/api-response';

type OrganizationSummary = { id: string; subscription_status?: string | null };

function getAppBaseUrl() {
    return (
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
        'http://localhost:3000'
    );
}

function canCustomizeSlug(subscriptionStatus: string, activeOrgStatus?: string | null) {
    if (subscriptionStatus === 'pro') return true;
    if (activeOrgStatus === 'team') return true;
    return false;
}

function serializeIntakeLink(intakeLink: IntakeLink, allowedBrandProfileIds?: Set<string>) {
    const advancedModules = normalizeAdvancedModules(intakeLink.advanced_modules);
    const advancedModuleExclusions = normalizeAdvancedModuleExclusions(
        intakeLink.advanced_module_exclusions,
        advancedModules
    );
    const baseUrl = getAppBaseUrl();

    return {
        slug: intakeLink.slug,
        url: `${baseUrl}/i/${intakeLink.slug}`,
        is_active: intakeLink.is_active,
        defaultBrandProfileId: intakeLink.default_brand_profile_id
            && (!allowedBrandProfileIds || allowedBrandProfileIds.has(intakeLink.default_brand_profile_id))
            ? intakeLink.default_brand_profile_id
            : null,
        defaultUtilityCategories: normalizeIntakeUtilityCategories(intakeLink.default_utility_categories),
        defaultPacketMode: intakeLink.default_packet_mode || 'simple',
        advancedModules,
        advancedModuleExclusions,
    };
}

export async function GET() {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const activationState = await ensureAccountActivation(user);
        if (!activationState) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }
        const { account, activeOrganization } = activationState;

        const intakeLink = await getOrCreateIntakeLink(account.id);
        if (!intakeLink) {
            return NextResponse.json({ error: 'Failed to load intake link' }, { status: 500 });
        }

        const organizations = await getAccountOrganizations(account.id);
        const activeOrg = activeOrganization ||
            (organizations as OrganizationSummary[]).find((o) => o.id === account.active_organization_id) ||
            null;

        const canCustomize = canCustomizeSlug(account.subscription_status, activeOrg?.subscription_status);
        const brandProfiles = await getBrandProfiles(account.id, activeOrg?.id);
        const allowedBrandProfileIds = new Set(brandProfiles.map((profile) => profile.id));

        return NextResponse.json({
            intakeLink: serializeIntakeLink(intakeLink, allowedBrandProfileIds),
            brandProfiles: brandProfiles.map((profile) => ({
                id: profile.id,
                name: profile.name,
                isDefault: profile.is_default,
            })),
            canCustomize,
            companyName: account.company_name || '',
        });
    } catch (error) {
        console.error('Error fetching intake link:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const activationState = await ensureAccountActivation(user);
        if (!activationState) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }
        const { account, activeOrganization } = activationState;

        const organizations = await getAccountOrganizations(account.id);
        const activeOrg = activeOrganization ||
            (organizations as OrganizationSummary[]).find((o) => o.id === account.active_organization_id) ||
            null;

        const allowed = canCustomizeSlug(account.subscription_status, activeOrg?.subscription_status);

        const body = await request.json().catch(() => ({}));
        const parsedBody = intakeLinkUpdateBodySchema.safeParse(body);
        if (!parsedBody.success) {
            return invalidRequestBodyResponse('INVALID_INTAKE_LINK_UPDATE', 'Invalid seller form settings');
        }
        const payload = parsedBody.data;
        const slug = payload.slug || '';
        const defaultPacketMode = payload.defaultPacketMode as PacketMode | undefined;
        const hasIsActivePayload = Object.prototype.hasOwnProperty.call(payload, 'isActive');
        const hasDefaultBrandProfilePayload = Object.prototype.hasOwnProperty.call(payload, 'defaultBrandProfileId');
        const hasDefaultUtilityCategoriesPayload = Object.prototype.hasOwnProperty.call(payload, 'defaultUtilityCategories');
        const hasAdvancedModulesPayload = Object.prototype.hasOwnProperty.call(payload, 'advancedModules');
        const hasAdvancedModuleExclusionsPayload = Object.prototype.hasOwnProperty.call(payload, 'advancedModuleExclusions');
        const advancedModulesInput = payload.advancedModules;
        const advancedModuleExclusionsInput = payload.advancedModuleExclusions;
        const isModeUpdate = defaultPacketMode === 'simple' || defaultPacketMode === 'advanced';
        const isSlugUpdate = slug.length > 0;
        const isSellerFormDefaultsUpdate = hasIsActivePayload
            || hasDefaultBrandProfilePayload
            || hasDefaultUtilityCategoriesPayload;
        const isPacketDefaultsUpdate = isModeUpdate || hasAdvancedModulesPayload || hasAdvancedModuleExclusionsPayload;

        if (!isPacketDefaultsUpdate && !isSlugUpdate && !isSellerFormDefaultsUpdate) {
            return NextResponse.json(
                { error: 'Invalid request', message: 'Provide at least one seller form setting.' },
                { status: 400 }
            );
        }

        let updated = await getOrCreateIntakeLink(account.id);
        if (!updated) {
            return NextResponse.json({ error: 'Failed to load intake link' }, { status: 500 });
        }

        if (isSlugUpdate) {
            if (!allowed) {
                return NextResponse.json(
                    { error: 'Upgrade required', message: 'Custom branded links are available on Pro and Teams.' },
                    { status: 403 }
                );
            }
            updated = await updateIntakeLinkSlug(account.id, slug);
            if (!updated) {
                return NextResponse.json({ error: 'Failed to update intake link slug' }, { status: 500 });
            }
        }

        if (isSellerFormDefaultsUpdate) {
            if (hasDefaultBrandProfilePayload && payload.defaultBrandProfileId) {
                const profiles = await getBrandProfiles(account.id, activeOrg?.id);
                if (!profiles.some((profile) => profile.id === payload.defaultBrandProfileId)) {
                    return NextResponse.json(
                        { error: 'Invalid Branding Profile', message: 'Choose a Branding Profile from the active workspace.' },
                        { status: 400 }
                    );
                }
            }

            updated = await updateIntakeLinkSellerFormDefaults(account.id, {
                isActive: hasIsActivePayload ? Boolean(payload.isActive) : updated.is_active,
                defaultBrandProfileId: hasDefaultBrandProfilePayload
                    ? (payload.defaultBrandProfileId || null)
                    : (updated.default_brand_profile_id || null),
                defaultUtilityCategories: hasDefaultUtilityCategoriesPayload
                    ? normalizeIntakeUtilityCategories(payload.defaultUtilityCategories)
                    : normalizeIntakeUtilityCategories(updated.default_utility_categories),
            });
            if (!updated) {
                return NextResponse.json({ error: 'Failed to update seller form defaults' }, { status: 500 });
            }
        }

        if (isModeUpdate) {
            if (defaultPacketMode === 'advanced' && !allowed) {
                return NextResponse.json(
                    {
                        error: 'Upgrade required',
                        message: `${PACKET_MODE_LABELS.advanced} default mode is available on Pro and Teams.`,
                    },
                    { status: 403 }
                );
            }
        }

        if (hasAdvancedModulesPayload && !allowed) {
            return NextResponse.json(
                {
                    error: 'Upgrade required',
                    message: 'Handoff section defaults are available on Pro and Teams.',
                },
                { status: 403 }
            );
        }
        if (hasAdvancedModuleExclusionsPayload && !allowed) {
            return NextResponse.json(
                {
                    error: 'Upgrade required',
                    message: 'Handoff question selections are available on Pro and Teams.',
                },
                { status: 403 }
            );
        }

        if (isPacketDefaultsUpdate) {
            const nextDefaultPacketMode: PacketMode = isModeUpdate
                ? (defaultPacketMode === 'advanced' ? 'advanced' : 'simple')
                : (updated.default_packet_mode === 'advanced' ? 'advanced' : 'simple');
            const currentModules: AdvancedModuleKey[] = normalizeAdvancedModules(updated.advanced_modules);
            const currentExclusions: AdvancedModuleExclusions = normalizeAdvancedModuleExclusions(
                updated.advanced_module_exclusions,
                currentModules
            );
            const nextAdvancedModules: AdvancedModuleKey[] = hasAdvancedModulesPayload
                ? normalizeAdvancedModules(advancedModulesInput)
                : currentModules;
            const nextAdvancedModuleExclusions: AdvancedModuleExclusions = hasAdvancedModuleExclusionsPayload
                ? normalizeAdvancedModuleExclusions(advancedModuleExclusionsInput, nextAdvancedModules)
                : normalizeAdvancedModuleExclusions(currentExclusions, nextAdvancedModules);
            updated = await updateIntakeLinkPacketDefaults(account.id, {
                defaultPacketMode: nextDefaultPacketMode,
                advancedModules: nextAdvancedModules,
                advancedModuleExclusions: nextAdvancedModuleExclusions,
            });
            if (!updated) {
                return NextResponse.json({ error: 'Failed to update intake packet defaults' }, { status: 500 });
            }

            if (hasAdvancedModulesPayload || hasAdvancedModuleExclusionsPayload) {
                await propagateAdvancedModuleDefaultsToOpenRequests(account.id, activeOrg?.id, {
                    advancedModules: nextAdvancedModules,
                    advancedModuleExclusions: nextAdvancedModuleExclusions,
                });
            }
        }

        const responseBrandProfiles = await getBrandProfiles(account.id, activeOrg?.id);
        return NextResponse.json({
            intakeLink: serializeIntakeLink(
                updated,
                new Set(responseBrandProfiles.map((profile) => profile.id))
            ),
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        const status = message.toLowerCase().includes('slug') ? 400 : 500;
        if (status === 400) {
            return NextResponse.json(
                { error: 'Invalid slug', code: 'INVALID_SLUG' },
                { status }
            );
        }
        console.error('Error updating intake link:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

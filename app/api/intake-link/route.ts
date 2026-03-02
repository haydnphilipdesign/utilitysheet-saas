import { NextResponse } from 'next/server';
import {
    getOrCreateAccount,
    getAccountOrganizations,
    getOrCreateIntakeLink,
    propagateAdvancedModuleDefaultsToOpenRequests,
    updateIntakeLinkPacketDefaults,
    updateIntakeLinkSlug,
} from '@/lib/neon/queries';
import { normalizeAdvancedModuleExclusions, normalizeAdvancedModules } from '@/lib/packet/modules';
import { stackServerApp } from '@/lib/stack/server';
import type { AdvancedModuleExclusions, AdvancedModuleKey, PacketMode } from '@/types';

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

export async function GET() {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const account = await getOrCreateAccount(user.id, user.primaryEmail || '', user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        const intakeLink = await getOrCreateIntakeLink(account.id);
        if (!intakeLink) {
            return NextResponse.json({ error: 'Failed to load intake link' }, { status: 500 });
        }

        const organizations = await getAccountOrganizations(account.id);
        const activeOrg = (organizations as OrganizationSummary[]).find((o) => o.id === account.active_organization_id) || null;

        const baseUrl = getAppBaseUrl();
        const url = `${baseUrl}/i/${intakeLink.slug}`;
        const canCustomize = canCustomizeSlug(account.subscription_status, activeOrg?.subscription_status);
        const advancedModules = normalizeAdvancedModules(intakeLink.advanced_modules);
        const advancedModuleExclusions = normalizeAdvancedModuleExclusions(
            intakeLink.advanced_module_exclusions,
            advancedModules
        );

        return NextResponse.json({
            intakeLink: {
                slug: intakeLink.slug,
                url,
                is_active: intakeLink.is_active,
                defaultPacketMode: intakeLink.default_packet_mode || 'simple',
                advancedModules,
                advancedModuleExclusions,
            },
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

        const account = await getOrCreateAccount(user.id, user.primaryEmail || '', user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        const organizations = await getAccountOrganizations(account.id);
        const activeOrg = (organizations as OrganizationSummary[]).find((o) => o.id === account.active_organization_id) || null;

        const allowed = canCustomizeSlug(account.subscription_status, activeOrg?.subscription_status);

        const body = await request.json().catch(() => ({}));
        const slug = typeof body?.slug === 'string' ? body.slug.trim() : '';
        const defaultPacketMode = body?.defaultPacketMode as PacketMode | undefined;
        const hasAdvancedModulesPayload = Object.prototype.hasOwnProperty.call(body || {}, 'advancedModules');
        const hasAdvancedModuleExclusionsPayload = Object.prototype.hasOwnProperty.call(body || {}, 'advancedModuleExclusions');
        const advancedModulesInput = Array.isArray(body?.advancedModules)
            ? body.advancedModules.filter((candidate: unknown): candidate is string => typeof candidate === 'string')
            : undefined;
        const advancedModuleExclusionsInput = body?.advancedModuleExclusions;
        const isModeUpdate = defaultPacketMode === 'simple' || defaultPacketMode === 'advanced';
        const isSlugUpdate = slug.length > 0;
        const isPacketDefaultsUpdate = isModeUpdate || hasAdvancedModulesPayload || hasAdvancedModuleExclusionsPayload;

        if (!isPacketDefaultsUpdate && !isSlugUpdate) {
            return NextResponse.json(
                { error: 'Invalid request', message: 'Provide a slug, defaultPacketMode, advancedModules, and/or advancedModuleExclusions.' },
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

        if (isModeUpdate) {
            if (defaultPacketMode === 'advanced' && !allowed) {
                return NextResponse.json(
                    {
                        error: 'Upgrade required',
                        message: 'Advanced Utility Packet default mode is available on Pro and Teams.',
                    },
                    { status: 403 }
                );
            }
        }

        if (hasAdvancedModulesPayload && !allowed) {
            return NextResponse.json(
                {
                    error: 'Upgrade required',
                    message: 'Advanced module defaults are available on Pro and Teams.',
                },
                { status: 403 }
            );
        }
        if (hasAdvancedModuleExclusionsPayload && !allowed) {
            return NextResponse.json(
                {
                    error: 'Upgrade required',
                    message: 'Advanced module field exclusions are available on Pro and Teams.',
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

        const baseUrl = getAppBaseUrl();
        const url = `${baseUrl}/i/${updated.slug}`;
        const advancedModules = normalizeAdvancedModules(updated.advanced_modules);
        const advancedModuleExclusions = normalizeAdvancedModuleExclusions(
            updated.advanced_module_exclusions,
            advancedModules
        );

        return NextResponse.json({
            intakeLink: {
                slug: updated.slug,
                url,
                is_active: updated.is_active,
                defaultPacketMode: updated.default_packet_mode || 'simple',
                advancedModules,
                advancedModuleExclusions,
            },
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

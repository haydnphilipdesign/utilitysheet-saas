import { NextResponse } from 'next/server';

import { buildStructuredPropertyAddress } from '@/lib/address/structured-address';
import { ensureAccountActivation } from '@/lib/activation/ensure-account-activation';
import { sendSellerNotificationEmail } from '@/lib/email/email-service';
import {
    createEventLog,
    getBrandProfile,
    getIntakeBrandProfile,
    getIntakeLinkByAccountId,
    getOrCreateTestDriveRequest,
    getTestDriveLifecycleEvents,
    getTestDriveRequestState,
} from '@/lib/neon/queries';
import { normalizeAdvancedModuleExclusions, normalizeAdvancedModules } from '@/lib/packet/modules';
import { checkRateLimit, getRateLimitHeaders, isRateLimitUnavailable, requestCreationRatelimit } from '@/lib/rate-limit';
import { stackServerApp } from '@/lib/stack/server';
import { buildTestDriveState, TEST_DRIVE_PROPERTY_ADDRESS, TEST_DRIVE_SELLER_NAME } from '@/lib/test-drive/service';
import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import type { Request as StoredRequest } from '@/types';

export const runtime = 'nodejs';

async function stateFor(request: StoredRequest | null, hasLiveSubmission: boolean) {
    const events = request ? await getTestDriveLifecycleEvents(request.id) : [];
    return buildTestDriveState({ request, hasLiveSubmission, events });
}

export async function GET() {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!user.primaryEmail) {
            return NextResponse.json(
                { error: 'Your account needs a verified email before you can start a test.' },
                { status: 400 }
            );
        }

        const activation = await ensureAccountActivation(user);
        if (!activation?.account) {
            return NextResponse.json({ error: 'Failed to access account' }, { status: 500 });
        }

        const current = await getTestDriveRequestState(activation.account.id);
        return NextResponse.json(await stateFor(current.request, current.hasLiveSubmission));
    } catch (error) {
        console.error('Error loading test drive:', error);
        return NextResponse.json({ error: 'Failed to load your test UtilitySheet.' }, { status: 500 });
    }
}

export async function POST(_request: Request) {
    void _request;
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const recipient = user.primaryEmail?.trim();
        if (!recipient) {
            return NextResponse.json(
                { error: 'Your account needs a verified email before you can start a test.' },
                { status: 400 }
            );
        }

        const rateLimitResult = await checkRateLimit(requestCreationRatelimit, `test-drive:${user.id}`, {
            requirePersistent: process.env.NODE_ENV === 'production',
        });
        if (isRateLimitUnavailable(rateLimitResult)) {
            return NextResponse.json(
                { error: 'Temporarily unavailable. Please try again shortly.' },
                { status: 503 }
            );
        }
        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Too many attempts. Please slow down.' },
                { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
            );
        }

        const activation = await ensureAccountActivation(user);
        if (!activation?.account) {
            return NextResponse.json({ error: 'Failed to access account' }, { status: 500 });
        }

        const { account, activeOrganization, defaultBrandProfile } = activation;
        const organizationId = activeOrganization?.id || account.active_organization_id || undefined;
        const intakeLink = await getIntakeLinkByAccountId(account.id);
        const brandProfile = await getIntakeBrandProfile(
            account.id,
            organizationId,
            intakeLink?.default_brand_profile_id
        ) || defaultBrandProfile;
        const isPaid = account.subscription_status === 'pro' || activeOrganization?.subscription_status === 'team';
        const packetMode = intakeLink?.default_packet_mode === 'advanced' && isPaid ? 'advanced' : 'simple';
        const advancedModules = packetMode === 'advanced'
            ? normalizeAdvancedModules(intakeLink?.advanced_modules || [])
            : [];
        const advancedModuleExclusions = packetMode === 'advanced'
            ? normalizeAdvancedModuleExclusions(intakeLink?.advanced_module_exclusions || {}, advancedModules)
            : {};
        const propertyAddressStructured = await buildStructuredPropertyAddress(TEST_DRIVE_PROPERTY_ADDRESS);

        const result = await getOrCreateTestDriveRequest({
            accountId: account.id,
            organizationId,
            brandProfileId: brandProfile?.id,
            propertyAddress: TEST_DRIVE_PROPERTY_ADDRESS,
            propertyAddressStructured,
            sellerName: TEST_DRIVE_SELLER_NAME,
            sellerEmail: recipient,
            utilityCategories: intakeLink?.default_utility_categories?.length
                ? intakeLink.default_utility_categories
                : [...UTILITY_CATEGORY_KEYS],
            packetMode,
            advancedModules,
            advancedModuleExclusions,
        });

        if (!result.request) {
            if (result.hasLiveSubmission) {
                return NextResponse.json({ status: 'ineligible', reason: 'live_submission' });
            }
            return NextResponse.json({ error: 'Failed to create your test UtilitySheet.' }, { status: 500 });
        }

        if (result.created) {
            try {
                await createEventLog({
                    requestId: result.request.id,
                    eventType: 'request_created',
                    eventData: {
                        actor: 'agent',
                        is_demo: true,
                        source: 'self_serve_test_drive',
                    },
                });
            } catch (eventError) {
                console.error('Failed to record test-drive creation:', eventError);
            }

            let invitationSucceeded = false;
            try {
                const resolvedBrandProfile = result.request.brand_profile_id
                    ? await getBrandProfile(result.request.brand_profile_id)
                    : brandProfile;
                const emailResult = await sendSellerNotificationEmail({
                    sellerEmail: recipient,
                    sellerName: TEST_DRIVE_SELLER_NAME,
                    propertyAddress: TEST_DRIVE_PROPERTY_ADDRESS,
                    agentName: resolvedBrandProfile?.contact_name || account.full_name || user.displayName || undefined,
                    brandProfile: resolvedBrandProfile || undefined,
                    sellerToken: result.request.seller_token || result.request.public_token,
                });
                invitationSucceeded = emailResult.success;
            } catch (emailError) {
                console.error('Failed to send test-drive invitation:', emailError);
            }

            try {
                await createEventLog({
                    requestId: result.request.id,
                    eventType: invitationSucceeded
                        ? 'test_drive_invitation_succeeded'
                        : 'test_drive_invitation_failed',
                    eventData: { recipient: 'authenticated_verified_email' },
                });
            } catch (eventError) {
                console.error('Failed to record test-drive invitation outcome:', eventError);
            }
        }

        return NextResponse.json(
            await stateFor(result.request, result.hasLiveSubmission),
            {
                status: result.created ? 201 : 200,
                headers: getRateLimitHeaders(rateLimitResult),
            }
        );
    } catch (error) {
        console.error('Error starting test drive:', error);
        return NextResponse.json({ error: 'Failed to start your test UtilitySheet.' }, { status: 500 });
    }
}

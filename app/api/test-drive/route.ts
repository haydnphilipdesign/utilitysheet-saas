import { auxiliaryEventWriter } from '@/lib/telemetry/auxiliary-events';
import { formRequestFields } from '@/lib/seller-forms/config';
import { NextResponse } from 'next/server';

import { buildStructuredPropertyAddress } from '@/lib/address/structured-address';
import { ensureAccountActivation } from '@/lib/activation/ensure-account-activation';
import { sendSellerNotificationEmail } from '@/lib/email/email-service';
import { recordHandoffEvidence } from '@/lib/neon/queries/handoff-evidence';
import { buildNotificationEvidence, type SettledSend } from '@/lib/telemetry/handoff-evidence';
import {
    createEventLog,
    getBrandProfile,
    getIntakeBrandProfile,
    getOrCreateIntakeLink,
    getOrCreateTestDriveRequest,
    getTestDriveLifecycleEvents,
    getTestDriveRequestState,
} from '@/lib/neon/queries';
import { normalizeAdvancedModuleExclusions, normalizeAdvancedModules } from '@/lib/packet/modules';
import { checkRateLimit, getRateLimitHeaders, isRateLimitUnavailable, requestCreationRatelimit } from '@/lib/rate-limit';
import { enforceMaxRequestBodyBytes, invalidRequestBodyResponse } from '@/lib/security/api-response';
import { stackServerApp } from '@/lib/stack/server';
import { testDriveAddressForArea } from '@/lib/test-drive/area';
import {
    buildTestDriveState,
    TEST_DRIVE_LIMIT,
    TEST_DRIVE_PROPERTY_ADDRESS,
    TEST_DRIVE_SELLER_NAME,
} from '@/lib/test-drive/service';
import { testDriveStartBodySchema } from '@/lib/validation/schemas';
import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import type { Request as StoredRequest } from '@/types';

const recordAuxiliaryEvent = auxiliaryEventWriter(createEventLog);
const TEST_DRIVE_BODY_LIMIT_BYTES = 2 * 1024;

export const runtime = 'nodejs';

async function stateFor(request: StoredRequest | null, hasLiveSubmission: boolean, testCount: number) {
    const events = request ? await getTestDriveLifecycleEvents(request.id) : [];
    return buildTestDriveState({ request, hasLiveSubmission, testCount, events });
}

export async function GET() {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!user.primaryEmail) {
            return NextResponse.json(
                { error: 'Verify your account email to use the seller test.' },
                { status: 400 }
            );
        }

        const activation = await ensureAccountActivation(user);
        if (!activation?.account) {
            return NextResponse.json({ error: 'Failed to access account' }, { status: 500 });
        }

        const current = await getTestDriveRequestState(activation.account.id);
        return NextResponse.json(await stateFor(current.request, current.hasLiveSubmission, current.testCount));
    } catch (error) {
        console.error('Error loading test drive:', error);
        return NextResponse.json({ error: 'We could not load your seller test. Please try again.' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const recipient = user.primaryEmail?.trim();
        if (!recipient) {
            return NextResponse.json(
                { error: 'Verify your account email to use the seller test.' },
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

        // No body (or no area) starts the test at the sample address. An area
        // starts a new test there, within the account's test limit.
        const payloadTooLarge = enforceMaxRequestBodyBytes(request, TEST_DRIVE_BODY_LIMIT_BYTES);
        if (payloadTooLarge) {
            return payloadTooLarge;
        }
        const rawBody = await request.text();
        let body: unknown = {};
        try {
            body = rawBody.trim() ? JSON.parse(rawBody) : {};
        } catch {
            body = null;
        }
        const parsedBody = testDriveStartBodySchema.safeParse(body);
        if (!parsedBody.success) {
            return invalidRequestBodyResponse();
        }
        const area = parsedBody.data.area?.trim() || '';
        let propertyAddress = TEST_DRIVE_PROPERTY_ADDRESS;
        if (area) {
            const areaResult = testDriveAddressForArea(area);
            if (!areaResult.ok) {
                return NextResponse.json({ error: areaResult.error, code: 'invalid_area' }, { status: 400 });
            }
            propertyAddress = areaResult.propertyAddress;
        }

        const activation = await ensureAccountActivation(user);
        if (!activation?.account) {
            return NextResponse.json({ error: 'Failed to access account' }, { status: 500 });
        }

        const { account, activeOrganization, defaultBrandProfile } = activation;
        const organizationId = activeOrganization?.id || undefined;
        const intakeLink = await getOrCreateIntakeLink(account.id, organizationId);
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
        const propertyAddressStructured = await buildStructuredPropertyAddress(propertyAddress);

        const result = await getOrCreateTestDriveRequest({
            ...(intakeLink ? formRequestFields(intakeLink, isPaid) : {}),
            accountId: account.id,
            organizationId,
            brandProfileId: brandProfile?.id,
            propertyAddress,
            propertyAddressStructured,
            sellerName: TEST_DRIVE_SELLER_NAME,
            sellerEmail: recipient,
            utilityCategories: intakeLink?.default_utility_categories?.length
                ? intakeLink.default_utility_categories
                : [...UTILITY_CATEGORY_KEYS],
            packetMode,
            advancedModules,
            advancedModuleExclusions,
            startAnother: Boolean(area),
            limit: TEST_DRIVE_LIMIT,
        });

        if (!result.request) {
            if (result.hasLiveSubmission) {
                return NextResponse.json({ status: 'ineligible', reason: 'live_submission' });
            }
            return NextResponse.json({ error: 'We could not start your seller test. Please try again.' }, { status: 500 });
        }

        if (area && !result.created && !result.hasLiveSubmission) {
            return NextResponse.json(
                { error: `You have used all ${TEST_DRIVE_LIMIT} seller tests.`, code: 'test_limit' },
                { status: 409 }
            );
        }

        if (result.created) {
            await recordAuxiliaryEvent({
                requestId: result.request.id,
                eventType: 'request_created',
                eventData: {
                    actor: 'agent',
                    is_demo: true,
                    source: 'self_serve_test_drive',
                    test_area: area ? 'custom' : 'sample',
                },
            });

            let invitationSucceeded = false;
            let invitation: SettledSend = { status: 'rejected' };
            try {
                const resolvedBrandProfile = result.request.brand_profile_id
                    ? await getBrandProfile(result.request.brand_profile_id)
                    : brandProfile;
                const emailResult = await sendSellerNotificationEmail({
                    sellerEmail: recipient,
                    sellerName: TEST_DRIVE_SELLER_NAME,
                    propertyAddress,
                    agentName: resolvedBrandProfile?.contact_name || account.full_name || user.displayName || undefined,
                    brandProfile: resolvedBrandProfile || undefined,
                    sellerToken: result.request.seller_token || result.request.public_token,
                });
                invitation = { status: 'fulfilled', value: emailResult };
                invitationSucceeded = emailResult.success;
            } catch (emailError) {
                console.error('Failed to send test-drive invitation:', emailError);
            }

            await Promise.all([
                recordAuxiliaryEvent({
                    requestId: result.request.id,
                    eventType: invitationSucceeded
                        ? 'test_drive_invitation_succeeded'
                        : 'test_drive_invitation_failed',
                    eventData: { recipient: 'authenticated_verified_email' },
                }),
                recordHandoffEvidence(buildNotificationEvidence({
                    operationId: crypto.randomUUID(),
                    requestId: result.request.id,
                    purpose: 'request_invitation',
                    mode: 'test',
                    sends: [invitation],
                })),
            ]);
        }

        return NextResponse.json(
            await stateFor(result.request, result.hasLiveSubmission, result.testCount),
            {
                status: result.created ? 201 : 200,
                headers: getRateLimitHeaders(rateLimitResult),
            }
        );
    } catch (error) {
        console.error('Error starting test drive:', error);
        return NextResponse.json({ error: 'We could not start your seller test. Please try again.' }, { status: 500 });
    }
}

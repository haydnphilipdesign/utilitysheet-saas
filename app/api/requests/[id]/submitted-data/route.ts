import { NextResponse } from 'next/server';
import {
    getOrCreateAccount,
    getRequestById,
    getUtilityEntriesByRequestId,
    updateSubmittedRequestData,
} from '@/lib/neon/queries';
import { stackServerApp } from '@/lib/stack/server';
import { canAccessOwnedOrActiveOrganizationResource, getAuthorizedActiveOrganization } from '@/lib/auth/organization-access';
import { buildStructuredPropertyAddress } from '@/lib/address/structured-address';
import {
    enforceMaxRequestBodyBytes,
    invalidRequestBodyResponse,
} from '@/lib/security/api-response';
import { submittedSheetUpdateBodySchema } from '@/lib/validation/schemas';
import {
    filterAdvancedPacketDataByExclusions,
    normalizeAdvancedModuleExclusions,
    normalizeAdvancedModules,
    normalizeConditionalAdvancedAnswers,
} from '@/lib/packet/modules';
import { normalizeHoaAnswers } from '@/lib/packet/hoa';
import { resolveRequestQuestionSettings } from '@/lib/requests/question-settings';
import {
    buildSubmittedSheetChangedFields,
    buildSubmittedSheetEditorPayload as buildSubmittedSheetResponse,
    buildSubmittedSheetUtilities,
    buildSubmittedSheetUtilityInsertRows,
    mergeAdvancedPacketDataPreservingExcluded,
    type SubmittedSheetEditableRequestRecord as EditableRequestRecord,
} from '@/lib/submitted-sheet/editor';
import { getClientIpOrNull } from '@/lib/network/client-ip';
import type { AdvancedPacketData, PacketMode } from '@/types';

const SUBMITTED_SHEET_MAX_BODY_BYTES = 96 * 1024;

async function getEditorContext(id: string) {
    const user = await stackServerApp.getUser();
    if (!user) {
        return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const account = await getOrCreateAccount(user.id, user.primaryEmail || '', user.displayName || undefined);
    if (!account) {
        return { response: NextResponse.json({ error: 'Failed to access account' }, { status: 500 }) };
    }

    const requestData = await getRequestById(id);
    if (!requestData) {
        return { response: NextResponse.json({ error: 'Request not found' }, { status: 404 }) };
    }

    if (!await canAccessOwnedOrActiveOrganizationResource(account, requestData)) {
        return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    const organization = await getAuthorizedActiveOrganization(account);
    const isPaid = account.subscription_status === 'pro' || organization?.subscription_status === 'team';

    if (!isPaid) {
        return {
            response: NextResponse.json(
                {
                    error: 'Upgrade required',
                    message: 'Editing a submitted sheet is part of Pro and Teams.',
                },
                { status: 403 }
            ),
        };
    }

    if (requestData.status !== 'submitted') {
        return {
            response: NextResponse.json(
                {
                    error: 'Submission required',
                    message: 'This request can only be edited after the seller has submitted it.',
                },
                { status: 409 }
            ),
        };
    }

    return {
        user,
        account,
        requestData: requestData as EditableRequestRecord,
    };
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const context = await getEditorContext(id);
        if (context.response) return context.response;

        const notificationPrefs = (context.account.notification_preferences || {}) as {
            collect_electric_meter_number?: boolean;
        };
        const { collectElectricMeterNumber } = resolveRequestQuestionSettings(context.requestData, notificationPrefs);
        const utilityEntries = await getUtilityEntriesByRequestId(id);

        return NextResponse.json(buildSubmittedSheetResponse({
            requestData: context.requestData,
            utilityEntries,
            collectElectricMeterNumber,
        }));
    } catch (error) {
        console.error('Error fetching submitted sheet editor data:', error);
        return NextResponse.json({ error: 'Failed to fetch submitted sheet data' }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const context = await getEditorContext(id);
        if (context.response) return context.response;

        const payloadTooLarge = enforceMaxRequestBodyBytes(request, SUBMITTED_SHEET_MAX_BODY_BYTES);
        if (payloadTooLarge) {
            return payloadTooLarge;
        }

        const body = await request.json().catch(() => ({}));
        const parsedBody = submittedSheetUpdateBodySchema.safeParse(body);
        if (!parsedBody.success) {
            return invalidRequestBodyResponse('INVALID_SUBMITTED_SHEET_UPDATE', 'Invalid submitted sheet payload');
        }

        const currentUtilityEntries = await getUtilityEntriesByRequestId(id);
        const currentUtilities = buildSubmittedSheetUtilities(
            context.requestData.utility_categories,
            currentUtilityEntries
        );

        const packetMode: PacketMode = context.requestData.packet_mode === 'advanced' ? 'advanced' : 'simple';
        const advancedModules = packetMode === 'advanced'
            ? normalizeAdvancedModules(context.requestData.advanced_modules || [])
            : [];
        const advancedModuleExclusions = packetMode === 'advanced'
            ? normalizeAdvancedModuleExclusions(
                context.requestData.advanced_module_exclusions || {},
                advancedModules
            )
            : {};

        // Normalized before the merge below, so stored excluded fields survive.
        const visibleAdvancedData = packetMode === 'advanced'
            ? normalizeConditionalAdvancedAnswers(
                filterAdvancedPacketDataByExclusions(
                    parsedBody.data.advanced || {},
                    advancedModules,
                    advancedModuleExclusions
                ),
                advancedModuleExclusions
            )
            : {};

        const nextAdvancedPacketData = packetMode === 'advanced'
            ? mergeAdvancedPacketDataPreservingExcluded({
                existingData: (context.requestData.advanced_packet_data || {}) as Record<string, unknown>,
                submittedVisibleData: visibleAdvancedData,
                enabledModules: advancedModules,
                exclusions: advancedModuleExclusions,
            })
            : {};

        // Absent when the editor tab predates the HOA questions; the stored
        // answers are then left alone.
        const nextHoa = parsedBody.data.hoa ? normalizeHoaAnswers(parsedBody.data.hoa) : undefined;

        const changedFields = buildSubmittedSheetChangedFields({
            existingPropertyAddress: context.requestData.property_address,
            nextPropertyAddress: parsedBody.data.propertyAddress,
            existingHomeBasics: {
                waterSource: context.requestData.water_source || null,
                sewerType: context.requestData.sewer_type || null,
                heatingType: context.requestData.heating_type || null,
            },
            nextHomeBasics: parsedBody.data.homeBasics,
            existingHoa: normalizeHoaAnswers(context.requestData),
            nextHoa,
            existingUtilities: currentUtilities,
            nextUtilities: parsedBody.data.utilities,
            existingAdvanced: (filterAdvancedPacketDataByExclusions(
                context.requestData.advanced_packet_data || {},
                advancedModules,
                advancedModuleExclusions
            ) || {}) as AdvancedPacketData,
            nextAdvanced: visibleAdvancedData as AdvancedPacketData,
            enabledModules: advancedModules,
            exclusions: advancedModuleExclusions,
        });

        const notificationPrefs = (context.account.notification_preferences || {}) as {
            collect_electric_meter_number?: boolean;
        };
        const { collectElectricMeterNumber } = resolveRequestQuestionSettings(context.requestData, notificationPrefs);

        if (changedFields.length === 0) {
            return NextResponse.json(buildSubmittedSheetResponse({
                requestData: context.requestData,
                utilityEntries: currentUtilityEntries,
                collectElectricMeterNumber,
            }));
        }

        const structuredAddress = await buildStructuredPropertyAddress(parsedBody.data.propertyAddress);
        const updated = await updateSubmittedRequestData(id, {
            expectedUpdatedAt: parsedBody.data.updatedAt,
            propertyAddress: parsedBody.data.propertyAddress,
            propertyAddressStructured: structuredAddress,
            homeBasics: parsedBody.data.homeBasics ?? null,
            hoa: nextHoa ?? null,
            advancedPacketData: nextAdvancedPacketData,
            utilityEntries: buildSubmittedSheetUtilityInsertRows(parsedBody.data.utilities),
            eventData: {
                actor: 'agent',
                editor_account_id: context.account.id,
                changed_fields: changedFields,
            },
            ipAddress: getClientIpOrNull(request),
            userAgent: request.headers.get('user-agent') || null,
        });

        if (!updated) {
            return NextResponse.json(
                {
                    error: 'Conflict',
                    message: 'Someone else changed this sheet. Reload to get the latest version before saving.',
                },
                { status: 409 }
            );
        }

        const refreshedEntries = await getUtilityEntriesByRequestId(id);

        return NextResponse.json(buildSubmittedSheetResponse({
            requestData: updated as EditableRequestRecord,
            utilityEntries: refreshedEntries,
            collectElectricMeterNumber,
        }));
    } catch (error) {
        console.error('Error updating submitted sheet editor data:', error);
        return NextResponse.json({ error: 'Failed to update submitted sheet data' }, { status: 500 });
    }
}

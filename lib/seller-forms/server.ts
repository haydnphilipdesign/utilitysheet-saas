import { NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/server';
import { ensureAccountActivation } from '@/lib/activation/ensure-account-activation';
import {
    getBrandProfiles,
    getOrCreateIntakeLink,
    getOrganizationMemberRole,
    getSellerForm,
    getSellerFormLinkScope,
    getUsableSellerForm,
    saveSellerForm,
} from '@/lib/neon/queries';
import type { IntakeLink } from '@/lib/neon/queries/intake-links';
import {
    formConfiguration,
    normalizeFormPatch,
    type SellerFormPatch,
} from './config';
import { getAdvancedModuleIncludedFieldCount } from '@/lib/packet/modules';
import { validateIntakeSlug } from '@/lib/neon/queries/intake-links';
import {
    appBaseUrl,
    SELLER_FORM_LINK_PREFIX,
    isValidLinkSuffix,
    sellerFormEndingPath,
    sellerFormLinkPath,
    type SellerFormLinkScope,
} from './links';

export async function sellerFormContext() {
    const user = await stackServerApp.getUser();
    if (!user)
        return {
            error: NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 },
            ),
        };
    const state = await ensureAccountActivation(user);
    if (
        !state ||
        state.account.role === 'banned' ||
        (state.account.closure_status &&
            state.account.closure_status !== 'active')
    ) {
        return {
            error: NextResponse.json({ error: 'Not found' }, { status: 404 }),
        };
    }
    const organizationId = state.activeOrganization?.id;
    const [brandProfiles, role] = await Promise.all([
        getBrandProfiles(state.account.id, organizationId),
        organizationId
            ? getOrganizationMemberRole(organizationId, state.account.id)
            : null,
    ]);
    return {
        state,
        organizationId,
        brandProfiles,
        // Read from the membership row, never from the client.
        isAdmin: role === 'admin',
        isTeams: state.activeOrganization?.subscription_status === 'team',
        isPaid:
            state.account.subscription_status === 'pro' ||
            state.activeOrganization?.subscription_status === 'team',
    };
}
export type FormContext = Exclude<
    Awaited<ReturnType<typeof sellerFormContext>>,
    { error: NextResponse }
>;

/** Link identity of the authenticated creator's current workspace. */
export function sellerFormLinks(context: FormContext) {
    return getSellerFormLinkScope(
        context.state.account.id,
        context.organizationId,
    );
}

/** Link identity of the form's creator, who owns its link names even when it is shared. */
export function creatorFormLinks(form: IntakeLink) {
    return getSellerFormLinkScope(form.account_id, form.organization_id);
}

/** The creator may always change their form; a shared form also by its owner and admins. */
export function canChangeForm(context: FormContext, form: IntakeLink) {
    const me = context.state.account.id;
    return (
        form.account_id === me ||
        (Boolean(form.shared_owner_account_id) &&
            (form.shared_owner_account_id === me || context.isAdmin))
    );
}

/** The shared base setting shown above the forms list. */
export function serializeLinkBase(links: SellerFormLinkScope | null) {
    if (!links) return null;
    return {
        slug: links.baseSlug,
        url: `${appBaseUrl()}${SELLER_FORM_LINK_PREFIX}/${links.baseSlug}`,
        revision: links.baseRevision,
        // The form the bare link opens: the default, not the owner of the name.
        formId: links.defaultFormId,
        formName: links.defaultFormName,
        isActive: links.defaultIsActive,
        reservedSuffixes: links.reserved,
    };
}

/**
 * `links` is required so no caller can publish a non-canonical URL by
 * accident. `slug` stays the form's own flat slug, never a nested path.
 */
export function serializeSellerForm(
    form: IntakeLink,
    links: SellerFormLinkScope | null,
    allowedBrandIds?: Set<string>,
    /** Without a viewer the form is serialized for its creator. */
    viewer?: FormContext,
) {
    const config = formConfiguration(form);
    const isMine = viewer ? form.account_id === viewer.state.account.id : true;
    const canEdit = viewer ? canChangeForm(viewer, form) : true;
    const endingPath = sellerFormEndingPath(form, links);
    if (
        config.defaultBrandProfileId &&
        allowedBrandIds &&
        !allowedBrandIds.has(config.defaultBrandProfileId)
    )
        config.defaultBrandProfileId = null;
    return {
        ...config,
        id: form.id,
        slug: form.slug,
        url: `${appBaseUrl()}${sellerFormLinkPath(form, links)}`,
        endingUrl: endingPath ? `${appBaseUrl()}${endingPath}` : null,
        linkSuffix: links?.suffixes[form.id] ?? null,
        revision: form.revision,
        organizationId: form.organization_id,
        // "Default" means the viewer's own default; a teammate's is theirs.
        isDefault: isMine && form.is_default,
        is_active: form.is_active,
        shared: Boolean(form.shared_owner_account_id),
        isMine,
        canEdit,
        // Only the creator shares; the default form cannot be deleted.
        canShare: isMine && Boolean(form.organization_id),
        canDelete: canEdit && !form.is_default,
        ownerName: form.owner_name ?? null,
    };
}

export async function validateFormPatch(
    context: FormContext,
    patch: SellerFormPatch,
    current?: IntakeLink,
    links?: SellerFormLinkScope | null,
) {
    if (patch.suffix !== undefined && !isValidLinkSuffix(patch.suffix))
        return NextResponse.json(
            {
                error: 'The end of the link must be 3 to 60 lowercase letters, numbers or dashes.',
                code: 'INVALID_SUFFIX',
            },
            { status: 400 },
        );
    if (patch.slug !== undefined) {
        try {
            validateIntakeSlug(patch.slug);
        } catch {
            return NextResponse.json(
                { error: 'Invalid slug', code: 'INVALID_SLUG' },
                { status: 400 },
            );
        }
    }
    if (
        !context.isPaid &&
        ((patch.slug !== undefined && patch.slug !== current?.slug) ||
            // Editing a published ending is paid; a new form's reviewed ending is not an edit.
            (current !== undefined &&
                patch.suffix !== undefined &&
                patch.suffix !== links?.suffixes[current.id]) ||
            (patch.defaultPacketMode === 'advanced' &&
                current?.default_packet_mode !== 'advanced') ||
            (patch.advancedModules !== undefined &&
                JSON.stringify(patch.advancedModules) !==
                    JSON.stringify(
                        current
                            ? formConfiguration(current).advancedModules
                            : undefined,
                    )) ||
            (patch.advancedModuleExclusions !== undefined &&
                JSON.stringify(patch.advancedModuleExclusions) !==
                    JSON.stringify(current?.advanced_module_exclusions)))
    ) {
        return NextResponse.json(
            {
                error: 'Upgrade required',
                message:
                    'Custom links and Handoff Packets are available on Pro and Teams.',
            },
            { status: 403 },
        );
    }
    const merged = {
        ...(current ? formConfiguration(current) : {}),
        ...normalizeFormPatch(patch, current),
    };
    if (
        merged.defaultPacketMode === 'advanced' &&
        (patch.advancedModules?.length === 0 ||
            !merged.advancedModules?.length ||
            merged.advancedModules.some(
                (key) =>
                    getAdvancedModuleIncludedFieldCount(
                        key,
                        merged.advancedModuleExclusions || {},
                    ) === 0,
            ))
    ) {
        return NextResponse.json(
            {
                error: 'Include at least one handoff section and a question in each enabled section.',
            },
            { status: 400 },
        );
    }
    if (
        patch.defaultBrandProfileId &&
        !context.brandProfiles.some((p) => p.id === patch.defaultBrandProfileId)
    ) {
        return NextResponse.json(
            {
                error: 'Invalid Branding Profile',
                message: 'Choose a Branding Profile from this workspace.',
            },
            { status: 400 },
        );
    }
    return null;
}

export async function saveDefaultForm(
    context: FormContext,
    patch: SellerFormPatch,
    expectedRevision?: number,
) {
    const form = await getOrCreateIntakeLink(
        context.state.account.id,
        context.organizationId,
    );
    if (!form)
        return NextResponse.json(
            { error: 'Workspace form unavailable during rollout' },
            { status: 409 },
        );
    const error = await validateFormPatch(
        context,
        patch,
        form,
        await sellerFormLinks(context),
    );
    if (error) return error;
    const saved = await saveSellerForm(
        context.state.account.id,
        context.organizationId,
        form.id,
        expectedRevision ?? form.revision,
        normalizeFormPatch(patch, form),
    );
    return saved
        ? NextResponse.json({
              intakeLink: serializeSellerForm(
                  saved,
                  await sellerFormLinks(context),
                  new Set(context.brandProfiles.map((p) => p.id)),
              ),
          })
        : NextResponse.json({ error: 'Not found' }, { status: 404 });
}
export async function ownedForm(context: FormContext, id: string) {
    if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            id,
        )
    )
        return null;
    return getSellerForm(id, context.state.account.id, context.organizationId);
}
const FORM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The caller's own form, or one shared with the active workspace. */
export async function usableForm(context: FormContext, id: string) {
    if (!FORM_ID.test(id)) return null;
    return getUsableSellerForm(
        id,
        context.state.account.id,
        context.organizationId,
    );
}

/** A usable form the caller may also change. Anything else reads as missing. */
export async function editableForm(context: FormContext, id: string) {
    const form = await usableForm(context, id);
    return form && canChangeForm(context, form) ? form : null;
}
export { formErrorResponse } from './errors';

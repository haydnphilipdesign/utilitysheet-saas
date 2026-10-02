import { NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/server';
import { ensureAccountActivation } from '@/lib/activation/ensure-account-activation';
import {
    getBrandProfiles,
    getOrCreateIntakeLink,
    getSellerForm,
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
    const brandProfiles = await getBrandProfiles(
        state.account.id,
        organizationId,
    );
    return {
        state,
        organizationId,
        brandProfiles,
        isPaid:
            state.account.subscription_status === 'pro' ||
            state.activeOrganization?.subscription_status === 'team',
    };
}
export type FormContext = Exclude<
    Awaited<ReturnType<typeof sellerFormContext>>,
    { error: NextResponse }
>;

export function serializeSellerForm(
    form: IntakeLink,
    allowedBrandIds?: Set<string>,
) {
    const base =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000');
    const config = formConfiguration(form);
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
        url: `${base}/i/${form.slug}`,
        revision: form.revision,
        organizationId: form.organization_id,
        isDefault: form.is_default,
        is_active: form.is_active,
    };
}

export async function validateFormPatch(
    context: FormContext,
    patch: SellerFormPatch,
    current?: IntakeLink,
) {
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
    const error = await validateFormPatch(context, patch, form);
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
export { formErrorResponse } from './errors';

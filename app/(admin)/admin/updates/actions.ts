'use server';

import { revalidatePath } from 'next/cache';
import {
    assertAdminActionConfirmed,
    assertAdminActionReason,
    assertAdminWritesEnabled,
    createAuditLogWithContext,
    requireAdmin,
} from '@/lib/admin';
import {
    createProductUpdate,
    deleteProductUpdate,
    publishProductUpdate,
} from '@/lib/neon/queries/updates';
import type { ProductUpdate, UpdateCategory } from '@/types';

type ProductUpdateActionResult =
    | { success: true; update: ProductUpdate }
    | { success: false; error: string };

type CreateProductUpdateInput = {
    title: string;
    body: string;
    category: UpdateCategory;
    reason: string;
};

type ConfirmedProductUpdateInput = {
    reason: string;
    confirmed: boolean;
};

function isUpdateCategory(value: string): value is UpdateCategory {
    return value === 'bugfix' || value === 'feature' || value === 'announcement';
}

function actionError(error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' } as const;
}

export async function createProductUpdateAdminAction(
    input: CreateProductUpdateInput
): Promise<ProductUpdateActionResult> {
    try {
        const { account } = await requireAdmin();
        assertAdminWritesEnabled();
        assertAdminActionReason(input.reason);

        const title = input.title.trim();
        const body = input.body.trim();
        const category = input.category;
        const reason = input.reason.trim();

        if (title.length < 3) return { success: false, error: 'Title must be at least 3 characters' };
        if (body.length < 3) return { success: false, error: 'Body must be at least 3 characters' };
        if (!isUpdateCategory(category)) return { success: false, error: 'Invalid category' };

        const created = await createProductUpdate({
            title,
            body,
            category,
            isPublished: false,
            createdBy: account.id,
        });

        if (!created) return { success: false, error: 'Failed to create update' };

        await createAuditLogWithContext({
            adminId: account.id,
            targetUserId: null,
            action: 'product_update_created',
            metadata: {
                reason,
                updateId: created.id,
                title: created.title,
                category: created.category,
                is_published: false,
            },
        });

        revalidatePath('/admin/updates');
        return { success: true, update: created };
    } catch (error) {
        return actionError(error);
    }
}

export async function publishProductUpdateAdminAction(
    updateId: string,
    input: ConfirmedProductUpdateInput
): Promise<ProductUpdateActionResult> {
    try {
        const { account } = await requireAdmin();
        assertAdminWritesEnabled();
        assertAdminActionReason(input.reason);
        assertAdminActionConfirmed(input.confirmed);

        const published = await publishProductUpdate(updateId);
        if (!published) {
            return { success: false, error: 'Update was not found or is already published' };
        }

        await createAuditLogWithContext({
            adminId: account.id,
            targetUserId: null,
            action: 'product_update_published',
            metadata: {
                reason: input.reason.trim(),
                updateId: published.id,
                title: published.title,
                category: published.category,
                publishedAt: published.published_at,
            },
        });

        revalidatePath('/admin/updates');
        return { success: true, update: published };
    } catch (error) {
        return actionError(error);
    }
}

export async function deleteProductUpdateAdminAction(
    updateId: string,
    input: ConfirmedProductUpdateInput
): Promise<ProductUpdateActionResult> {
    try {
        const { account } = await requireAdmin();
        assertAdminWritesEnabled();
        assertAdminActionReason(input.reason);
        assertAdminActionConfirmed(input.confirmed);

        const deleted = await deleteProductUpdate(updateId);
        if (!deleted) return { success: false, error: 'Update was not found or has already been deleted' };

        await createAuditLogWithContext({
            adminId: account.id,
            targetUserId: null,
            action: 'product_update_deleted',
            metadata: {
                reason: input.reason.trim(),
                updateId: deleted.id,
                title: deleted.title,
                category: deleted.category,
                wasPublished: deleted.is_published,
            },
        });

        revalidatePath('/admin/updates');
        return { success: true, update: deleted };
    } catch (error) {
        return actionError(error);
    }
}


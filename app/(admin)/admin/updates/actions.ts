'use server';

import { revalidatePath } from 'next/cache';
import {
    AdminActionRefusal,
    adminActionFailure,
    afterCommit,
    beginAdminWrite,
    type AdminActionFailure,
} from '@/lib/admin/action-guard';
import {
    createProductUpdateDraft,
    deleteProductUpdateAtomic,
    publishProductUpdateAtomic,
} from '@/lib/neon/queries/admin-writes';
import { adminConfirmedUpdateSchema, adminProductUpdateCreateSchema } from '@/lib/validation/admin-schemas';
import type { ProductUpdate } from '@/types';

type ProductUpdateActionResult =
    | { success: true; update: ProductUpdate; alreadyPublished?: boolean }
    | AdminActionFailure;

type CreateProductUpdateInput = {
    title: string;
    body: string;
    category: string;
    reason?: string;
};

type ConfirmedProductUpdateInput = {
    reason?: string;
    confirmed: boolean;
};

const refresh = (operation: string) => afterCommit(operation, () => revalidatePath('/admin/updates'));

/** The draft and its audit entry commit together. Publication is a separate action. */
export async function createProductUpdateAdminAction(
    input: CreateProductUpdateInput
): Promise<ProductUpdateActionResult> {
    try {
        const { actor } = await beginAdminWrite();
        const parsed = adminProductUpdateCreateSchema.parse(input);

        const result = await createProductUpdateDraft({
            actor,
            reason: parsed.reason,
            title: parsed.title,
            body: parsed.body,
            category: parsed.category,
        });
        if (result.outcome !== 'OK') throw new AdminActionRefusal('UNAUTHORIZED', 'Admin access required');

        refresh('product_update_create');
        return { success: true, update: result.update };
    } catch (error) {
        return adminActionFailure(error, 'product_update_create');
    }
}

export async function publishProductUpdateAdminAction(
    updateId: string,
    input: ConfirmedProductUpdateInput
): Promise<ProductUpdateActionResult> {
    try {
        const { actor } = await beginAdminWrite();
        const parsed = adminConfirmedUpdateSchema.parse({ updateId, ...input });

        const result = await publishProductUpdateAtomic({ actor, reason: parsed.reason, updateId: parsed.updateId });
        if (result.outcome === 'NOT_FOUND') {
            throw new AdminActionRefusal('NOT_FOUND', 'Update was not found. It may have been deleted.');
        }
        if (result.outcome === 'ACTOR_NOT_ADMIN') throw new AdminActionRefusal('UNAUTHORIZED', 'Admin access required');

        refresh('product_update_publish');
        // A repeat publication changes nothing and writes no second audit entry.
        return result.outcome === 'ALREADY_PUBLISHED'
            ? { success: true, update: result.update!, alreadyPublished: true }
            : { success: true, update: result.update! };
    } catch (error) {
        return adminActionFailure(error, 'product_update_publish');
    }
}

export async function deleteProductUpdateAdminAction(
    updateId: string,
    input: ConfirmedProductUpdateInput
): Promise<ProductUpdateActionResult> {
    try {
        const { actor } = await beginAdminWrite();
        const parsed = adminConfirmedUpdateSchema.parse({ updateId, ...input });

        const result = await deleteProductUpdateAtomic({ actor, reason: parsed.reason, updateId: parsed.updateId });
        if (result.outcome !== 'OK') {
            throw new AdminActionRefusal('NOT_FOUND', 'Update was not found or has already been deleted');
        }

        refresh('product_update_delete');
        return { success: true, update: result.update };
    } catch (error) {
        return adminActionFailure(error, 'product_update_delete');
    }
}

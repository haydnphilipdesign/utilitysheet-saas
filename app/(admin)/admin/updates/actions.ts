'use server';

import { redirect } from 'next/navigation';
import { assertAdminWritesEnabled, createAuditLogWithContext, requireAdmin } from '@/lib/admin';
import { createProductUpdate, deleteProductUpdate } from '@/lib/neon/queries/updates';
import type { UpdateCategory } from '@/types';

function isUpdateCategory(value: string): value is UpdateCategory {
    return value === 'bugfix' || value === 'feature' || value === 'announcement';
}

export async function createProductUpdateAdminAction(formData: FormData) {
    const { account } = await requireAdmin();
    assertAdminWritesEnabled();

    const title = String(formData.get('title') || '').trim();
    const body = String(formData.get('body') || '').trim();
    const categoryRaw = String(formData.get('category') || '').trim();
    const isPublished = formData.get('is_published') === 'on';

    if (title.length < 3) {
        throw new Error('Title must be at least 3 characters');
    }
    if (body.length < 3) {
        throw new Error('Body must be at least 3 characters');
    }
    if (!isUpdateCategory(categoryRaw)) {
        throw new Error('Invalid category');
    }

    const created = await createProductUpdate({
        title,
        body,
        category: categoryRaw,
        isPublished,
        createdBy: account.id,
    });

    if (!created) {
        throw new Error('Failed to create update');
    }

    await createAuditLogWithContext({
        adminId: account.id,
        targetUserId: null,
        action: 'product_update_created',
        metadata: {
            updateId: created.id,
            title: created.title,
            category: created.category,
            is_published: created.is_published,
        },
    });

    redirect('/admin/updates');
}

export async function deleteProductUpdateAdminAction(updateId: string) {
    const { account } = await requireAdmin();
    assertAdminWritesEnabled();

    const success = await deleteProductUpdate(updateId);
    if (!success) {
        throw new Error('Failed to delete update');
    }

    await createAuditLogWithContext({
        adminId: account.id,
        targetUserId: null,
        action: 'product_update_deleted',
        metadata: { updateId },
    });

    redirect('/admin/updates');
}


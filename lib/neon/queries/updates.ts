import { sql } from '@/lib/neon/db';
import type { ProductUpdate, UpdateCategory } from '@/types';

function clampInt(value: unknown, fallback: number, min: number, max: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export async function getProductUpdates(params: {
    limit?: number;
    offset?: number;
    includeUnpublished?: boolean;
} = {}): Promise<ProductUpdate[]> {
    if (!sql) return [];

    const limit = clampInt(params.limit, 10, 1, 50);
    const offset = clampInt(params.offset, 0, 0, 10_000);
    const includeUnpublished = params.includeUnpublished === true;

    const whereClause = includeUnpublished
        ? sql`TRUE`
        : sql`is_published = TRUE AND published_at <= NOW()`;

    const result = await sql`
        SELECT *
        FROM product_updates
        WHERE ${whereClause}
        ORDER BY published_at DESC, created_at DESC
        LIMIT ${limit} OFFSET ${offset}
    `;

    return result as unknown as ProductUpdate[];
}

export async function createProductUpdate(data: {
    title: string;
    body: string;
    category: UpdateCategory;
    isPublished?: boolean;
    publishedAt?: Date;
    createdBy?: string | null;
}): Promise<ProductUpdate | null> {
    if (!sql) return null;

    const isPublished = data.isPublished ?? false;
    const publishedAt = data.publishedAt ? data.publishedAt.toISOString() : null;

    const result = await sql`
        INSERT INTO product_updates (
            title,
            body,
            category,
            is_published,
            published_at,
            created_by
        ) VALUES (
            ${data.title},
            ${data.body},
            ${data.category},
            ${isPublished},
            COALESCE(${publishedAt}::timestamptz, NOW()),
            ${data.createdBy || null}::uuid
        )
        RETURNING *
    `;

    return (result[0] as ProductUpdate) || null;
}

export async function publishProductUpdate(id: string): Promise<ProductUpdate | null> {
    if (!sql) return null;

    const result = await sql`
        UPDATE product_updates
        SET
            is_published = TRUE,
            published_at = NOW()
        WHERE id = ${id}::uuid
            AND is_published = FALSE
        RETURNING *
    `;

    return (result[0] as ProductUpdate) || null;
}

export async function deleteProductUpdate(id: string): Promise<ProductUpdate | null> {
    if (!sql) return null;

    const result = await sql`
        DELETE FROM product_updates
        WHERE id = ${id}::uuid
        RETURNING *
    `;

    return (result[0] as ProductUpdate) || null;
}

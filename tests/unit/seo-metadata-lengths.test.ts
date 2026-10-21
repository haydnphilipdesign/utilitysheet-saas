import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import { describe, expect, it } from 'vitest';

import { siteConfig } from '@/lib/seo/site';

// Bing Webmaster Tools flags titles over 60 characters and descriptions
// outside 25-160 characters ("Title too long", "Meta Description too long or
// too short"). Google truncates around the same lengths.
const MAX_TITLE = 60;
const MIN_DESCRIPTION = 25;
const MAX_DESCRIPTION = 160;

function findPages(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) return findPages(full);
        return entry === 'page.tsx' ? [full] : [];
    });
}

function renderedTitle(title: Metadata['title']): string {
    if (typeof title === 'string') return `${title} | ${siteConfig.name}`;
    if (title && typeof title === 'object' && 'absolute' in title) return title.absolute;
    throw new Error('Page has no title');
}

const appDir = path.join(process.cwd(), 'app');
// /demo is a client page, so its metadata lives in its layout.
const pages = [...findPages(path.join(appDir, '(marketing)')), path.join(appDir, 'demo', 'layout.tsx')];

describe('public page metadata lengths', () => {
    it.each(pages.map((file) => [path.relative(appDir, file)]))('%s', async (relative) => {
        const { metadata } = (await import(/* @vite-ignore */ path.join(appDir, relative))) as { metadata?: Metadata };
        expect(metadata, 'page exports metadata').toBeDefined();

        const title = renderedTitle(metadata!.title);
        expect(title.length, title).toBeLessThanOrEqual(MAX_TITLE);

        const description = String(metadata!.description ?? '');
        expect(description.length, description).toBeGreaterThanOrEqual(MIN_DESCRIPTION);
        expect(description.length, description).toBeLessThanOrEqual(MAX_DESCRIPTION);
    }, 30_000);
});

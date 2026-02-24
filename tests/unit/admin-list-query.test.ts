import { describe, expect, it } from 'vitest';
import {
    buildAdminHref,
    clampPage,
    parseDirection,
    parsePage,
    parsePageSize,
    shouldCanonicalizePage,
} from '@/lib/admin/list-query';

describe('admin list query utilities', () => {
    it('parses page and pageSize safely', () => {
        expect(parsePage('2', 1)).toBe(2);
        expect(parsePage('0', 1)).toBe(1);
        expect(parsePage('abc', 1)).toBe(1);

        expect(parsePageSize('25', [25, 50, 100], 50)).toBe(25);
        expect(parsePageSize('10', [25, 50, 100], 50)).toBe(50);
    });

    it('parses sort direction safely', () => {
        expect(parseDirection('asc', 'desc')).toBe('asc');
        expect(parseDirection('desc', 'asc')).toBe('desc');
        expect(parseDirection('weird', 'asc')).toBe('asc');
    });

    it('clamps page to valid range', () => {
        expect(clampPage(3, 8)).toBe(3);
        expect(clampPage(0, 8)).toBe(1);
        expect(clampPage(50, 8)).toBe(8);
    });

    it('flags invalid canonical pagination states', () => {
        expect(
            shouldCanonicalizePage({
                rawPage: '0',
                rawPageSize: '50',
                page: 1,
                canonicalPage: 1,
                pageSize: 50,
            })
        ).toBe(true);

        expect(
            shouldCanonicalizePage({
                rawPage: '9',
                rawPageSize: '50',
                page: 9,
                canonicalPage: 4,
                pageSize: 50,
            })
        ).toBe(true);

        expect(
            shouldCanonicalizePage({
                rawPage: undefined,
                rawPageSize: undefined,
                page: 1,
                canonicalPage: 1,
                pageSize: 50,
            })
        ).toBe(false);
    });

    it('builds stable hrefs with sorted query keys', () => {
        const href = buildAdminHref('/admin/users', {
            q: 'anna',
            sort: 'created',
            dir: 'desc',
            page: 2,
            pageSize: 50,
        });
        expect(href).toBe('/admin/users?dir=desc&page=2&pageSize=50&q=anna&sort=created');
    });
});

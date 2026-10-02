// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Real, disposable embedded PostgreSQL. Never reads environment/database credentials.
const db = new PGlite();
const owner = '00000000-0000-4000-8000-000000000001';
const org = '00000000-0000-4000-8000-000000000002';
const other = '00000000-0000-4000-8000-000000000003';
let original: string;
let second: string;
const rows = async (sql: string, params: unknown[] = []) =>
    (await db.query<Record<string, unknown>>(sql, params)).rows;
const save = (
    id: string | null,
    revision: number | null,
    patch: object,
    slug = 'new-form',
) =>
    rows('SELECT * FROM save_seller_form($1,$2,$3,$4,$5::jsonb,$6,20,TRUE)', [
        owner,
        org,
        id,
        revision,
        JSON.stringify(patch),
        slug,
    ]);

beforeAll(async () => {
    await db.exec(`
        CREATE TABLE accounts(id UUID PRIMARY KEY, active_organization_id UUID, notification_preferences JSONB, role TEXT, closure_status TEXT, subscription_status TEXT DEFAULT 'pro');
        CREATE TABLE organizations(id UUID PRIMARY KEY, subscription_status TEXT DEFAULT 'free');
        CREATE TABLE organization_members(account_id UUID, organization_id UUID);
        CREATE TABLE brand_profiles(id UUID PRIMARY KEY, account_id UUID, organization_id UUID);
        CREATE TABLE requests(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID REFERENCES accounts(id), organization_id UUID REFERENCES organizations(id), is_demo BOOLEAN, collect_hoa_questions BOOLEAN, collect_electric_meter_number BOOLEAN);
        CREATE TABLE intake_links(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            slug TEXT UNIQUE NOT NULL, is_active BOOLEAN DEFAULT TRUE, default_brand_profile_id UUID,
            default_utility_categories TEXT[] DEFAULT ARRAY['electric','water'], default_packet_mode TEXT DEFAULT 'simple',
            advanced_modules TEXT[] DEFAULT '{}', advanced_module_exclusions JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), UNIQUE(account_id));
        INSERT INTO organizations VALUES ('${org}');
        INSERT INTO accounts VALUES ('${owner}', '${org}', '{"collect_hoa_questions":false}', 'user', 'active', 'pro'), ('${other}', NULL, '{}', 'user', 'active', 'pro');
        INSERT INTO organization_members VALUES ('${owner}', '${org}');
        INSERT INTO intake_links(account_id,slug,is_active) VALUES ('${owner}', 'original-link', FALSE);
    `);
    original = String((await rows('SELECT id FROM intake_links'))[0].id);
    await db.exec(
        readFileSync('migrations-saved-seller-forms-expand.sql', 'utf8'),
    );
}, 30000);
afterAll(async () => {
    await db.close();
});

describe.sequential(
    'saved form migrations and atomic PostgreSQL writers',
    () => {
        it('preserves identity, paused state, URL and preferences while pinning scope', async () => {
            expect((await rows('SELECT * FROM intake_links'))[0]).toMatchObject(
                {
                    id: original,
                    slug: 'original-link',
                    organization_id: org,
                    is_active: false,
                    is_default: true,
                    is_referral_identity: true,
                    collect_hoa_questions: false,
                    collect_electric_meter_number: true,
                },
            );
            expect(
                await rows('SELECT * FROM intake_link_aliases'),
            ).toHaveLength(1);
            expect(
                await rows('SELECT * FROM ensure_seller_form($1,NULL,$2,TRUE,20)', [
                    owner,
                    'personal-link',
                ]),
            ).toHaveLength(0);
            await expect(save(null, null, { name: 'Closing' })).rejects.toThrow(
                'Multiple forms',
            );
        });
        it('keeps old insert writers compatible and does not re-pin initialized links', async () => {
            await rows(
                'INSERT INTO intake_links(account_id,slug) VALUES ($1,$2)',
                [other, 'legacy-insert'],
            );
            expect(
                (
                    await rows(
                        'SELECT scope_initialized,organization_id FROM intake_links WHERE account_id=$1',
                        [other],
                    )
                )[0],
            ).toEqual({ scope_initialized: true, organization_id: null });
            await rows(
                'UPDATE accounts SET active_organization_id=NULL WHERE id=$1',
                [owner],
            );
            await db.exec(
                readFileSync(
                    'migrations-saved-seller-forms-expand.sql',
                    'utf8',
                ),
            );
            expect(
                (
                    await rows(
                        'SELECT organization_id FROM intake_links WHERE id=$1',
                        [original],
                    )
                )[0].organization_id,
            ).toBe(org);
        });
        it('enables independent forms and repairs/serializes default creation', async () => {
            await db.exec(
                readFileSync(
                    'migrations-saved-seller-forms-enable.sql',
                    'utf8',
                ),
            );
            second = String(
                (
                    await save(null, null, {
                        name: 'Closing',
                        collectHoaQuestions: true,
                    })
                )[0].id,
            );
            const results = await Promise.all([
                rows('SELECT * FROM ensure_seller_form($1,NULL,$2,TRUE,20)', [
                    owner,
                    'personal-link',
                ]),
                rows('SELECT * FROM ensure_seller_form($1,NULL,$2,TRUE,20)', [
                    owner,
                    'another-link',
                ]),
            ]);
            expect(results[0][0].id).toEqual(results[1][0].id);
            expect(
                await rows(
                    'SELECT * FROM intake_links WHERE account_id=$1 AND organization_id IS NULL',
                    [owner],
                ),
            ).toHaveLength(1);
            expect(
                await rows(
                    'SELECT * FROM intake_links WHERE is_referral_identity AND account_id=$1',
                    [owner],
                ),
            ).toHaveLength(1);
        });
        it('rejects stale edits, validates all fields atomically and retains aliases', async () => {
            await save(original, 1, {
                slug: 'new-original',
                name: 'Listing',
                isActive: true,
            });
            await expect(save(original, 1, { name: 'Stale' })).rejects.toThrow(
                'reload',
            );
            await expect(
                save(original, 2, {
                    name: 'Partial',
                    defaultBrandProfileId: other,
                }),
            ).rejects.toThrow('Invalid Branding');
            expect(
                (
                    await rows(
                        'SELECT name,revision FROM intake_links WHERE id=$1',
                        [original],
                    )
                )[0],
            ).toEqual({ name: 'Listing', revision: 2 });
            await expect(
                save(second, 1, { slug: 'original-link' }),
            ).rejects.toThrow('Slug already');
            expect(
                await rows(
                    'SELECT * FROM intake_link_aliases WHERE intake_link_id=$1',
                    [original],
                ),
            ).toHaveLength(2);
        });
        it('serializes defaults without changing referral identity and enforces unique indexes', async () => {
            await Promise.all([
                rows('SELECT * FROM set_default_seller_form($1,$2,$3)', [
                    owner,
                    org,
                    second,
                ]),
                rows('SELECT * FROM set_default_seller_form($1,$2,$3)', [
                    owner,
                    org,
                    original,
                ]),
            ]);
            expect(
                await rows(
                    'SELECT id FROM intake_links WHERE account_id=$1 AND organization_id=$2 AND is_default',
                    [owner, org],
                ),
            ).toHaveLength(1);
            expect(
                (
                    await rows(
                        'SELECT id FROM intake_links WHERE account_id=$1 AND is_referral_identity',
                        [owner],
                    )
                )[0].id,
            ).toBe(original);
            await expect(
                rows('UPDATE intake_links SET is_default=TRUE WHERE id=$1', [
                    second,
                ]),
            ).rejects.toThrow('seller_forms_workspace_default');
            expect(
                await rows('SELECT * FROM set_default_seller_form($1,$2,$3)', [
                    other,
                    org,
                    original,
                ]),
            ).toHaveLength(0);
        });
        it('checks snapshot revision and workspace, keeps started snapshots after editing, and fails closed on membership loss', async () => {
            const revision = (
                await rows('SELECT revision FROM intake_links WHERE id=$1', [
                    original,
                ])
            )[0].revision;
            await expect(
                rows(
                    'INSERT INTO requests(account_id,organization_id,source_form_id,source_form_revision) VALUES ($1,$2,$3,1)',
                    [owner, org, original],
                ),
            ).rejects.toThrow('reload');
            await rows(
                'INSERT INTO requests(account_id,organization_id,source_form_id,source_form_revision) VALUES ($1,$2,$3,$4)',
                [owner, org, original, revision],
            );
            await save(original, Number(revision), {
                sellerIntro: 'Changed later',
            });
            expect(
                (await rows('SELECT seller_intro FROM requests'))[0]
                    .seller_intro,
            ).toBeNull();
            await rows('DELETE FROM organization_members WHERE account_id=$1', [
                owner,
            ]);
            expect(await save(second, 1, { name: 'Revoked' })).toHaveLength(0);
            await expect(
                rows('DELETE FROM organizations WHERE id=$1', [org]),
            ).rejects.toThrow('foreign key');
        });
        it('enforces the configured technical cap inside the creation transaction', async () => {
            const existing = await rows(
                'SELECT * FROM intake_links WHERE account_id=$1',
                [other],
            );
            await expect(
                rows(
                    'SELECT * FROM save_seller_form($1,NULL,NULL,NULL,$2::jsonb,$3,1,TRUE)',
                    [other, '{"name":"Extra"}', 'over-cap'],
                ),
            ).rejects.toThrow('technical cap');
            expect(
                await rows('SELECT * FROM intake_links WHERE account_id=$1', [
                    other,
                ]),
            ).toHaveLength(existing.length);
        });
    },
);

it('boots the final schema independently and keeps alias cleanup', async () => {
    const fresh = new PGlite();
    try {
        const schema = readFileSync('schema.sql', 'utf8')
            .replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', '')
            .replaceAll('uuid_generate_v4()', 'gen_random_uuid()');
        await fresh.exec(schema);
        await fresh.query('INSERT INTO accounts(id,email) VALUES ($1,$2)', [
            owner,
            'synthetic@example.test',
        ]);
        await fresh.query('SELECT * FROM ensure_seller_form($1,NULL,$2)', [
            owner,
            'fresh-form',
        ]);
        expect(
            (await fresh.query('SELECT * FROM intake_link_aliases')).rows,
        ).toHaveLength(1);
        await fresh.query('DELETE FROM intake_links WHERE account_id=$1', [
            owner,
        ]);
        expect(
            (await fresh.query('SELECT * FROM intake_link_aliases')).rows,
        ).toHaveLength(0);
    } finally {
        await fresh.close();
    }
}, 30000);


it('gates additional workspace provisioning while preserving first forms and existing reads', async () => {
    const fresh = new PGlite();
    try {
        await fresh.exec(readFileSync('schema.sql', 'utf8').replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', '').replaceAll('uuid_generate_v4()', 'gen_random_uuid()'));
        await fresh.query('INSERT INTO accounts(id,email) VALUES ($1,$2)', [owner, 'synthetic@example.test']);
        await fresh.query("INSERT INTO organizations(id,name,slug) VALUES ($1,'A','workspace-a'),($2,'B','workspace-b')", [org, other]);
        await fresh.query('INSERT INTO organization_members(account_id,organization_id) VALUES ($1,$2),($1,$3)', [owner, org, other]);
        const ensure = async (scope: string, eligible: boolean, cap: number | null) => (await fresh.query('SELECT * FROM ensure_seller_form($1,$2,$3,$4,$5)', [owner, scope, `generated-${scope}`, eligible, cap])).rows;
        const initial = await ensure(org, false, null);
        expect(initial).toHaveLength(1);
        expect(await ensure(other, false, 20)).toHaveLength(0); // disabled / nonpilot
        expect(await ensure(other, true, null)).toHaveLength(0); // unconfigured cap
        expect(await ensure(other, true, 1)).toHaveLength(0); // account-wide cap reached
        expect((await fresh.query('SELECT * FROM ensure_seller_form($1,$2,$3)', [owner, other, 'legacy-bypass'])).rows).toHaveLength(0);
        expect(await ensure(org, false, null)).toEqual(initial); // gate off: existing reads
        expect((await fresh.query('SELECT id FROM intake_links')).rows).toHaveLength(1);
        expect(await ensure(other, true, 2)).toHaveLength(1);
        expect((await fresh.query('SELECT id FROM intake_links')).rows).toHaveLength(2);
    } finally {
        await fresh.close();
    }
}, 30000);

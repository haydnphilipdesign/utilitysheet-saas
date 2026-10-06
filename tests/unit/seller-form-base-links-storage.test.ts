// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Real, disposable embedded PostgreSQL behind the production query module.
// Never reads environment/database credentials.
const h = vi.hoisted(() => ({
    query: null as
        | null
        | ((text: string, params: unknown[]) => Promise<Record<string, unknown>[]>),
}));
vi.mock('@/lib/neon/db', () => ({
    sql: (strings: TemplateStringsArray, ...values: unknown[]) =>
        h.query!(
            strings.reduce(
                (text, part, index) => `${text}$${index}${part}`,
            ),
            values,
        ),
    generateToken: () => crypto.randomUUID().replace(/-/g, ''),
}));
import {
    getIntakeLinkBySlug,
    getIntakeLinkBySuffix,
    getSellerFormAliasSlugs,
    getSellerFormLinkScope,
    saveSellerForm,
    setDefaultSellerForm,
} from '@/lib/neon/queries/intake-links';

const db = new PGlite();
const forPglite = (sql: string) =>
    sql
        .replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', '')
        .replaceAll('uuid_generate_v4()', 'gen_random_uuid()');
const migration = forPglite(
    readFileSync('migrations-seller-form-base-links.sql', 'utf8'),
);
const rows = async (sql: string, params: unknown[] = []) =>
    (await db.query<Record<string, unknown>>(sql, params)).rows;

const jane = '00000000-0000-4000-8000-0000000000a1';
const bob = '00000000-0000-4000-8000-0000000000b1';
const team = '00000000-0000-4000-8000-0000000000c1';
const base = '10000000-0000-4000-8000-000000000001';
// These two share their first eight hex digits to force a generated collision.
const listing = '11111111-2222-4333-8444-555555555555';
const closing = '11111111-9999-4333-8444-555555555555';
const teamForm = '10000000-0000-4000-8000-000000000004';
const bobFirst = '10000000-0000-4000-8000-000000000005';
const bobSecond = '10000000-0000-4000-8000-000000000006';
const identity = () =>
    rows(`SELECT 'namespace' AS kind, account_id::text AS a, organization_id::text AS b, root_form_id::text AS c, NULL::boolean AS d FROM seller_form_link_namespaces
        UNION ALL SELECT 'ending', namespace_id::text, suffix, form_id::text, is_current FROM seller_form_suffix_aliases ORDER BY 1,2,3,4`);
const revision = async (id: string) =>
    Number((await rows('SELECT revision FROM intake_links WHERE id=$1', [id]))[0].revision);

beforeAll(async () => {
    h.query = rows;
    vi.stubEnv('SAVED_SELLER_FORMS_ENABLED', 'true');
    vi.stubEnv('SAVED_SELLER_FORMS_ROLLOUT', 'all');
    vi.stubEnv('SAVED_SELLER_FORMS_TECHNICAL_CAP', '50');
    // Legacy fixture: the last schema before base links, with synthetic forms.
    await db.exec(
        forPglite(
            execFileSync('git', ['show', 'ccd4eda:schema.sql'], {
                encoding: 'utf8',
                windowsHide: true,
            }),
        ),
    );
    await db.exec(`
        INSERT INTO organizations(id,name,slug) VALUES ('${team}','Synthetic Team','synthetic-team');
        INSERT INTO accounts(id,email,subscription_status) VALUES ('${jane}','jane@example.test','pro'), ('${bob}','bob@example.test','pro');
        INSERT INTO organization_members(account_id,organization_id) VALUES ('${jane}','${team}');
        INSERT INTO intake_links(id,account_id,organization_id,scope_initialized,slug,is_default,is_referral_identity,is_active,name,created_at) VALUES
            ('${base}','${jane}',NULL,TRUE,'jane-old',TRUE,TRUE,FALSE,'Private base name','2026-01-01'),
            ('${listing}','${jane}',NULL,TRUE,'listing-flat',FALSE,FALSE,TRUE,'Private listing name','2026-01-02'),
            ('${closing}','${jane}',NULL,TRUE,'closing-flat',FALSE,FALSE,TRUE,'Private closing name','2026-01-03'),
            ('${teamForm}','${jane}','${team}',TRUE,'team-form',TRUE,FALSE,TRUE,'Team','2026-01-04'),
            ('${bobFirst}','${bob}',NULL,TRUE,'bob-first',FALSE,TRUE,TRUE,'First','2026-01-01'),
            ('${bobSecond}','${bob}',NULL,TRUE,'bob-second',FALSE,FALSE,TRUE,'Second','2026-01-02');
        UPDATE intake_links SET slug='jane-smith' WHERE id='${base}';
        INSERT INTO requests(account_id,property_address,public_token,seller_token,source_form_id,source_form_revision)
            VALUES ('${jane}','123 Synthetic Street','public-token','seller-token','${listing}',1);
    `);
    await db.exec(migration);
}, 60000);
afterAll(async () => {
    vi.unstubAllEnvs();
    await db.close();
});

describe.sequential('shared base links: migration and atomic writers', () => {
    it('pins each base once, gives other forms opaque endings and rewrites nothing', async () => {
        expect(
            await rows(
                'SELECT account_id, organization_id, root_form_id FROM seller_form_link_namespaces ORDER BY root_form_id',
            ),
        ).toEqual([
            { account_id: jane, organization_id: null, root_form_id: base },
            { account_id: jane, organization_id: team, root_form_id: teamForm },
            // No default existed: the oldest form is the deterministic base.
            { account_id: bob, organization_id: null, root_form_id: bobFirst },
        ]);
        expect(
            await rows(
                'SELECT form_id, suffix, is_current FROM seller_form_suffix_aliases ORDER BY suffix',
            ),
        ).toEqual([
            { form_id: bobSecond, suffix: 'form-10000000', is_current: true },
            { form_id: listing, suffix: 'form-11111111', is_current: true },
            { form_id: closing, suffix: 'form-111111119999', is_current: true },
        ]);
        expect(
            (await rows("SELECT suffix FROM seller_form_suffix_aliases WHERE suffix ILIKE '%private%' OR suffix ILIKE '%listing%'")),
        ).toHaveLength(0);
        expect(await rows('SELECT slug, intake_link_id FROM intake_link_aliases ORDER BY slug')).toHaveLength(7);
        expect(
            (await rows('SELECT source_form_id, source_form_revision, seller_token FROM requests'))[0],
        ).toEqual({ source_form_id: listing, source_form_revision: 1, seller_token: 'seller-token' });
        expect(
            (await rows('SELECT slug, is_active, is_default, revision FROM intake_links WHERE id=$1', [base]))[0],
        ).toEqual({ slug: 'jane-smith', is_active: false, is_default: true, revision: 1 });
    });

    it('is rerunnable without changing a base, an ending or a canonical choice', async () => {
        const before = await identity();
        await db.exec(migration);
        await db.exec(migration);
        expect(await identity()).toEqual(before);
    });

    it('resolves endings only through a base alias, including a paused base', async () => {
        expect((await getIntakeLinkBySuffix('jane-smith', 'form-11111111'))?.id).toBe(listing);
        expect((await getIntakeLinkBySuffix('jane-old', 'form-11111111'))?.id).toBe(listing);
        expect((await getIntakeLinkBySuffix('jane-smith', 'form-11111111'))?.is_active).toBe(true);
        expect((await getIntakeLinkBySlug('jane-smith'))?.is_active).toBe(false);
        // Another form's flat slug is not a base; other namespaces stay separate.
        expect(await getIntakeLinkBySuffix('listing-flat', 'form-111111119999')).toBeNull();
        expect(await getIntakeLinkBySuffix('team-form', 'form-11111111')).toBeNull();
        expect(await getIntakeLinkBySuffix('bob-first', 'form-11111111')).toBeNull();
        expect(await getIntakeLinkBySuffix('jane-smith', 'missing')).toBeNull();
        expect(await getSellerFormLinkScope(jane)).toMatchObject({
            rootFormId: base,
            baseSlug: 'jane-smith',
            baseRevision: 1,
            baseIsActive: false,
            suffixes: { [listing]: 'form-11111111', [closing]: 'form-111111119999' },
        });
        expect((await getSellerFormAliasSlugs(base)).sort()).toEqual(['jane-old', 'jane-smith']);
    });

    it('renames an ending atomically and keeps every earlier ending bound to its form', async () => {
        expect((await saveSellerForm(jane, undefined, listing, 1, { suffix: 'listing' }))?.revision).toBe(2);
        expect((await getIntakeLinkBySuffix('jane-smith', 'listing'))?.id).toBe(listing);
        expect((await getIntakeLinkBySuffix('jane-smith', 'form-11111111'))?.id).toBe(listing);
        // Neither the current nor a historical ending can move to another form.
        for (const taken of ['listing', 'form-11111111'])
            await expect(
                saveSellerForm(jane, undefined, closing, 1, { suffix: taken, name: 'Partial' }),
            ).rejects.toMatchObject({ code: 'SF423' });
        expect(
            (await rows('SELECT name, revision FROM intake_links WHERE id=$1', [closing]))[0],
        ).toEqual({ name: 'Private closing name', revision: 1 });
        // The same form may return to its own earlier ending.
        await saveSellerForm(jane, undefined, listing, 2, { suffix: 'form-11111111' });
        expect((await getSellerFormLinkScope(jane))?.suffixes[listing]).toBe('form-11111111');
        await saveSellerForm(jane, undefined, listing, 3, { suffix: 'listing' });
        expect(
            await rows('SELECT suffix, is_current FROM seller_form_suffix_aliases WHERE form_id=$1 ORDER BY suffix', [listing]),
        ).toEqual([
            { suffix: 'form-11111111', is_current: false },
            { suffix: 'listing', is_current: true },
        ]);
    });

    it('rejects an ending on the base form, stale revisions and invalid text without changes', async () => {
        await expect(
            saveSellerForm(jane, undefined, base, 1, { suffix: 'not-allowed' }),
        ).rejects.toMatchObject({ code: 'SF422' });
        await expect(
            saveSellerForm(jane, undefined, listing, 1, { suffix: 'stale-ending' }),
        ).rejects.toMatchObject({ code: 'SF409' });
        await expect(
            saveSellerForm(jane, undefined, listing, 4, { suffix: 'Not Valid' }),
        ).rejects.toThrow('lowercase');
        expect(await getIntakeLinkBySuffix('jane-smith', 'stale-ending')).toBeNull();
        expect(await revision(listing)).toBe(4);
        expect(await revision(base)).toBe(1);
    });

    it('renames the base while old and new bases open the same forms with any of their endings', async () => {
        await saveSellerForm(jane, undefined, base, 1, { slug: 'jane-team' });
        for (const [slug, suffix] of [
            ['jane-team', 'listing'],
            ['jane-smith', 'listing'],
            ['jane-old', 'form-11111111'],
            ['jane-team', 'form-11111111'],
        ])
            expect((await getIntakeLinkBySuffix(slug, suffix))?.id).toBe(listing);
        for (const slug of ['jane-team', 'jane-smith', 'jane-old'])
            expect((await getIntakeLinkBySlug(slug))?.id).toBe(base);
        expect((await getIntakeLinkBySlug('listing-flat'))?.id).toBe(listing);
        expect((await getSellerFormLinkScope(jane))?.baseSlug).toBe('jane-team');
        // A published base can never be claimed by another creator.
        await expect(
            saveSellerForm(bob, undefined, bobFirst, 1, { slug: 'jane-smith' }),
        ).rejects.toMatchObject({ code: '23505' });
        expect((await getSellerFormLinkScope(bob))?.baseSlug).toBe('bob-first');
    });

    it('never repoints the bare base when the default changes', async () => {
        await setDefaultSellerForm(jane, undefined, listing);
        expect((await rows('SELECT is_default FROM intake_links WHERE id=$1', [listing]))[0].is_default).toBe(true);
        expect((await getSellerFormLinkScope(jane))?.rootFormId).toBe(base);
        expect((await getIntakeLinkBySlug('jane-team'))?.id).toBe(base);
        expect((await getIntakeLinkBySuffix('jane-team', 'listing'))?.id).toBe(listing);
        // The legacy flat slug of a non-base form changes only that form's own alias.
        await saveSellerForm(jane, undefined, listing, await revision(listing), { slug: 'listing-renamed' });
        expect((await getSellerFormLinkScope(jane))?.baseSlug).toBe('jane-team');
        expect((await getIntakeLinkBySlug('listing-flat'))?.id).toBe(listing);
        expect(await getIntakeLinkBySuffix('listing-renamed', 'form-111111119999')).toBeNull();
    });

    it('allocates endings for create, duplicate, old writers and new workspaces inside the writer', async () => {
        const buyer = await saveSellerForm(jane, undefined, null, null, { name: 'Buyer', suffix: 'buyers' });
        expect((await getIntakeLinkBySuffix('jane-team', 'buyers'))?.id).toBe(buyer!.id);
        const count = (await rows('SELECT id FROM intake_links WHERE account_id=$1', [jane])).length;
        await expect(
            saveSellerForm(jane, undefined, null, null, { name: 'Duplicate ending', suffix: 'listing' }),
        ).rejects.toMatchObject({ code: 'SF423' });
        expect(await rows('SELECT id FROM intake_links WHERE account_id=$1', [jane])).toHaveLength(count);
        const generated = await saveSellerForm(jane, undefined, null, null, { name: 'No ending sent' });
        expect((await getSellerFormLinkScope(jane))?.suffixes[generated!.id]).toBe(
            `form-${generated!.id.replace(/-/g, '').slice(0, 8)}`,
        );
        // The requested ending does not leak to a later insert in the session.
        // A valid additional-row insert must supply the existing default and
        // referral flags; their TRUE defaults are for first-ever provisioning.
        await rows('INSERT INTO intake_links(account_id,slug,is_default,is_referral_identity) VALUES ($1,$2,FALSE,FALSE)', [jane, 'old-writer']);
        const oldWriter = String((await rows("SELECT id FROM intake_links WHERE slug='old-writer'"))[0].id);
        expect((await getSellerFormLinkScope(jane))?.suffixes[oldWriter]).toBe(
            `form-${oldWriter.replace(/-/g, '').slice(0, 8)}`,
        );
        // The same ending is valid in another namespace of the same creator.
        const teamListing = await saveSellerForm(jane, team, null, null, { name: 'Team listing', suffix: 'listing' });
        expect((await getIntakeLinkBySuffix('team-form', 'listing'))?.id).toBe(teamListing!.id);
        expect((await getIntakeLinkBySuffix('jane-team', 'listing'))?.id).toBe(listing);
        // A first form in a new scope becomes that scope's base and has no ending.
        const carol = '00000000-0000-4000-8000-0000000000d1';
        await rows("INSERT INTO accounts(id,email) VALUES ($1,'carol@example.test')", [carol]);
        const first = (await rows('SELECT id FROM ensure_seller_form($1,NULL,$2)', [carol, 'carol-form']))[0].id;
        expect(await getSellerFormLinkScope(carol)).toMatchObject({ rootFormId: first, baseSlug: 'carol-form', suffixes: {} });
    });

    it('retains every link after downgrade and still enforces the allowance', async () => {
        const before = await identity();
        await rows("UPDATE accounts SET subscription_status='free' WHERE id=$1", [jane]);
        expect(
            (await saveSellerForm(jane, undefined, closing, 1, { name: 'Edited on Free', isActive: false }))?.is_active,
        ).toBe(false);
        await expect(
            saveSellerForm(jane, undefined, null, null, { name: 'Over allowance', suffix: 'extra' }),
        ).rejects.toMatchObject({ code: 'SF402' });
        expect(await identity()).toEqual(before);
        expect((await getIntakeLinkBySuffix('jane-smith', 'form-111111119999'))?.id).toBe(closing);
        await rows("UPDATE accounts SET subscription_status='pro' WHERE id=$1", [jane]);
        await saveSellerForm(jane, undefined, closing, 2, { isActive: true });
        expect(await identity()).toEqual(before);
    });

    it('keeps published identity permanent and scoped at the storage boundary', async () => {
        await expect(
            rows("UPDATE seller_form_suffix_aliases SET form_id=$1 WHERE suffix='listing' AND form_id=$2", [closing, listing]),
        ).rejects.toThrow('permanent');
        await expect(
            rows('UPDATE seller_form_link_namespaces SET root_form_id=$1 WHERE root_form_id=$2', [listing, base]),
        ).rejects.toThrow('permanent');
        const namespace = (await rows('SELECT id FROM seller_form_link_namespaces WHERE root_form_id=$1', [base]))[0].id;
        await expect(
            rows("INSERT INTO seller_form_suffix_aliases(namespace_id,suffix,form_id) VALUES ($1,'foreign',$2)", [namespace, bobSecond]),
        ).rejects.toThrow('same creator and workspace');
        await expect(
            rows("INSERT INTO seller_form_suffix_aliases(namespace_id,suffix,form_id) VALUES ($1,'on-base',$2)", [namespace, base]),
        ).rejects.toThrow('non-base form');
        await expect(
            rows("INSERT INTO seller_form_suffix_aliases(namespace_id,suffix,form_id) VALUES ($1,'x',$2)", [namespace, closing]),
        ).rejects.toThrow('check');
        await expect(
            rows('INSERT INTO seller_form_link_namespaces(account_id,root_form_id) VALUES ($1,$2)', [bob, listing]),
        ).rejects.toThrow('creator and workspace');
    });

    it('leaves no namespace or ending behind when account closure deletes the forms', async () => {
        // Mirrors lib/neon/queries/account-closure.ts: forms are deleted explicitly.
        await rows('DELETE FROM intake_links WHERE account_id=$1', [jane]);
        expect(await rows('SELECT 1 FROM seller_form_link_namespaces WHERE account_id=$1', [jane])).toHaveLength(0);
        expect(
            await rows('SELECT 1 FROM seller_form_suffix_aliases x JOIN seller_form_link_namespaces n ON n.id=x.namespace_id WHERE n.account_id=$1', [jane]),
        ).toHaveLength(0);
        expect(await rows('SELECT 1 FROM seller_form_suffix_aliases')).toHaveLength(1);
        expect(await rows('DELETE FROM organizations WHERE id=$1 RETURNING id', [team])).toHaveLength(1);
        expect((await rows('SELECT status FROM requests'))).toHaveLength(1);
        // Deleting only a non-base form removes its endings and keeps the namespace.
        await rows('DELETE FROM intake_links WHERE id=$1', [bobSecond]);
        expect(await rows('SELECT 1 FROM seller_form_suffix_aliases')).toHaveLength(0);
        expect((await getSellerFormLinkScope(bob))?.rootFormId).toBe(bobFirst);
    });
});

it('boots the current schema with base links and accepts the migration on top', async () => {
    const fresh = new PGlite();
    try {
        await fresh.exec(forPglite(readFileSync('schema.sql', 'utf8')));
        const owner = '00000000-0000-4000-8000-0000000000e1';
        await fresh.query("INSERT INTO accounts(id,email,subscription_status) VALUES ($1,'fresh@example.test','pro')", [owner]);
        const first = (await fresh.query<{ id: string }>('SELECT id FROM ensure_seller_form($1,NULL,$2)', [owner, 'fresh-base'])).rows[0].id;
        const second = (await fresh.query<{ id: string }>(
            `SELECT id FROM save_seller_form($1,NULL,NULL,NULL,'{"name":"Closing","suffix":"closing"}','generated-flat',50,TRUE)`,
            [owner],
        )).rows[0].id;
        await fresh.exec(migration);
        expect(
            (await fresh.query('SELECT root_form_id FROM seller_form_link_namespaces')).rows,
        ).toEqual([{ root_form_id: first }]);
        expect(
            (await fresh.query('SELECT form_id, suffix, is_current FROM seller_form_suffix_aliases')).rows,
        ).toEqual([{ form_id: second, suffix: 'closing', is_current: true }]);
    } finally {
        await fresh.close();
    }
}, 60000);

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
    getIntakeLinkByBaseSlug,
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
// Always in this order: each file supersedes functions the previous one installs.
const migration = forPglite(
    readFileSync('migrations-seller-form-base-links.sql', 'utf8') +
        readFileSync('migrations-seller-form-default-base-link.sql', 'utf8') +
        readFileSync('migrations-seller-form-readable-endings.sql', 'utf8') +
        readFileSync('migrations-seller-form-heading.sql', 'utf8'),
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
    it('pins each base owner once, gives every form a readable ending and rewrites nothing', async () => {
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
                'SELECT form_id, suffix FROM seller_form_suffix_aliases WHERE is_current ORDER BY suffix, form_id',
            ),
        ).toEqual([
            // Numbered per namespace in creation order; base owners get one too.
            { form_id: base, suffix: 'form-1' },
            { form_id: teamForm, suffix: 'form-1' },
            { form_id: bobFirst, suffix: 'form-1' },
            { form_id: bobSecond, suffix: 'form-2' },
            { form_id: listing, suffix: 'form-2' },
            { form_id: closing, suffix: 'form-3' },
        ]);
        // The earlier ID-derived endings stay reserved to the same forms.
        expect(
            await rows(
                'SELECT form_id, suffix FROM seller_form_suffix_aliases WHERE NOT is_current ORDER BY suffix, form_id',
            ),
        ).toEqual([
            { form_id: base, suffix: 'form-10000000' },
            { form_id: teamForm, suffix: 'form-10000000' },
            { form_id: bobSecond, suffix: 'form-10000000' },
            { form_id: bobFirst, suffix: 'form-100000000000' },
            { form_id: listing, suffix: 'form-11111111' },
            { form_id: closing, suffix: 'form-111111119999' },
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
        expect((await getIntakeLinkByBaseSlug('jane-smith'))?.id).toBe(base);
        expect((await getIntakeLinkByBaseSlug('jane-smith'))?.is_active).toBe(false);
        expect((await getIntakeLinkBySuffix('jane-smith', 'form-10000000'))?.id).toBe(base);
        // Another form's flat slug is not a base; other namespaces stay separate.
        expect(await getIntakeLinkBySuffix('listing-flat', 'form-111111119999')).toBeNull();
        expect(await getIntakeLinkBySuffix('team-form', 'form-11111111')).toBeNull();
        expect(await getIntakeLinkBySuffix('bob-first', 'form-11111111')).toBeNull();
        expect(await getIntakeLinkBySuffix('jane-smith', 'missing')).toBeNull();
        expect(await getSellerFormLinkScope(jane)).toMatchObject({
            rootFormId: base,
            baseSlug: 'jane-smith',
            baseRevision: 1,
            defaultFormId: base,
            defaultFormName: 'Private base name',
            defaultIsActive: false,
            suffixes: { [base]: 'form-1', [listing]: 'form-2', [closing]: 'form-3' },
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
            { suffix: 'form-2', is_current: false },
            { suffix: 'listing', is_current: true },
        ]);
    });

    it('lets the base owner rename its ending and rejects stale revisions and invalid text without changes', async () => {
        expect((await saveSellerForm(jane, undefined, base, 1, { suffix: 'main' }))?.revision).toBe(2);
        expect((await getIntakeLinkBySuffix('jane-smith', 'main'))?.id).toBe(base);
        expect((await getIntakeLinkBySuffix('jane-old', 'form-10000000'))?.id).toBe(base);
        await expect(
            saveSellerForm(jane, undefined, closing, 1, { suffix: 'main' }),
        ).rejects.toMatchObject({ code: 'SF423' });
        await expect(
            saveSellerForm(jane, undefined, listing, 1, { suffix: 'stale-ending' }),
        ).rejects.toMatchObject({ code: 'SF409' });
        await expect(
            saveSellerForm(jane, undefined, listing, 4, { suffix: 'Not Valid' }),
        ).rejects.toThrow('lowercase');
        expect(await getIntakeLinkBySuffix('jane-smith', 'stale-ending')).toBeNull();
        expect(await revision(listing)).toBe(4);
        expect(await revision(base)).toBe(2);
    });

    it('renames the base while old and new bases open the same forms with any of their endings', async () => {
        await saveSellerForm(jane, undefined, base, 2, { slug: 'jane-team' });
        for (const [slug, suffix] of [
            ['jane-team', 'listing'],
            ['jane-smith', 'listing'],
            ['jane-old', 'form-11111111'],
            ['jane-team', 'form-11111111'],
        ])
            expect((await getIntakeLinkBySuffix(slug, suffix))?.id).toBe(listing);
        for (const slug of ['jane-team', 'jane-smith', 'jane-old'])
            expect((await getIntakeLinkByBaseSlug(slug))?.id).toBe(base);
        expect((await getIntakeLinkByBaseSlug('listing-flat'))?.id).toBe(listing);
        expect((await getSellerFormLinkScope(jane))?.baseSlug).toBe('jane-team');
        // A published base can never be claimed by another creator.
        await expect(
            saveSellerForm(bob, undefined, bobFirst, 1, { slug: 'jane-smith' }),
        ).rejects.toMatchObject({ code: '23505' });
        expect((await getSellerFormLinkScope(bob))?.baseSlug).toBe('bob-first');
    });

    it('moves every base name to the new default while each ending keeps its own form', async () => {
        await setDefaultSellerForm(jane, undefined, listing);
        expect((await rows('SELECT is_default FROM intake_links WHERE id=$1', [listing]))[0].is_default).toBe(true);
        expect(await getSellerFormLinkScope(jane)).toMatchObject({
            rootFormId: base, baseSlug: 'jane-team', defaultFormId: listing, defaultIsActive: true,
        });
        for (const slug of ['jane-team', 'jane-smith', 'jane-old'])
            expect((await getIntakeLinkByBaseSlug(slug))?.id).toBe(listing);
        // The referral-code lookup still returns the form that owns the name.
        expect((await getIntakeLinkBySlug('jane-team'))?.id).toBe(base);
        expect((await getIntakeLinkBySuffix('jane-team', 'main'))?.id).toBe(base);
        expect((await getIntakeLinkBySuffix('jane-team', 'listing'))?.id).toBe(listing);
        // Other workspaces and creators are untouched.
        expect((await getIntakeLinkByBaseSlug('team-form'))?.id).toBe(teamForm);
        expect((await getIntakeLinkByBaseSlug('bob-first'))?.id).toBe(bobFirst);
        // A paused default closes the bare link without affecting an ending.
        await saveSellerForm(jane, undefined, listing, await revision(listing), { isActive: false });
        expect((await getIntakeLinkByBaseSlug('jane-team'))?.is_active).toBe(false);
        expect((await getIntakeLinkBySuffix('jane-team', 'form-111111119999'))?.is_active).toBe(true);
        await saveSellerForm(jane, undefined, listing, await revision(listing), { isActive: true });
        // The legacy flat slug of a non-base form changes only that form's own alias.
        await saveSellerForm(jane, undefined, listing, await revision(listing), { slug: 'listing-renamed' });
        expect((await getSellerFormLinkScope(jane))?.baseSlug).toBe('jane-team');
        expect((await getIntakeLinkByBaseSlug('listing-flat'))?.id).toBe(listing);
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
        // Lowest free number: form-1 to form-3 belong to the first three forms.
        expect((await getSellerFormLinkScope(jane))?.suffixes[generated!.id]).toBe('form-4');
        // The requested ending does not leak to a later insert in the session.
        // A valid additional-row insert must supply the existing default and
        // referral flags; their TRUE defaults are for first-ever provisioning.
        await rows('INSERT INTO intake_links(account_id,slug,is_default,is_referral_identity) VALUES ($1,$2,FALSE,FALSE)', [jane, 'old-writer']);
        const oldWriter = String((await rows("SELECT id FROM intake_links WHERE slug='old-writer'"))[0].id);
        expect((await getSellerFormLinkScope(jane))?.suffixes[oldWriter]).toBe('form-5');
        // The same ending is valid in another namespace of the same creator.
        const teamListing = await saveSellerForm(jane, team, null, null, { name: 'Team listing', suffix: 'listing' });
        expect((await getIntakeLinkBySuffix('team-form', 'listing'))?.id).toBe(teamListing!.id);
        expect((await getIntakeLinkBySuffix('jane-team', 'listing'))?.id).toBe(listing);
        // A first form in a new scope owns that scope's base name and gets an ending too.
        const carol = '00000000-0000-4000-8000-0000000000d1';
        await rows("INSERT INTO accounts(id,email) VALUES ($1,'carol@example.test')", [carol]);
        const first = String((await rows('SELECT id FROM ensure_seller_form($1,NULL,$2)', [carol, 'carol-form']))[0].id);
        expect(await getSellerFormLinkScope(carol)).toMatchObject({
            rootFormId: first, baseSlug: 'carol-form', defaultFormId: first,
            suffixes: { [first]: 'form-1' },
        });
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
            rows("INSERT INTO seller_form_suffix_aliases(namespace_id,suffix,form_id) VALUES ($1,'x',$2)", [namespace, closing]),
        ).rejects.toThrow('check');
        await expect(
            rows('INSERT INTO seller_form_link_namespaces(account_id,root_form_id) VALUES ($1,$2)', [bob, listing]),
        ).rejects.toThrow('creator and workspace');
    });

    it('stores a trimmed seller heading, clears an empty one and rejects one that is too long', async () => {
        const form = (await rows('SELECT id, revision, seller_intro FROM intake_links WHERE account_id=$1 ORDER BY created_at, id LIMIT 1', [bob]))[0];
        const saved = await saveSellerForm(bob, undefined, String(form.id), Number(form.revision), { sellerHeading: '  Welcome home sellers  ' });
        expect(saved).toMatchObject({ seller_heading: 'Welcome home sellers', seller_intro: form.seller_intro });
        // A patch without the key leaves the heading alone.
        const renamed = await saveSellerForm(bob, undefined, String(form.id), saved!.revision, { name: 'Renamed' });
        expect(renamed!.seller_heading).toBe('Welcome home sellers');
        await expect(
            saveSellerForm(bob, undefined, String(form.id), renamed!.revision, { sellerHeading: 'x'.repeat(81) }),
        ).rejects.toThrow();
        const cleared = await saveSellerForm(bob, undefined, String(form.id), renamed!.revision, { sellerHeading: '   ' });
        expect(cleared!.seller_heading).toBeNull();
    });
    it('leaves no namespace or ending behind when account closure deletes the forms', async () => {
        const bobEndings = () => rows('SELECT x.form_id FROM seller_form_suffix_aliases x JOIN seller_form_link_namespaces n ON n.id=x.namespace_id WHERE n.account_id=$1 AND x.is_current', [bob]);
        // Mirrors lib/neon/queries/account-closure.ts: forms are deleted explicitly.
        await rows('DELETE FROM intake_links WHERE account_id=$1', [jane]);
        expect(await rows('SELECT 1 FROM seller_form_link_namespaces WHERE account_id=$1', [jane])).toHaveLength(0);
        expect(
            await rows('SELECT 1 FROM seller_form_suffix_aliases x JOIN seller_form_link_namespaces n ON n.id=x.namespace_id WHERE n.account_id=$1', [jane]),
        ).toHaveLength(0);
        expect(await bobEndings()).toHaveLength(2);
        expect(await rows('DELETE FROM organizations WHERE id=$1 RETURNING id', [team])).toHaveLength(1);
        expect((await rows('SELECT status FROM requests'))).toHaveLength(1);
        // Deleting a form that does not own the base name removes only its endings.
        await rows('DELETE FROM intake_links WHERE id=$1', [bobSecond]);
        expect(await bobEndings()).toEqual([{ form_id: bobFirst }]);
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
            (await fresh.query('SELECT form_id, suffix, is_current FROM seller_form_suffix_aliases ORDER BY suffix')).rows,
        ).toEqual([
            { form_id: second, suffix: 'closing', is_current: true },
            { form_id: first, suffix: 'form-1', is_current: true },
        ]);
    } finally {
        await fresh.close();
    }
}, 60000);

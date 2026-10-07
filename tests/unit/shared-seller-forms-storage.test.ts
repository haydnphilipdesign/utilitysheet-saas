// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Real, disposable embedded PostgreSQL behind the production query module.
// Never reads environment/database credentials.
const h = vi.hoisted(() => ({
    query: null as
        | null
        | ((text: string, params: unknown[]) => Promise<Record<string, unknown>[]>),
}));
vi.mock('@/lib/neon/db', () => {
    type Lazy = { text: string; values: unknown[] };
    const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
        const text = strings.reduce((all, part, index) => `${all}$${index}${part}`);
        return {
            text,
            values,
            // Runs when awaited, like the production client.
            then: (resolve: (rows: unknown) => unknown, reject: (error: unknown) => unknown) =>
                h.query!(text, values).then(resolve, reject),
        };
    };
    // One real transaction: any failing statement rolls every statement back.
    sql.transaction = async (queries: Lazy[]) => {
        await h.query!('BEGIN', []);
        try {
            const results = [];
            for (const query of queries) results.push(await h.query!(query.text, query.values));
            await h.query!('COMMIT', []);
            return results;
        } catch (error) {
            await h.query!('ROLLBACK', []);
            throw error;
        }
    };
    return { sql, generateToken: () => crypto.randomUUID().replace(/-/g, '') };
});
import {
    deleteSellerForm,
    getIntakeLinkByBaseSlug,
    getIntakeLinkBySlug,
    getIntakeLinkBySuffix,
    getSellerForm,
    getSellerFormLinkScope,
    getSharedSellerFormUsage,
    getUsableSellerForm,
    listSellerForms,
    listWorkspaceSellerForms,
    setSellerFormShared,
} from '@/lib/neon/queries/intake-links';
import { removeOrganizationMemberWithHandover } from '@/lib/neon/queries/organizations';
import { AccountClosureConflictError, getAccountClosureSnapshot, removeAccountClosureData } from '@/lib/neon/queries/account-closure';
import { publicFormScope } from '@/lib/seller-forms/public';

vi.mock('@/lib/neon/queries', async () => {
    const organizations = (account: string) =>
        h.query!('SELECT o.*, om.role FROM organizations o JOIN organization_members om ON o.id = om.organization_id WHERE om.account_id = $1', [account]);
    return {
        getAccountById: async (id: string) => (await h.query!('SELECT * FROM accounts WHERE id = $1', [id]))[0] || null,
        getAccountOrganizations: organizations,
    };
});

const db = new PGlite();
const forPglite = (sql: string) =>
    sql
        .replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', '')
        .replaceAll('uuid_generate_v4()', 'gen_random_uuid()');
const migration = forPglite(readFileSync('migrations-seller-form-sharing-and-delete.sql', 'utf8'));
const rows = async (sql: string, params: unknown[] = []) =>
    (await db.query<Record<string, unknown>>(sql, params)).rows;

const creator = '00000000-0000-4000-8000-0000000000a1';
const admin = '00000000-0000-4000-8000-0000000000a2';
const member = '00000000-0000-4000-8000-0000000000a3';
const outsider = '00000000-0000-4000-8000-0000000000a4';
const team = '00000000-0000-4000-8000-0000000000c1';
const freeTeam = '00000000-0000-4000-8000-0000000000c2';

let slugCounter = 0;
const form = async (id: string) => (await rows('SELECT * FROM intake_links WHERE id=$1', [id]))[0];
const create = async (account: string, org: string | null, config: Record<string, unknown> = {}) =>
    (await rows('SELECT * FROM save_seller_form($1,$2,NULL,NULL,$3::jsonb,$4,500,TRUE)', [
        account, org, JSON.stringify({ name: 'Form', ...config }), `flat-${++slugCounter}`,
    ]))[0];
const save = async (actor: string, org: string | null, id: string, config: Record<string, unknown>) =>
    rows('SELECT * FROM save_seller_form($1,$2,$3,$4,$5::jsonb,$6,500,TRUE)', [
        actor, org, id, (await form(id)).revision, JSON.stringify(config), 'unused',
    ]);
const share = async (actor: string, org: string, id: string, shared: boolean) =>
    rows('SELECT * FROM set_seller_form_shared($1,$2,$3,$4,$5)', [actor, org, id, (await form(id)).revision, shared]);
const remove = async (actor: string, org: string | null, id: string) =>
    rows('SELECT * FROM delete_seller_form($1,$2,$3,$4)', [actor, org, id, (await form(id)).revision]);
const startRequest = async (account: string, org: string | null, id: string) =>
    rows(
        `INSERT INTO requests(account_id,organization_id,property_address,public_token,seller_token,source_form_id,source_form_revision)
         VALUES ($1,$2,'1 Synthetic Street',$3,$4,$5,$6) RETURNING id`,
        [account, org, crypto.randomUUID(), crypto.randomUUID(), id, (await form(id)).revision],
    );

beforeAll(async () => {
    h.query = rows;
    await db.exec(forPglite(readFileSync('schema.sql', 'utf8')));
    await db.exec(`
        INSERT INTO organizations(id,name,slug,subscription_status) VALUES
            ('${team}','Synthetic Team','synthetic-team','team'), ('${freeTeam}','Synthetic Free','synthetic-free','free');
        INSERT INTO accounts(id,email) VALUES ('${creator}','creator@example.test'), ('${admin}','admin@example.test'),
            ('${member}','member@example.test'), ('${outsider}','outsider@example.test');
        INSERT INTO organization_members(account_id,organization_id,role) VALUES
            ('${creator}','${team}','member'), ('${admin}','${team}','admin'), ('${member}','${team}','member'),
            ('${creator}','${freeTeam}','admin');
    `);
}, 60000);
afterAll(async () => {
    await db.close();
});

describe.sequential('shared seller forms and form delete: storage rules', () => {
    let first: string;
    let shared: string;

    it('is rerunnable on the current schema and changes no form', async () => {
        first = String((await create(creator, team)).id);
        shared = String((await create(creator, team, { name: 'Closing', suffix: 'closing' })).id);
        const before = await rows('SELECT * FROM intake_links ORDER BY id');
        await db.exec(migration);
        await db.exec(migration);
        expect(await rows('SELECT * FROM intake_links ORDER BY id')).toEqual(before);
        expect(before.every((row) => row.shared_owner_account_id === null && row.deleted_at === null)).toBe(true);
    });

    it('lets only the creator share, only on Teams, and bumps the revision', async () => {
        await expect(share(admin, team, shared, true)).rejects.toMatchObject({ code: 'SF411' });
        expect(await share(outsider, team, shared, true)).toHaveLength(0);
        const freeForm = String((await create(creator, freeTeam)).id);
        await expect(share(creator, freeTeam, freeForm, true)).rejects.toMatchObject({ code: 'SF412' });
        const before = Number((await form(shared)).revision);
        const [saved] = await share(creator, team, shared, true);
        expect(saved).toMatchObject({ shared_owner_account_id: creator, account_id: creator, revision: before + 1 });
        await expect(
            rows('SELECT * FROM set_seller_form_shared($1,$2,$3,$4,TRUE)', [creator, team, shared, before]),
        ).rejects.toMatchObject({ code: 'SF409' });
    });

    it('refuses a shared form outside a workspace at the storage boundary', async () => {
        const personal = String((await create(outsider, null)).id);
        await expect(
            rows('UPDATE intake_links SET shared_owner_account_id=$1 WHERE id=$2', [outsider, personal]),
        ).rejects.toThrow('intake_links_shared_needs_workspace');
    });

    it('lets the creator, the owner and admins change a shared form, and nobody else', async () => {
        expect(await save(member, team, shared, { name: 'Member edit' })).toHaveLength(0);
        expect(await save(outsider, team, shared, { name: 'Outsider edit' })).toHaveLength(0);
        // A personal form stays closed to admins.
        expect(await save(admin, team, first, { name: 'Admin edit' })).toHaveLength(0);
        expect((await save(admin, team, shared, { name: 'Admin edit', isActive: false }))[0])
            .toMatchObject({ name: 'Admin edit', is_active: false, account_id: creator, shared_owner_account_id: creator });
        expect((await save(creator, team, shared, { isActive: true }))[0]).toMatchObject({ is_active: true });
    });

    it('renames a shared ending inside the creator\'s link names and keeps the link name with the creator', async () => {
        await save(admin, team, shared, { suffix: 'closing-day' });
        expect(
            await rows(
                `SELECT x.suffix, x.is_current, n.account_id FROM seller_form_suffix_aliases x
                 JOIN seller_form_link_namespaces n ON n.id = x.namespace_id WHERE x.form_id=$1 ORDER BY x.suffix`,
                [shared],
            ),
        ).toEqual([
            { suffix: 'closing', is_current: false, account_id: creator },
            { suffix: 'closing-day', is_current: true, account_id: creator },
        ]);
        expect(await rows('SELECT 1 FROM seller_form_link_namespaces WHERE account_id=$1', [admin])).toHaveLength(0);
        await expect(save(admin, team, shared, { slug: 'admin-took-it' })).rejects.toMatchObject({ code: 'SF411' });
    });

    it('accepts a request from any member through a shared form and from nobody else', async () => {
        expect(await startRequest(member, team, shared)).toHaveLength(1);
        expect(await startRequest(creator, team, shared)).toHaveLength(1);
        await expect(startRequest(outsider, team, shared)).rejects.toThrow('Invalid request form');
        await expect(startRequest(member, null, shared)).rejects.toThrow('Invalid request form');
        // A personal form still belongs to its creator alone.
        await expect(startRequest(member, team, first)).rejects.toThrow('Invalid request form');
        expect(await startRequest(creator, team, first)).toHaveLength(1);
    });

    it('depends on the current owner, not the creator, once the creator has left', async () => {
        await rows('DELETE FROM organization_members WHERE account_id=$1 AND organization_id=$2', [creator, team]);
        // Not handed over yet: the owner is outside the workspace.
        await expect(startRequest(member, team, shared)).rejects.toThrow('Form unavailable');
        await rows('UPDATE intake_links SET shared_owner_account_id=$1 WHERE id=$2', [admin, shared]);
        expect(await startRequest(admin, team, shared)).toHaveLength(1);
        expect(await startRequest(member, team, shared)).toHaveLength(1);
        // The creator's personal form stops, as before.
        await expect(startRequest(creator, team, first)).rejects.toThrow('Form unavailable');
        // The creator is no longer a member, so they cannot change it or take it back.
        expect(await save(creator, team, shared, { name: 'From outside' })).toHaveLength(0);
        expect(await share(creator, team, shared, false)).toHaveLength(0);
        await expect(share(admin, team, shared, false)).rejects.toMatchObject({ code: 'SF414' });
        expect((await save(admin, team, shared, { suffix: 'still-here' }))[0]).toMatchObject({ id: shared });
    });

    it('takes a shared form back while the creator is a member and has room', async () => {
        await rows("INSERT INTO organization_members(account_id,organization_id,role) VALUES ($1,$2,'member')", [creator, team]);
        await rows('UPDATE intake_links SET shared_owner_account_id=$1 WHERE id=$2', [creator, shared]);
        expect((await share(admin, team, shared, false))[0]).toMatchObject({ shared_owner_account_id: null });
        await expect(startRequest(member, team, shared)).rejects.toThrow('Invalid request form');
        await share(creator, team, shared, true);
        // Fill the creator's ten personal forms; the shared one is not counted.
        for (let count = 1; count < 10; count += 1) await create(creator, team);
        await expect(create(creator, team)).rejects.toMatchObject({ code: 'SF402' });
        await expect(share(admin, team, shared, false)).rejects.toMatchObject({ code: 'SF415' });
    });

    it('counts shared forms against the workspace: ten per member on Teams, none otherwise', async () => {
        expect((await rows('SELECT seller_form_shared_allowance($1) AS n', [team]))[0].n).toBe(30);
        expect((await rows('SELECT seller_form_shared_allowance($1) AS n', [freeTeam]))[0].n).toBe(0);
        await rows('DELETE FROM organization_members WHERE organization_id=$1 AND account_id IN ($2,$3)', [team, admin, member]);
        expect((await rows('SELECT seller_form_shared_allowance($1) AS n', [team]))[0].n).toBe(10);
        // One is shared already; nine more reach the workspace's ten.
        const personal = await rows(
            'SELECT id FROM intake_links WHERE account_id=$1 AND organization_id=$2 AND shared_owner_account_id IS NULL AND NOT is_default ORDER BY created_at, id',
            [creator, team],
        );
        for (const row of personal.slice(0, 9)) await share(creator, team, String(row.id), true);
        const extra = String((await create(creator, team)).id);
        await expect(share(creator, team, extra, true)).rejects.toMatchObject({ code: 'SF413' });
        await rows(
            "INSERT INTO organization_members(account_id,organization_id,role) VALUES ($1,$2,'admin'), ($3,$2,'member')",
            [admin, team, member],
        );
        expect((await share(creator, team, extra, true))[0]).toMatchObject({ shared_owner_account_id: creator });
    });

    it('keeps shared forms working when Teams stops and shares nothing new', async () => {
        const personal = await create(creator, team);
        await rows("UPDATE organizations SET subscription_status='free' WHERE id=$1", [team]);
        expect(await startRequest(member, team, shared)).toHaveLength(1);
        expect((await save(admin, team, shared, { name: 'Edited after Teams' }))[0]).toMatchObject({ name: 'Edited after Teams' });
        await expect(share(creator, team, String(personal.id), true)).rejects.toMatchObject({ code: 'SF412' });
        await rows("UPDATE organizations SET subscription_status='team' WHERE id=$1", [team]);
    });

    it('deletes a form for good, keeps its requests and releases its link endings for reuse', async () => {
        await expect(remove(creator, team, first)).rejects.toMatchObject({ code: 'SF416' });
        expect(await remove(member, team, shared)).toHaveLength(0);
        const requestsBefore = await rows('SELECT id, source_form_id FROM requests WHERE source_form_id=$1 ORDER BY id', [shared]);
        const [deleted] = await remove(admin, team, shared);
        expect(deleted).toMatchObject({ is_active: false, shared_owner_account_id: null, account_id: creator });
        expect(deleted.deleted_at).not.toBeNull();

        expect(await rows('SELECT id, source_form_id FROM requests WHERE source_form_id=$1 ORDER BY id', [shared])).toEqual(requestsBefore);
        await expect(startRequest(creator, team, shared)).rejects.toThrow('Invalid request form');
        expect(await save(creator, team, shared, { name: 'Back again' })).toHaveLength(0);
        expect(await share(creator, team, shared, true)).toHaveLength(0);
        expect(await remove(creator, team, shared)).toHaveLength(0);
        expect(await rows('SELECT * FROM set_default_seller_form($1,$2,$3)', [creator, team, shared])).toHaveLength(0);
        await expect(
            rows('UPDATE intake_links SET is_default=TRUE WHERE id=$1', [shared]),
        ).rejects.toThrow('intake_links_deleted_not_default');

        // Its flat link name stays bound to it; its endings, current and earlier, are free again.
        expect(await rows('SELECT 1 FROM intake_link_aliases WHERE intake_link_id=$1', [shared])).not.toHaveLength(0);
        expect(await rows('SELECT 1 FROM seller_form_suffix_aliases WHERE form_id=$1', [shared])).toHaveLength(0);
        const other = String((await rows(
            'SELECT id FROM intake_links WHERE account_id=$1 AND organization_id=$2 AND deleted_at IS NULL AND NOT is_default LIMIT 1',
            [creator, team],
        ))[0].id);
        // An ending a living form still holds stays taken.
        const living = String((await rows(
            'SELECT suffix FROM seller_form_suffix_aliases WHERE form_id=$1 AND is_current', [first],
        ))[0].suffix);
        await expect(save(creator, team, other, { suffix: living })).rejects.toMatchObject({ code: 'SF423' });
        expect((await save(creator, team, other, { suffix: 'still-here' }))[0]).toMatchObject({ id: other });
        expect(await rows('SELECT form_id FROM seller_form_suffix_aliases WHERE suffix=$1 AND is_current', ['still-here']))
            .toEqual([{ form_id: other }]);
        // Later allocation never hands the deleted form an ending again.
        await rows('SELECT initialize_seller_form_links($1,$2,NULL,NULL)', [creator, team]);
        expect(await rows('SELECT 1 FROM seller_form_suffix_aliases WHERE form_id=$1', [shared])).toHaveLength(0);
    });

    it('frees the allowance a deleted personal form used and never picks it again', async () => {
        const usage = async () => Number((await rows(
            'SELECT COUNT(*)::int AS n FROM intake_links WHERE account_id=$1 AND organization_id=$2 AND shared_owner_account_id IS NULL AND deleted_at IS NULL',
            [creator, team],
        ))[0].n);
        let target = '';
        while (await usage() < 10) target = String((await create(creator, team)).id);
        await expect(create(creator, team)).rejects.toMatchObject({ code: 'SF402' });
        expect(await remove(creator, team, target)).toHaveLength(1);
        expect((await create(creator, team)).id).toBeTruthy();
        expect((await rows('SELECT id FROM ensure_seller_form($1,$2,$3,TRUE,500)', [creator, team, 'unused-slug']))[0].id).toBe(first);
    });

    it('reads through the query module: teammates see shared forms, deleted ones disappear, names stay bound', async () => {
        const target = (await rows(
            'SELECT id, slug, revision FROM intake_links WHERE account_id=$1 AND organization_id=$2 AND shared_owner_account_id IS NULL AND deleted_at IS NULL AND NOT is_default ORDER BY created_at, id LIMIT 1',
            [creator, team],
        ))[0];
        const id = String(target.id);
        await save(creator, team, id, { name: 'Handoff', suffix: 'handoff' });
        const sharedRow = await setSellerFormShared(creator, team, id, Number((await form(id)).revision), true);
        expect(sharedRow).toMatchObject({ shared_owner_account_id: creator });

        const forMember = await listWorkspaceSellerForms(member, team);
        expect(forMember.every((f) => f.shared_owner_account_id)).toBe(true);
        expect(forMember.find((f) => f.id === id)).toMatchObject({ owner_name: 'creator@example.test', account_id: creator });
        expect((await listWorkspaceSellerForms(creator, team))[0]).toMatchObject({ id: first, is_default: true });
        expect((await getUsableSellerForm(id, member, team))?.id).toBe(id);
        expect(await getUsableSellerForm(first, member, team)).toBeNull();
        expect(await getUsableSellerForm(id, member, undefined)).toBeNull();
        expect(await getSellerForm(id, member, team)).toBeNull();
        expect((await getSharedSellerFormUsage(team)).allowance).toBe(30);

        // Requests from the public link go to the current owner.
        await rows('UPDATE intake_links SET shared_owner_account_id=$1 WHERE id=$2', [admin, id]);
        expect((await publicFormScope((await form(id)) as never))?.account.id).toBe(admin);
        expect((await publicFormScope((await form(first)) as never))?.account.id).toBe(creator);

        const base = String((await rows(
            'SELECT r.slug FROM seller_form_link_namespaces n JOIN intake_links r ON r.id = n.root_form_id WHERE n.account_id=$1 AND n.organization_id=$2',
            [creator, team],
        ))[0].slug);
        expect((await getIntakeLinkBySuffix(base, 'handoff'))?.id).toBe(id);
        expect((await getIntakeLinkByBaseSlug(String(target.slug)))?.id).toBe(id);

        const deleted = await deleteSellerForm(admin, team, id, Number((await form(id)).revision));
        expect(deleted?.deleted_at).toBeTruthy();
        expect(await getIntakeLinkBySuffix(base, 'handoff')).toBeNull();
        expect(await getIntakeLinkByBaseSlug(String(target.slug))).toBeNull();
        // The bare link still opens the default; the alias still names its owner for referral codes.
        expect((await getIntakeLinkByBaseSlug(base))?.id).toBe(first);
        expect((await getIntakeLinkBySlug(String(target.slug)))?.account_id).toBe(creator);
        expect(await getUsableSellerForm(id, creator, team)).toBeNull();
        expect((await listSellerForms(creator, team)).some((f) => f.id === id)).toBe(false);
        expect((await listWorkspaceSellerForms(member, team)).some((f) => f.id === id)).toBe(false);
        const scope = await getSellerFormLinkScope(creator, team);
        expect(scope?.defaultFormId).toBe(first);
        expect(scope?.reserved.some((entry) => entry.suffix === 'handoff')).toBe(false);
        // The ending can be given to another form, and the old link then opens that form.
        const heir = String((await rows(
            'SELECT id FROM intake_links WHERE account_id=$1 AND organization_id=$2 AND deleted_at IS NULL AND NOT is_default ORDER BY created_at, id LIMIT 1',
            [creator, team],
        ))[0].id);
        await save(creator, team, heir, { suffix: 'handoff' });
        expect((await getIntakeLinkBySuffix(base, 'handoff'))?.id).toBe(heir);
    });

    it('still deletes a personal form on every plan', async () => {
        const second = String((await create(outsider, null).catch(() => ({ id: null }))).id);
        // Free allows one form, so the outsider's second is refused; upgrade, add one, downgrade, delete it.
        expect(second).toBe('null');
        await rows("UPDATE accounts SET subscription_status='pro' WHERE id=$1", [outsider]);
        const extra = String((await create(outsider, null)).id);
        await rows("UPDATE accounts SET subscription_status='free' WHERE id=$1", [outsider]);
        expect((await remove(outsider, null, extra))[0].deleted_at).not.toBeNull();
        expect(await remove(creator, null, extra)).toHaveLength(0);
    });
});

describe.sequential('shared seller forms: leaving a workspace', () => {
    const leaver = '00000000-0000-4000-8000-0000000000d1';
    const keeper = '00000000-0000-4000-8000-0000000000d2';
    const second = '00000000-0000-4000-8000-0000000000d3';
    const org = '00000000-0000-4000-8000-0000000000c9';

    it('hands shared forms to the admin with the membership removal and keeps their links accepting sellers', async () => {
        await db.exec(`
            INSERT INTO organizations(id,name,slug,subscription_status) VALUES ('${org}','Leaving Team','leaving-team','team');
            INSERT INTO accounts(id,email) VALUES ('${leaver}','leaver@example.test'), ('${keeper}','keeper@example.test'), ('${second}','second@example.test');
            INSERT INTO organization_members(account_id,organization_id,role,created_at) VALUES
                ('${leaver}','${org}','member','2026-01-03'), ('${keeper}','${org}','admin','2026-01-01'), ('${second}','${org}','admin','2026-01-02');
        `);
        const personal = String((await create(leaver, org)).id);
        const sharedId = String((await create(leaver, org, { name: 'Team listing', suffix: 'listing' })).id);
        await share(leaver, org, sharedId, true);
        const base = String((await form(personal)).slug);
        const revision = Number((await form(sharedId)).revision);

        // The removing admin receives everything, as for requests and Branding Profiles.
        const result = await removeOrganizationMemberWithHandover({ organizationId: org, accountId: leaver, preferredAccountId: second });
        expect(result).toEqual({ removed: true, requestsMoved: 0, profilesMoved: 0, formsMoved: 1, recipientAccountId: second });

        expect(await form(sharedId)).toMatchObject({ account_id: leaver, shared_owner_account_id: second, revision, is_active: true });
        expect(await form(personal)).toMatchObject({ account_id: leaver, shared_owner_account_id: null });
        expect((await getIntakeLinkBySuffix(base, 'listing'))?.id).toBe(sharedId);
        expect((await publicFormScope((await form(sharedId)) as never))?.account.id).toBe(second);
        expect(await startRequest(second, org, sharedId)).toHaveLength(1);
        expect(await startRequest(keeper, org, sharedId)).toHaveLength(1);
        // Their own form stops, as before.
        expect(await publicFormScope((await form(personal)) as never)).toBeNull();
        await expect(startRequest(leaver, org, personal)).rejects.toThrow('Form unavailable');
    });

    it('refuses to remove the last admin while they own a shared form, changing nothing', async () => {
        await rows('DELETE FROM organization_members WHERE organization_id=$1 AND account_id=$2', [org, keeper]);
        const before = await rows('SELECT id, shared_owner_account_id FROM intake_links WHERE organization_id=$1 ORDER BY id', [org]);
        expect(await removeOrganizationMemberWithHandover({ organizationId: org, accountId: second }))
            .toEqual({ removed: false, reason: 'last_admin' });
        expect(await rows('SELECT id, shared_owner_account_id FROM intake_links WHERE organization_id=$1 ORDER BY id', [org])).toEqual(before);
    });
});

describe.sequential('shared seller forms: closing an account', () => {
    const closer = '00000000-0000-4000-8000-0000000000e1';
    const boss = '00000000-0000-4000-8000-0000000000e2';
    const plain = '00000000-0000-4000-8000-0000000000e3';
    const shop = '00000000-0000-4000-8000-0000000000c7';
    const solo = '00000000-0000-4000-8000-0000000000c8';
    const claim = (account: string) => db.exec(`
        UPDATE accounts SET closure_status='closing' WHERE id='${account}';
        INSERT INTO account_closures(account_id, step) VALUES ('${account}','billing_canceled');
    `);
    let linkName: string;
    let own: string;
    let extra: string;
    let team: string;

    it('counts the shared forms a person owns and needs an admin for them', async () => {
        await db.exec(`
            INSERT INTO organizations(id,name,slug,subscription_status) VALUES
                ('${shop}','Closing Shop','closing-shop','team'), ('${solo}','Solo','closing-solo','free');
            INSERT INTO accounts(id,email,subscription_status) VALUES ('${closer}','closer@example.test','pro'),
                ('${boss}','boss@example.test','free'), ('${plain}','plain@example.test','free');
            INSERT INTO organization_members(account_id,organization_id,role) VALUES
                ('${closer}','${shop}','member'), ('${boss}','${shop}','admin'), ('${closer}','${solo}','admin');
        `);
        own = String((await create(closer, shop, { name: 'Private name', sellerIntro: 'Private words' })).id);
        team = String((await create(closer, shop, { name: 'Offer', suffix: 'offer' })).id);
        extra = String((await create(closer, shop)).id);
        await create(closer, solo);
        await create(closer, null);
        await share(closer, shop, team, true);
        linkName = String((await form(own)).slug);

        const snapshot = await getAccountClosureSnapshot(closer, 'closer@example.test');
        expect(snapshot?.workspaces.find((workspace) => workspace.id === shop)).toMatchObject({
            owned_shared_form_count: 1, owned_request_count: 0, owned_profile_count: 0,
        });
        expect(snapshot?.personal.has_seller_form).toBe(true);

        // Without an admin chosen for the shared form nothing is removed.
        await claim(closer);
        const before = await rows('SELECT id FROM intake_links WHERE account_id=$1 ORDER BY id', [closer]);
        await expect(
            removeAccountClosureData({ accountId: closer, email: 'closer@example.test', soleOrganizationIds: [solo], transfers: {} }),
        ).rejects.toBeInstanceOf(AccountClosureConflictError);
        expect(await rows('SELECT id FROM intake_links WHERE account_id=$1 ORDER BY id', [closer])).toEqual(before);
        expect(await rows('SELECT 1 FROM organizations WHERE id=$1', [solo])).toHaveLength(1);
    });

    it('keeps the shared form and its link, hands it to the chosen admin and removes everything else', async () => {
        await removeAccountClosureData({
            accountId: closer, email: 'closer@example.test', soleOrganizationIds: [solo], transfers: { [shop]: boss },
        });

        expect(await form(team)).toMatchObject({
            account_id: closer, shared_owner_account_id: boss, deleted_at: null, is_active: true, name: 'Offer',
        });
        // The form that owns the link name stays as an empty, deleted placeholder.
        expect(await form(own)).toMatchObject({
            slug: linkName, is_active: false, is_default: false, name: 'My seller form', seller_intro: null,
        });
        expect((await form(own)).deleted_at).not.toBeNull();
        expect(await form(extra)).toBeUndefined();
        expect(await rows('SELECT id FROM intake_links WHERE account_id=$1 ORDER BY id', [closer]))
            .toEqual([{ id: own }, { id: team }].sort((a, b) => a.id.localeCompare(b.id)));
        expect(await rows('SELECT 1 FROM organizations WHERE id=$1', [solo])).toHaveLength(0);
        expect(await rows('SELECT 1 FROM organization_members WHERE account_id=$1', [closer])).toHaveLength(0);

        expect((await getIntakeLinkBySuffix(linkName, 'offer'))?.id).toBe(team);
        expect((await publicFormScope((await form(team)) as never))?.account.id).toBe(boss);
        expect(await startRequest(boss, shop, team)).toHaveLength(1);
        expect((await save(boss, shop, team, { name: 'Offer, edited' }))[0]).toMatchObject({ name: 'Offer, edited' });
        expect((await listWorkspaceSellerForms(boss, shop)).map((f) => f.id)).toContain(team);
        expect((await listWorkspaceSellerForms(boss, shop)).map((f) => f.id)).not.toContain(own);
    });

    it('still removes every form and link name of someone who shared nothing', async () => {
        await rows("INSERT INTO organization_members(account_id,organization_id,role) VALUES ($1,$2,'member')", [plain, shop]);
        const mine = String((await create(plain, shop)).id);
        await claim(plain);
        await removeAccountClosureData({ accountId: plain, email: 'plain@example.test', soleOrganizationIds: [], transfers: {} });
        expect(await form(mine)).toBeUndefined();
        expect(await rows('SELECT 1 FROM intake_links WHERE account_id=$1', [plain])).toHaveLength(0);
        expect(await rows('SELECT 1 FROM seller_form_link_namespaces WHERE account_id=$1', [plain])).toHaveLength(0);
    });
});

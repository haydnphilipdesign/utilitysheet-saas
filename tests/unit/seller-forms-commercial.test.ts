// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import {
    beforeAll,
    afterAll,
    describe,
    expect,
    it,
    vi,
    afterEach,
} from 'vitest';
import { sellerFormCapabilities } from '@/lib/seller-forms/capabilities';
import { formRequestFields } from '@/lib/seller-forms/config';
import type { IntakeLink } from '@/lib/neon/queries/intake-links';
const db = new PGlite();
const rows = async (sql: string, args: unknown[] = []) =>
    (await db.query<Record<string, unknown>>(sql, args)).rows;
beforeAll(async () => {
    await db.exec(
        readFileSync('schema.sql', 'utf8')
            .replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', '')
            .replaceAll('uuid_generate_v4()', 'gen_random_uuid()'),
    );
}, 30000);
afterAll(async () => {
    await db.close();
});
afterEach(() => vi.unstubAllEnvs());
async function seed(plan = 'free', team = false) {
    const owner = randomUUID(),
        org = randomUUID();
    await rows(
        'INSERT INTO accounts(id,email,subscription_status) VALUES ($1,$2,$3)',
        [owner, 'synthetic@example.test', plan],
    );
    await rows(
        'INSERT INTO organizations(id,name,slug,subscription_status) VALUES ($1,$2,$3,$4)',
        [org, 'Synthetic workspace', org, team ? 'team' : 'free'],
    );
    await rows(
        'INSERT INTO organization_members(account_id,organization_id) VALUES ($1,$2)',
        [owner, org],
    );
    return { owner, org };
}
const ensure = (
    owner: string,
    org: string | null,
    eligible = true,
    cap = 100,
) =>
    rows('SELECT * FROM ensure_seller_form($1,$2,$3,$4,$5)', [
        owner,
        org,
        randomUUID(),
        eligible,
        cap,
    ]);
const create = (owner: string, org: string | null, patch = {}) =>
    rows(
        'SELECT * FROM save_seller_form($1,$2,NULL,NULL,$3::jsonb,$4,100,TRUE)',
        [
            owner,
            org,
            JSON.stringify({ name: 'Synthetic form', ...patch }),
            randomUUID(),
        ],
    );

describe.sequential('approved saved-form commercial policy', () => {
    it('allows Free one form per workspace; paused rows count and extra workspaces still obey rollout/cap', async () => {
        const { owner, org } = await seed();
        const first = (await ensure(owner, null, false))[0];
        await rows('UPDATE intake_links SET is_active=FALSE WHERE id=$1', [
            first.id,
        ]);
        await expect(create(owner, null)).rejects.toMatchObject({
            code: 'SF402',
        });
        expect(await ensure(owner, org, false)).toHaveLength(0);
        expect(await ensure(owner, org, true, 1)).toHaveLength(0);
        expect(await ensure(owner, org)).toHaveLength(1);
        await expect(create(owner, org)).rejects.toMatchObject({
            code: 'SF402',
        });
        expect(
            await rows('SELECT id FROM intake_links WHERE account_id=$1', [
                owner,
            ]),
        ).toHaveLength(2);
        expect(await ensure(owner, null, false)).toHaveLength(1); // retained paused default
    });
    it.each(['pro', 'team'])(
        'enforces paid ten-form allowance using %s scope and separates member/workspace counts',
        async (plan) => {
            const { owner, org } = await seed(
                plan === 'pro' ? 'pro' : 'free',
                plan === 'team',
            );
            await ensure(owner, org);
            for (let n = 1; n < 10; n++) await create(owner, org);
            await rows(
                'UPDATE intake_links SET is_active=FALSE WHERE account_id=$1 AND organization_id=$2',
                [owner, org],
            );
            await expect(create(owner, org)).rejects.toMatchObject({
                code: 'SF402',
            });
            const member = randomUUID();
            await rows('INSERT INTO accounts(id,email) VALUES ($1,$2)', [
                member,
                'other@example.test',
            ]);
            await rows(
                'INSERT INTO organization_members(account_id,organization_id) VALUES ($1,$2)',
                [member, org],
            );
            expect(await ensure(member, org)).toHaveLength(1);
            expect(await ensure(owner, null)).toHaveLength(1); // separate creator/workspace count
            if (plan === 'team') {
                // Selecting another paid workspace cannot unlock this personal form.
                await rows(
                    'UPDATE accounts SET active_organization_id=$2 WHERE id=$1',
                    [owner, org],
                );
                await expect(create(owner, null)).rejects.toMatchObject({
                    code: 'SF402',
                });
            }
            const foreign = randomUUID();
            await rows('INSERT INTO accounts(id,email) VALUES ($1,$2)', [
                foreign,
                'foreign@example.test',
            ]);
            expect(await ensure(foreign, org)).toHaveLength(0);
            expect(await create(foreign, org)).toHaveLength(0);
        },
    );
    it.each(['pro', 'team'])(
        'retains URLs/configuration on %s downgrade, permits edits/starts and restores paid behavior after re-upgrade',
        async (plan) => {
            const { owner, org } = await seed(
                plan === 'pro' ? 'pro' : 'free',
                plan === 'team',
            );
            const first = (
                await ensure(owner, org)
            )[0] as unknown as IntakeLink;
            const extra = (
                await create(owner, org, {
                    defaultPacketMode: 'advanced',
                    advancedModules: ['service_providers'],
                    sellerIntro: 'Known details only',
                })
            )[0] as unknown as IntakeLink;
            const aliasesBefore = await rows(
                'SELECT slug FROM intake_link_aliases WHERE intake_link_id=$1',
                [extra.id],
            );
            await rows(
                plan === 'pro'
                    ? "UPDATE accounts SET subscription_status='free' WHERE id=$1"
                    : "UPDATE organizations SET subscription_status='free' WHERE id=$1",
                [plan === 'pro' ? owner : org],
            );
            await expect(create(owner, org)).rejects.toMatchObject({
                code: 'SF402',
            });
            const edited = (
                await rows(
                    'SELECT * FROM save_seller_form($1,$2,$3,1,$4::jsonb,$5,NULL,FALSE)',
                    [
                        owner,
                        org,
                        extra.id,
                        '{"name":"Reuse existing","isActive":true}',
                        'unused',
                    ],
                )
            )[0] as unknown as IntakeLink;
            expect(edited.default_packet_mode).toBe('advanced');
            expect(formRequestFields(edited, false).packetMode).toBe('simple');
            await rows(
                'INSERT INTO requests(account_id,organization_id,property_address,public_token,seller_token,source_form_id,source_form_revision) VALUES ($1,$2,$3,$4,$5,$6,2)',
                [
                    owner,
                    org,
                    '123 Synthetic Street',
                    randomUUID(),
                    randomUUID(),
                    extra.id,
                ],
            );
            expect(
                await rows(
                    'SELECT source_form_id,seller_intro FROM requests WHERE account_id=$1',
                    [owner],
                ),
            ).toEqual([
                {
                    source_form_id: extra.id,
                    seller_intro: 'Known details only',
                },
            ]);
            expect(
                await rows(
                    'SELECT slug FROM intake_link_aliases WHERE intake_link_id=$1',
                    [extra.id],
                ),
            ).toEqual(aliasesBefore);
            expect(
                await rows('SELECT id FROM intake_links WHERE id=$1', [
                    first.id,
                ]),
            ).toHaveLength(1);
            await rows(
                plan === 'pro'
                    ? "UPDATE accounts SET subscription_status='pro' WHERE id=$1"
                    : "UPDATE organizations SET subscription_status='team' WHERE id=$1",
                [plan === 'pro' ? owner : org],
            );
            expect(formRequestFields(edited, true).packetMode).toBe('advanced');
            expect(await create(owner, org)).toHaveLength(1);
        },
    );
    it('keeps operational denial separate from commercial allowance and never allocates via the old writer signature', async () => {
        const { owner } = await seed('pro');
        await ensure(owner, null);
        await expect(
            rows(
                'SELECT * FROM save_seller_form($1,NULL,NULL,NULL,$2::jsonb,$3,100)',
                [owner, '{}', randomUUID()],
            ),
        ).rejects.toMatchObject({ code: 'SF403' });
        vi.stubEnv('SAVED_SELLER_FORMS_ENABLED', 'false');
        expect(sellerFormCapabilities(owner, false, 1, 1)).toMatchObject({
            reason: 'commercial',
            allowance: 1,
            usage: 1,
            upgradeRequired: true,
        });
        expect(sellerFormCapabilities(owner, true, 1, 1).reason).toBe('pilot');
        vi.stubEnv('SAVED_SELLER_FORMS_ENABLED', 'true');
        vi.stubEnv('SAVED_SELLER_FORMS_PILOT_ACCOUNT_IDS', owner);
        vi.stubEnv('SAVED_SELLER_FORMS_TECHNICAL_CAP', '3');
        expect(sellerFormCapabilities(owner, true, 1, 3).reason).toBe(
            'technical',
        );
        expect(sellerFormCapabilities(owner, true, 10, 10).reason).toBe(
            'commercial',
        );
        expect(sellerFormCapabilities(owner, false, 0, 1)).toMatchObject({
            canCreate: true,
            allowance: 1,
        });
    });
});

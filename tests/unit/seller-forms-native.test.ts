// @vitest-environment node
import {
    execFileSync,
    spawn,
    type ChildProcessWithoutNullStreams,
} from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Opt in with a local PostgreSQL bin directory. This harness initializes its own
// throwaway cluster; it never consumes DATABASE_URL or any ambient PG connection.
const binaryDir = process.env.SAVED_FORMS_TEST_PG_BIN;
const testEnv = { ...process.env };
for (const key of Object.keys(testEnv))
    if (key.startsWith('PG')) delete testEnv[key];
const executable = (name: string) =>
    join(binaryDir!, `${name}${process.platform === 'win32' ? '.exe' : ''}`);
let root: string;
let port: number;
let started = false;
let a: Session;
let b: Session;

class Session {
    child: ChildProcessWithoutNullStreams;
    pid = 0;
    private sequence = 0;
    constructor() {
        this.child = spawn(
            executable('psql'),
            [
                '-X',
                '-q',
                '-At',
                '-P',
                'pager=off',
                '-h',
                '127.0.0.1',
                '-p',
                String(port),
                '-U',
                'postgres',
                '-d',
                'postgres',
            ],
            { env: testEnv, windowsHide: true },
        );
    }
    // One in-flight command per session; independent sessions may block each other.
    query(sql: string): Promise<string> {
        const marker = `query_end_${++this.sequence}`;
        return new Promise((accept, reject) => {
            let output = '';
            let errors = '';
            const timer = setTimeout(() => {
                cleanup();
                reject(new Error('Local PostgreSQL command timed out'));
            }, 10000);
            const cleanup = () => {
                clearTimeout(timer);
                this.child.stdout.off('data', stdout);
                this.child.stderr.off('data', stderr);
                this.child.off('exit', exited);
            };
            const stdout = (chunk: Buffer) => {
                output += chunk.toString();
                if (output.includes(marker)) {
                    cleanup();
                    if (/ERROR:|FATAL:/.test(errors)) reject(new Error(errors));
                    else accept(output.split(marker)[0].trim());
                }
            };
            const stderr = (chunk: Buffer) => {
                errors += chunk.toString();
            };
            const exited = () => {
                cleanup();
                reject(new Error(`Local psql exited: ${errors}`));
            };
            this.child.stdout.on('data', stdout);
            this.child.stderr.on('data', stderr);
            this.child.once('exit', exited);
            this.child.stdin.write(`${sql}\n\\echo ${marker}\n`);
        });
    }
    async close() {
        if (this.child.exitCode !== null) return;
        const exited = new Promise<void>((done) =>
            this.child.once('exit', () => done()),
        );
        this.child.stdin.end('\\q\n');
        await exited;
    }
}
async function waitForBlock(blocker: Session, blocked: Session) {
    const until = Date.now() + 3000;
    while (Date.now() < until) {
        if (
            (await blocker.query(
                `SELECT ${blocker.pid} = ANY(pg_blocking_pids(${blocked.pid}));`,
            )) === 't'
        )
            return;
        await new Promise((done) => setTimeout(done, 20));
    }
    throw new Error(
        'Expected connection did not block on the owner transaction',
    );
}
async function seed() {
    const owner = randomUUID();
    const org = randomUUID();
    await a.query(
        `INSERT INTO accounts(id,email,subscription_status) VALUES ('${owner}','synthetic@example.test','pro'); INSERT INTO organizations(id,name,slug) VALUES ('${org}','Synthetic B','${org}'); INSERT INTO organization_members(account_id,organization_id) VALUES ('${owner}','${org}');`,
    );
    const form = await a.query(
        `SELECT id FROM ensure_seller_form('${owner}',NULL,'${randomUUID()}');`,
    );
    return { owner, org, form };
}

describe
    .skipIf(!binaryDir)
    .sequential(
        'disposable native PostgreSQL with full schema and real FKs',
        () => {
            beforeAll(async () => {
                root = mkdtempSync(
                    join(tmpdir(), 'utilitysheet-saved-forms-test-'),
                );
                port = await new Promise<number>((accept, reject) => {
                    const probe = createServer();
                    probe.on('error', reject);
                    probe.listen(0, '127.0.0.1', () => {
                        const address = probe.address();
                        const freePort =
                            typeof address === 'object' && address
                                ? address.port
                                : 0;
                        probe.close(() => accept(freePort));
                    });
                });
                execFileSync(
                    executable('initdb'),
                    [
                        '-D',
                        join(root, 'data'),
                        '-A',
                        'trust',
                        '-U',
                        'postgres',
                        '--no-locale',
                        '-E',
                        'UTF8',
                    ],
                    { env: testEnv, windowsHide: true, stdio: 'pipe' },
                );
                execFileSync(
                    executable('pg_ctl'),
                    [
                        '-D',
                        join(root, 'data'),
                        '-l',
                        join(root, 'server.log'),
                        '-o',
                        `-h 127.0.0.1 -p ${port}`,
                        '-w',
                        'start',
                    ],
                    {
                        env: testEnv,
                        windowsHide: true,
                        stdio: 'ignore',
                        timeout: 15000,
                    },
                );
                started = true;
                a = new Session();
                b = new Session();
                for (const client of [a, b]) {
                    await client.query(
                        "\\set VERBOSITY verbose\nSET statement_timeout='5s'; SET deadlock_timeout='100ms';",
                    );
                    client.pid = Number(
                        await client.query('SELECT pg_backend_pid();'),
                    );
                }
                await a.query(readFileSync('schema.sql', 'utf8'));
                // Rehearse revised additive migration on native PostgreSQL as well.
                await a.query(
                    readFileSync(
                        'migrations-saved-seller-forms-expand.sql',
                        'utf8',
                    ),
                );
                await a.query(
                    readFileSync(
                        'migrations-saved-seller-forms-enable.sql',
                        'utf8',
                    ),
                );
                await a.query(readFileSync('migrations-seller-form-base-links.sql', 'utf8'));
                await a.query(readFileSync('migrations-seller-form-default-base-link.sql', 'utf8'));
                await a.query(readFileSync('migrations-seller-form-readable-endings.sql', 'utf8'));
                await a.query(readFileSync('migrations-seller-form-heading.sql', 'utf8'));
                expect(
                    await a.query(
                        "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='requests'::regclass AND contype='f' AND confrelid='accounts'::regclass;",
                    ),
                ).toBe('1');
            }, 60000);
            afterAll(async () => {
                if (a) await a.close();
                if (b) await b.close();
                if (started)
                    execFileSync(
                        executable('pg_ctl'),
                        [
                            '-D',
                            join(root, 'data'),
                            '-m',
                            'immediate',
                            '-w',
                            'stop',
                        ],
                        {
                            env: testEnv,
                            windowsHide: true,
                            stdio: 'ignore',
                            timeout: 15000,
                        },
                    );
                // Only the generated temporary cluster is eligible for recursive cleanup.
                if (
                    root &&
                    dirname(resolve(root)) === resolve(tmpdir()) &&
                    basename(root).startsWith('utilitysheet-saved-forms-test-')
                )
                    rmSync(root, { recursive: true, force: true });
            }, 30000);

            it('rehearses legacy-schema expand, old writers, repeat backfill and enable without losing identity', async () => {
                await a.query('CREATE DATABASE saved_forms_rehearsal;');
                const run = (input: string) => execFileSync(executable('psql'), [
                    '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1',
                    '-p', String(port), '-U', 'postgres', '-d', 'saved_forms_rehearsal',
                ], { input, env: testEnv, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
                // Last production schema before saved forms. CI fetches history explicitly.
                run(execFileSync('git', ['show', 'f771115:schema.sql'], { encoding: 'utf8', windowsHide: true }));
                const owner = randomUUID(), org = randomUUID(), original = randomUUID(), late = randomUUID();
                run(`INSERT INTO organizations(id,name,slug) VALUES ('${org}','Synthetic','${org}');
                    INSERT INTO accounts(id,email,subscription_status,active_organization_id,notification_preferences)
                    VALUES ('${owner}','migration@example.test','pro','${org}','{"collect_hoa_questions":false}'),
                           ('${late}','late@example.test','pro',NULL,'{}');
                    INSERT INTO organization_members(account_id,organization_id) VALUES ('${owner}','${org}');
                    INSERT INTO intake_links(id,account_id,slug,is_active) VALUES ('${original}','${owner}','original-link',FALSE);`);
                const expand = readFileSync('migrations-saved-seller-forms-expand.sql', 'utf8');
                run(expand);
                run(`INSERT INTO intake_links(account_id,slug) VALUES ('${late}','late-link') ON CONFLICT(account_id) DO NOTHING;
                    UPDATE accounts SET active_organization_id=NULL WHERE id='${owner}';`);
                run(expand);
                run(`DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM intake_links WHERE id='${original}' AND slug='original-link'
                        AND organization_id='${org}' AND NOT is_active AND NOT collect_hoa_questions
                        AND collect_electric_meter_number AND is_default AND is_referral_identity AND scope_initialized)
                        THEN RAISE EXCEPTION 'Original identity or configuration changed'; END IF;
                    IF (SELECT count(*) FROM intake_link_aliases) <> 2 THEN RAISE EXCEPTION 'Missing aliases'; END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='intake_links_account_id_key')
                        THEN RAISE EXCEPTION 'Uniqueness removed early'; END IF;
                    END $$;`);
                run(readFileSync('migrations-saved-seller-forms-enable.sql', 'utf8'));
                run(`SELECT id FROM save_seller_form('${owner}','${org}',NULL,NULL,'{"name":"Closing"}','closing-link',50,TRUE);
                    DO $$ BEGIN
                    IF (SELECT count(*) FROM intake_links WHERE account_id='${owner}') <> 2
                        THEN RAISE EXCEPTION 'Additional form did not allocate'; END IF;
                    IF NOT EXISTS (SELECT 1 FROM intake_link_aliases WHERE slug='original-link' AND intake_link_id='${original}')
                        THEN RAISE EXCEPTION 'Original link lost'; END IF;
                    END $$;`);
            }, 30000);

            it.each(['ensure-first', 'create-first'])(
                'serializes additional ensure vs explicit create at cap two (%s)',
                async (order) => {
                    const { owner, org } = await seed();
                    const ensure = `SELECT id FROM ensure_seller_form('${owner}','${org}','${randomUUID()}',TRUE,2);`;
                    const create = `SELECT id FROM save_seller_form('${owner}',NULL,NULL,NULL,'{"name":"Extra"}', '${randomUUID()}',2,TRUE);`;
                    await a.query('BEGIN;');
                    let pending: Promise<unknown> | undefined;
                    try {
                        await a.query(
                            order === 'ensure-first' ? ensure : create,
                        );
                        // Attach rejection handler immediately so expected SF429 is not unhandled.
                        pending = b
                            .query(order === 'ensure-first' ? create : ensure)
                            .then(
                                (value) => ({ value }),
                                (error) => ({ error }),
                            );
                        await waitForBlock(a, b);
                        await a.query('COMMIT;');
                        const outcome = (await pending) as {
                            value?: string;
                            error?: Error;
                        };
                        if (order === 'ensure-first')
                            expect(outcome.error?.message).toContain('SF429');
                        else expect(outcome.value).toBe('');
                        expect(
                            await a.query(
                                `SELECT COUNT(*) FROM intake_links WHERE account_id='${owner}';`,
                            ),
                        ).toBe('2');
                    } finally {
                        await a.query('ROLLBACK;');
                        if (pending) await pending;
                    }
                },
                15000,
            );

            it('serializes concurrent suffix allocation and rolls back the losing form', async () => {
                const { owner } = await seed();
                await a.query('BEGIN;');
                let pending: Promise<{ value?: string; error?: Error }> | undefined;
                try {
                    const winner = await a.query(`SELECT id FROM save_seller_form('${owner}',NULL,NULL,NULL,'{"name":"One","suffix":"closing"}','${randomUUID()}',50,TRUE);`);
                    pending = b.query(`SELECT id FROM save_seller_form('${owner}',NULL,NULL,NULL,'{"name":"Two","suffix":"closing"}','${randomUUID()}',50,TRUE);`)
                        .then(value => ({ value }), error => ({ error }));
                    await waitForBlock(a, b);
                    await a.query('COMMIT;');
                    expect((await pending).error?.message).toContain('SF423');
                    expect(await a.query(`SELECT count(*) FROM intake_links WHERE account_id='${owner}';`)).toBe('2');
                    expect(await a.query(`SELECT form_id FROM seller_form_suffix_aliases WHERE suffix='closing' AND form_id='${winner}';`)).toBe(winner);
                } finally {
                    await a.query('ROLLBACK;');
                    await pending;
                }
            }, 15000);

            it('reserves a base globally when two different creators claim it', async () => {
                const first = await seed();
                const second = await seed();
                const slug = `shared-${randomUUID()}`;
                await a.query('BEGIN;');
                let pending: Promise<{ value?: string; error?: Error }> | undefined;
                try {
                    await a.query(`SELECT id FROM save_seller_form('${first.owner}',NULL,'${first.form}',1,'{"slug":"${slug}"}','unused',50,TRUE);`);
                    pending = b.query(`SELECT id FROM save_seller_form('${second.owner}',NULL,'${second.form}',1,'{"slug":"${slug}"}','unused',50,TRUE);`)
                        .then(value => ({ value }), error => ({ error }));
                    await waitForBlock(a, b);
                    await a.query('COMMIT;');
                    expect((await pending).error?.message).toContain('23505');
                    expect(await a.query(`SELECT intake_link_id FROM intake_link_aliases WHERE slug='${slug}';`)).toBe(first.form);
                    expect(await a.query(`SELECT revision FROM intake_links WHERE id='${second.form}';`)).toBe('1');
                } finally {
                    await a.query('ROLLBACK;');
                    await pending;
                }
            }, 15000);

            it('keeps the base owner pinned through default changes racing a base rename', async () => {
                const { owner, form } = await seed();
                const child = await a.query(`SELECT id FROM save_seller_form('${owner}',NULL,NULL,NULL,'{"name":"Closing","suffix":"closing"}','${randomUUID()}',50,TRUE);`);
                await a.query('BEGIN;');
                let pending: Promise<{ value?: string; error?: Error }> | undefined;
                try {
                    await a.query(`SELECT id FROM set_default_seller_form('${owner}',NULL,'${child}');`);
                    pending = b.query(`SELECT id FROM save_seller_form('${owner}',NULL,'${form}',1,'{"slug":"renamed-${randomUUID()}"}','unused',50,TRUE);`)
                        .then(value => ({ value }), error => ({ error }));
                    await waitForBlock(a, b);
                    await a.query('COMMIT;');
                    expect((await pending).error?.message).toContain('SF409');
                    expect(await a.query(`SELECT root_form_id FROM seller_form_link_namespaces WHERE account_id='${owner}';`)).toBe(form);
                    expect(await a.query(`SELECT id FROM intake_links WHERE account_id='${owner}' AND is_default;`)).toBe(child);
                } finally {
                    await a.query('ROLLBACK;');
                    await pending;
                }
            }, 15000);

            it('retains nested identity through a repeated migration and compatible old writer calls', async () => {
                const { owner, form } = await seed();
                // The old saved-form application does not send a suffix key.
                const child = await a.query(`SELECT id FROM save_seller_form('${owner}',NULL,NULL,NULL,'{"name":"Private old name"}','${randomUUID()}',50,TRUE);`);
                await a.query(readFileSync('migrations-seller-form-base-links.sql', 'utf8'));
                await a.query(readFileSync('migrations-seller-form-default-base-link.sql', 'utf8'));
                await a.query(readFileSync('migrations-seller-form-readable-endings.sql', 'utf8'));
                await a.query(readFileSync('migrations-seller-form-heading.sql', 'utf8'));
                await a.query(`SELECT id FROM save_seller_form('${owner}',NULL,'${child}',1,'{"name":"Changed only"}','unused',50);`);
                expect(await a.query(`SELECT root_form_id FROM seller_form_link_namespaces WHERE account_id='${owner}';`)).toBe(form);
                // The base owner keeps one current ending and may rename it.
                expect(await a.query(`SELECT count(*) FROM seller_form_suffix_aliases WHERE form_id='${form}' AND is_current;`)).toBe('1');
                await a.query(`SELECT id FROM save_seller_form('${owner}',NULL,'${form}',1,'{"suffix":"main"}','unused',50);`);
                expect(await a.query(`SELECT suffix FROM seller_form_suffix_aliases WHERE form_id='${form}' AND is_current;`)).toBe('main');
                expect(await a.query(`SELECT suffix FROM seller_form_suffix_aliases WHERE form_id='${child}' AND is_current;`)).toBe('form-2');
            }, 15000);

            it('waits on account before form: a racing save completes and start gets a recoverable revision conflict', async () => {
                const { owner, form } = await seed();
                await a.query(
                    `BEGIN; SELECT id FROM accounts WHERE id='${owner}' FOR UPDATE;`,
                );
                const pending = b
                    .query(
                        `INSERT INTO requests(account_id,property_address,public_token,seller_token,source_form_id,source_form_revision) VALUES ('${owner}','123 Synthetic Street','${randomUUID()}','${randomUUID()}','${form}',1);`,
                    )
                    .then(
                        (value) => ({ value }),
                        (error) => ({ error }),
                    );
                try {
                    await waitForBlock(a, b);
                    await a.query(
                        `SELECT revision FROM save_seller_form('${owner}',NULL,'${form}',1,'{"sellerIntro":"New introduction"}','unused',NULL); COMMIT;`,
                    );
                    expect(
                        ((await pending) as { error?: Error }).error?.message,
                    ).toContain('SF409');
                    expect(
                        await a.query(
                            `SELECT COUNT(*) FROM requests WHERE account_id='${owner}';`,
                        ),
                    ).toBe('0');
                    await b.query(
                        `INSERT INTO requests(account_id,property_address,public_token,seller_token,source_form_id,source_form_revision) VALUES ('${owner}','123 Synthetic Street','${randomUUID()}','${randomUUID()}','${form}',2);`,
                    );
                    expect(
                        await a.query(
                            `SELECT seller_intro FROM requests WHERE account_id='${owner}';`,
                        ),
                    ).toBe('New introduction');
                } finally {
                    await a.query('ROLLBACK;');
                    await pending;
                }
            }, 15000);

            it('serializes save after an inserted snapshot without changing the started request', async () => {
                const { owner, form } = await seed();
                await a.query(
                    `BEGIN; INSERT INTO requests(account_id,property_address,public_token,seller_token,source_form_id,source_form_revision) VALUES ('${owner}','456 Synthetic Street','${randomUUID()}','${randomUUID()}','${form}',1);`,
                );
                const pending = b
                    .query(
                        `SELECT revision FROM save_seller_form('${owner}',NULL,'${form}',1,'{"sellerIntro":"After start"}','unused',NULL);`,
                    )
                    .then(
                        (value) => ({ value }),
                        (error) => ({ error }),
                    );
                try {
                    await waitForBlock(a, b);
                    await a.query('COMMIT;');
                    expect(await pending).toEqual({ value: '2' });
                    expect(
                        await a.query(
                            `SELECT source_form_revision FROM requests WHERE account_id='${owner}';`,
                        ),
                    ).toBe('1');
                    expect(
                        await a.query(
                            `SELECT seller_intro IS NULL FROM requests WHERE account_id='${owner}';`,
                        ),
                    ).toBe('t');
                } finally {
                    await a.query('ROLLBACK;');
                    await pending;
                }
            }, 15000);

            it.each(['ensure-first', 'create-first'])(
                'serializes Free workspace commercial allocation (%s)',
                async (order) => {
                    const { owner, org } = await seed();
                    await a.query(
                        `UPDATE accounts SET subscription_status='free' WHERE id='${owner}'; BEGIN;`,
                    );
                    const ensure = `SELECT id FROM ensure_seller_form('${owner}','${org}','${randomUUID()}',TRUE,100);`;
                    const create = `SELECT id FROM save_seller_form('${owner}','${org}',NULL,NULL,'{}','${randomUUID()}',100,TRUE);`;
                    let pending: Promise<unknown> | undefined;
                    try {
                        await a.query(
                            order === 'ensure-first' ? ensure : create,
                        );
                        pending = b
                            .query(order === 'ensure-first' ? create : ensure)
                            .then(
                                (value) => ({ value }),
                                (error) => ({ error }),
                            );
                        await waitForBlock(a, b);
                        await a.query('COMMIT;');
                        const outcome = (await pending) as {
                            value?: string;
                            error?: Error;
                        };
                        if (order === 'ensure-first')
                            expect(outcome.error?.message).toContain('SF402');
                        else expect(outcome.value).not.toBe(''); // ensure reads the winner, no second allocation
                        expect(
                            await a.query(
                                `SELECT COUNT(*) FROM intake_links WHERE account_id='${owner}' AND organization_id='${org}';`,
                            ),
                        ).toBe('1');
                    } finally {
                        await a.query('ROLLBACK;');
                        if (pending) await pending;
                    }
                },
                15000,
            );

            it('serializes two paid creates at nine: only the tenth form is allocated', async () => {
                const { owner } = await seed();
                const create = () =>
                    `SELECT id FROM save_seller_form('${owner}',NULL,NULL,NULL,'{}','${randomUUID()}',100,TRUE);`;
                for (let n = 1; n < 9; n++) await a.query(create());
                await a.query('BEGIN;');
                let pending: Promise<unknown> | undefined;
                try {
                    await a.query(create());
                    pending = b.query(create()).then(
                        (value) => ({ value }),
                        (error) => ({ error }),
                    );
                    await waitForBlock(a, b);
                    await a.query('COMMIT;');
                    expect(
                        ((await pending) as { error?: Error }).error?.message,
                    ).toContain('SF402');
                    expect(
                        await a.query(
                            `SELECT COUNT(*) FROM intake_links WHERE account_id='${owner}' AND organization_id IS NULL;`,
                        ),
                    ).toBe('10');
                } finally {
                    await a.query('ROLLBACK;');
                    if (pending) await pending;
                }
            }, 15000);
        },
    );

import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { readFileSync } from 'node:fs';
import type { SqlRow, SqlStatement, StatementExecutor } from '@/lib/neon/statements';

/**
 * Disposable embedded PostgreSQL loaded from the repository's real schema.
 * Never reads environment variables or database credentials.
 *
 * PGlite is a single connection, so it proves statement atomicity, constraints
 * and decision logic. It cannot prove lock behavior between concurrent
 * connections; see tests/concurrency/README.md for that harness.
 */
export async function createSchemaDatabase(extraSqlFiles: string[] = []): Promise<PGlite> {
    const db = new PGlite({ extensions: { uuid_ossp } });
    await db.exec(readFileSync('schema.sql', 'utf8'));
    for (const file of extraSqlFiles) await db.exec(readFileSync(file, 'utf8'));
    return db;
}

export function pgliteExecutor(db: PGlite): StatementExecutor {
    return {
        async run(statement: SqlStatement) {
            return (await db.query<SqlRow>(statement.text, statement.params)).rows;
        },
        async transaction(statements: SqlStatement[]) {
            return db.transaction(async (tx) => {
                const results: SqlRow[][] = [];
                for (const statement of statements) {
                    results.push((await tx.query<SqlRow>(statement.text, statement.params)).rows);
                }
                return results;
            });
        },
    };
}

export async function queryRows(db: PGlite, text: string, params: unknown[] = []): Promise<SqlRow[]> {
    return (await db.query<SqlRow>(text, params)).rows;
}

type Fragment = { strings: readonly string[]; values: unknown[]; then: PromiseLike<SqlRow[]>['then'] };

/**
 * A stand-in for the Neon tagged-template `sql` function, including composition
 * of nested fragments (`sql\`... ${sql\`...\`} ...\``), executed against PGlite.
 */
export function pgliteTaggedSql(db: PGlite) {
    const isFragment = (value: unknown): value is Fragment =>
        Boolean(value && typeof value === 'object' && 'strings' in (value as object) && 'values' in (value as object));

    const compile = (fragment: Fragment, params: unknown[]): string =>
        fragment.strings.reduce((text, part, index) => {
            if (index === 0) return part;
            const value = fragment.values[index - 1];
            if (isFragment(value)) return text + compile(value, params) + part;
            params.push(value);
            return `${text}$${params.length}${part}`;
        }, '');

    return (strings: TemplateStringsArray, ...values: unknown[]): Fragment => {
        const fragment: Fragment = {
            strings,
            values,
            then(onFulfilled, onRejected) {
                const params: unknown[] = [];
                const text = compile(fragment, params);
                return db.query<SqlRow>(text, params).then((result) => result.rows).then(onFulfilled, onRejected);
            },
        };
        return fragment;
    };
}

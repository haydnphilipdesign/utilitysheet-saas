import { sql } from '@/lib/neon/db';

/**
 * Parameterized statement execution for writes that must be atomic.
 *
 * The Neon HTTP driver has no interactive transactions: separate awaited calls
 * never share a connection. Atomic writes are therefore expressed either as one
 * statement (data-modifying CTEs commit or roll back together) or as an ordered
 * list of statements submitted through `transaction`, which Neon runs as a
 * single non-interactive transaction.
 *
 * Statements are plain text plus positional parameters so the same SQL runs
 * unchanged against the PostgreSQL test harnesses.
 */
export type SqlStatement = { text: string; params: unknown[] };
export type SqlRow = Record<string, unknown>;

export interface StatementExecutor {
    run(statement: SqlStatement): Promise<SqlRow[]>;
    /** Runs every statement in order inside one transaction; returns one row set per statement. */
    transaction(statements: SqlStatement[]): Promise<SqlRow[][]>;
}

/** Thrown instead of silently skipping a required write when no database is configured. */
export class DatabaseUnavailableError extends Error {
    constructor(message = 'Database is not configured') {
        super(message);
        this.name = 'DatabaseUnavailableError';
    }
}

export function getStatementExecutor(): StatementExecutor {
    if (!sql) throw new DatabaseUnavailableError();
    const db = sql;

    return {
        async run(statement) {
            return (await db.query(statement.text, statement.params)) as SqlRow[];
        },
        async transaction(statements) {
            const results = await db.transaction(
                statements.map((statement) => db.query(statement.text, statement.params))
            );
            return results as SqlRow[][];
        },
    };
}

/** PostgreSQL undefined_table. Used to report a pending migration instead of "zero rows". */
export function isMissingRelationError(error: unknown): boolean {
    return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === '42P01');
}

/** PostgreSQL unique_violation. */
export function isUniqueViolationError(error: unknown): boolean {
    return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === '23505');
}

import { readFile } from 'node:fs/promises';
import { renderComparison, type EvalResultFile } from './eval-core';

/**
 * Prints one comparison table for two or more result files written by
 * run-eval.ts. Reads files only; no model call.
 */
async function main(): Promise<void> {
    const files = process.argv.slice(2);
    if (files.length === 0) {
        throw new Error('Pass one or more result files from .eval/results/.');
    }
    const results: EvalResultFile[] = [];
    for (const file of files) {
        results.push(JSON.parse(await readFile(file, 'utf8')) as EvalResultFile);
    }
    console.log(renderComparison(results));
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});

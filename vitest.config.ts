import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./tests/setup.ts'],
        include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['lib/**/*.ts', 'lib/**/*.tsx'],
            exclude: ['lib/**/*.d.ts', 'node_modules'],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
        },
    },
});

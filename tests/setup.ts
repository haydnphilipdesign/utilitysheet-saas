import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

// Mock environment variables for tests
vi.stubEnv('GOOGLE_AI_API_KEY', 'test-api-key');
vi.stubEnv('DATABASE_URL', 'postgres://test:test@localhost/test');
vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');

// Mock console.log/error/warn in tests to keep output clean
// Comment these out when debugging tests
// vi.spyOn(console, 'log').mockImplementation(() => {});
// vi.spyOn(console, 'warn').mockImplementation(() => {});

// Reset mocks between tests
beforeEach(() => {
    vi.clearAllMocks();
});

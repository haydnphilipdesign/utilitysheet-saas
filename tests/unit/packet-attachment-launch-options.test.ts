import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { chromiumExecutablePathMock, puppeteerDefaultArgsMock } = vi.hoisted(() => ({
    chromiumExecutablePathMock: vi.fn(),
    puppeteerDefaultArgsMock: vi.fn(),
}));

vi.mock('@sparticuz/chromium', () => ({
    default: {
        executablePath: chromiumExecutablePathMock,
        args: ['--chromium-arg'],
    },
}));

vi.mock('puppeteer-core', () => ({
    default: {
        defaultArgs: puppeteerDefaultArgsMock,
    },
}));

import { __testing } from '@/lib/pdf/packet-attachment';

const originalEnv = { ...process.env };

beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.PUPPETEER_EXECUTABLE_PATH;
    delete process.env.CHROME_EXECUTABLE_PATH;
    delete process.env.CHROMIUM_BIN_PATH;
    delete process.env.CHROMIUM_PACK_URL;
    puppeteerDefaultArgsMock.mockReturnValue(['--default-arg']);
    chromiumExecutablePathMock.mockResolvedValue('/tmp/chromium');
});

afterEach(() => {
    process.env = { ...originalEnv };
});

describe('packet attachment launch option resolution', () => {
    it('uses explicit executable path from env when provided', async () => {
        process.env.PUPPETEER_EXECUTABLE_PATH = '/usr/bin/chrome';

        const launchOptions = await __testing.resolveLaunchOptions();

        expect(launchOptions).toMatchObject({
            executablePath: '/usr/bin/chrome',
            headless: true,
            strategy: 'env_executable',
        });
        expect(chromiumExecutablePathMock).not.toHaveBeenCalled();
        expect(puppeteerDefaultArgsMock).not.toHaveBeenCalled();
    });

    it('uses CHROMIUM_BIN_PATH when provided', async () => {
        process.env.CHROMIUM_BIN_PATH = '/opt/chromium';

        const launchOptions = await __testing.resolveLaunchOptions();

        expect(chromiumExecutablePathMock).toHaveBeenCalledWith('/opt/chromium');
        expect(launchOptions).toMatchObject({
            executablePath: '/tmp/chromium',
            headless: 'shell',
            strategy: 'bin_path',
        });
        expect(puppeteerDefaultArgsMock).toHaveBeenCalledWith({
            args: ['--chromium-arg'],
            headless: 'shell',
        });
    });

    it('uses CHROMIUM_PACK_URL when provided', async () => {
        process.env.CHROMIUM_PACK_URL = 'https://example.com/chromium-pack.tar';

        const launchOptions = await __testing.resolveLaunchOptions();

        expect(chromiumExecutablePathMock).toHaveBeenCalledWith('https://example.com/chromium-pack.tar');
        expect(launchOptions).toMatchObject({
            executablePath: '/tmp/chromium',
            headless: 'shell',
            strategy: 'pack_url',
        });
    });

    it('falls back to default chromium executable path resolution', async () => {
        const launchOptions = await __testing.resolveLaunchOptions();

        expect(chromiumExecutablePathMock).toHaveBeenCalledWith();
        expect(launchOptions).toMatchObject({
            executablePath: '/tmp/chromium',
            headless: 'shell',
            strategy: 'default',
        });
    });
});

import { defineConfig } from '@playwright/test';
import base from '../../playwright.config';
export default defineConfig({ ...base, testDir: '../../tests', webServer: undefined, projects: base.projects?.filter(p => p.name !== 'Mobile Safari').map(p => ({...p, use: {...p.use, channel: 'chrome'}})), use: { ...base.use, baseURL: 'http://localhost:3100' } });

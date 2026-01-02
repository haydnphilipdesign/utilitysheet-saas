import { describe, it, expect } from 'vitest';
import { __testing } from '@/lib/email/email-service';

const {
    generateSellerNotificationHtml,
    generateSellerReminderHtml,
    generateTCCompletionNotificationHtml,
    generateContactResolutionAlertHtml,
    generateWeeklySummaryHtml,
} = __testing;

describe('Email Templates', () => {
    describe('generateSellerNotificationHtml', () => {
        it('generates valid HTML with all fields', () => {
            const html = generateSellerNotificationHtml({
                sellerName: 'John Doe',
                propertyAddress: '123 Main St, Philadelphia, PA 19103',
                formattedClosingDate: 'Friday, January 15, 2026',
                agentName: 'Jane Agent',
                sellerFormUrl: 'https://utilitysheet.com/s/abc123',
            });

            expect(html).toContain('Hi John Doe,');
            expect(html).toContain('123 Main St, Philadelphia, PA 19103');
            expect(html).toContain('Friday, January 15, 2026');
            expect(html).toContain('Jane Agent');
            expect(html).toContain('https://utilitysheet.com/s/abc123');
            expect(html).toContain('Utility Information Request');
        });

        it('handles missing seller name', () => {
            const html = generateSellerNotificationHtml({
                propertyAddress: '123 Main St',
                formattedClosingDate: null,
                sellerFormUrl: 'https://example.com',
            });

            expect(html).toContain('Hello,');
            expect(html).not.toContain('undefined');
        });

        it('handles missing closing date', () => {
            const html = generateSellerNotificationHtml({
                sellerName: 'John',
                propertyAddress: '123 Main St',
                formattedClosingDate: null,
                sellerFormUrl: 'https://example.com',
            });

            expect(html).not.toContain('Closing Date:');
            expect(html).not.toContain('undefined');
            expect(html).not.toContain('null');
        });

        it('handles missing agent name', () => {
            const html = generateSellerNotificationHtml({
                sellerName: 'John',
                propertyAddress: '123 Main St',
                formattedClosingDate: null,
                sellerFormUrl: 'https://example.com',
            });

            expect(html).toContain('You\'ve received a request to provide');
            expect(html).not.toContain('from undefined');
        });

        it('contains required structure elements', () => {
            const html = generateSellerNotificationHtml({
                propertyAddress: '123 Main St',
                formattedClosingDate: null,
                sellerFormUrl: 'https://example.com',
            });

            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('<html>');
            expect(html).toContain('</html>');
            expect(html).toContain('UtilitySheet');
            expect(html).toContain('Provide Utility Information');
        });
    });

    describe('generateSellerReminderHtml', () => {
        it('generates reminder-specific content', () => {
            const html = generateSellerReminderHtml({
                sellerName: 'John',
                propertyAddress: '123 Main St',
                formattedClosingDate: null,
                sellerFormUrl: 'https://example.com',
            });

            expect(html).toContain('Reminder');
            expect(html).toContain('friendly reminder');
            expect(html).toContain('Complete Utility Info');
        });

        it('contains discard message for completed users', () => {
            const html = generateSellerReminderHtml({
                propertyAddress: '123 Main St',
                formattedClosingDate: null,
                sellerFormUrl: 'https://example.com',
            });

            expect(html).toContain('already completed this');
        });
    });

    describe('generateTCCompletionNotificationHtml', () => {
        it('generates completion notification with all fields', () => {
            const html = generateTCCompletionNotificationHtml({
                tcName: 'Sarah TC',
                propertyAddress: '456 Oak Ave',
                sellerName: 'John Seller',
                dashboardUrl: 'https://example.com/dashboard/123',
            });

            expect(html).toContain('Hi Sarah TC,');
            expect(html).toContain('John Seller has');
            expect(html).toContain('456 Oak Ave');
            expect(html).toContain('Submission Complete');
            expect(html).toContain('View Utility Details');
        });

        it('handles missing seller name', () => {
            const html = generateTCCompletionNotificationHtml({
                tcName: 'Sarah',
                propertyAddress: '456 Oak Ave',
                dashboardUrl: 'https://example.com/dashboard/123',
            });

            expect(html).toContain('The seller has');
            expect(html).not.toContain('undefined');
        });

        it('handles missing TC name', () => {
            const html = generateTCCompletionNotificationHtml({
                propertyAddress: '456 Oak Ave',
                dashboardUrl: 'https://example.com/dashboard/123',
            });

            expect(html).toContain('Hello,');
            expect(html).not.toContain('undefined');
        });
    });

    describe('generateContactResolutionAlertHtml', () => {
        it('lists unresolved entries', () => {
            const html = generateContactResolutionAlertHtml({
                tcName: 'Admin',
                propertyAddress: '789 Pine St',
                unresolvedEntries: [
                    { category: 'electric', displayName: 'Local Electric Co' },
                    { category: 'water', displayName: 'Municipal Water' },
                ],
                dashboardUrl: 'https://example.com/dashboard/456',
            });

            expect(html).toContain('electric');
            expect(html).toContain('Local Electric Co');
            expect(html).toContain('water');
            expect(html).toContain('Municipal Water');
            expect(html).toContain('Needs Attention');
            expect(html).toContain('Unresolved Utility Providers');
        });

        it('handles entries without display name', () => {
            const html = generateContactResolutionAlertHtml({
                propertyAddress: '789 Pine St',
                unresolvedEntries: [
                    { category: 'gas' },
                ],
                dashboardUrl: 'https://example.com',
            });

            expect(html).toContain('gas');
            expect(html).toContain('No name provided');
        });

        it('uses warning color scheme', () => {
            const html = generateContactResolutionAlertHtml({
                propertyAddress: '789 Pine St',
                unresolvedEntries: [{ category: 'electric' }],
                dashboardUrl: 'https://example.com',
            });

            // Warning colors (amber/orange)
            expect(html).toContain('#f59e0b');
            expect(html).toContain('#fef3c7');
        });
    });

    describe('generateWeeklySummaryHtml', () => {
        it('generates summary with stats', () => {
            const html = generateWeeklySummaryHtml({
                tcName: 'Weekly User',
                stats: {
                    totalRequests: 15,
                    submitted: 10,
                    sent: 3,
                    inProgress: 2,
                    needsAttention: 1,
                },
                dashboardUrl: 'https://example.com/dashboard',
            });

            expect(html).toContain('Hi Weekly User,');
            expect(html).toContain('Weekly Summary');
            expect(html).toContain('15');
            expect(html).toContain('10');
        });

        it('handles zero activity state', () => {
            const html = generateWeeklySummaryHtml({
                stats: {
                    totalRequests: 0,
                    submitted: 0,
                    sent: 0,
                    inProgress: 0,
                    needsAttention: 0,
                },
                dashboardUrl: 'https://example.com/dashboard',
            });

            expect(html).not.toContain('undefined');
            expect(html).toContain('Weekly Summary');
        });

        it('contains disable settings link', () => {
            const html = generateWeeklySummaryHtml({
                stats: {
                    totalRequests: 1,
                    submitted: 1,
                    sent: 0,
                    inProgress: 0,
                    needsAttention: 0,
                },
                dashboardUrl: 'https://example.com/dashboard',
            });

            expect(html).toContain('Settings');
        });
    });

    describe('Common template validation', () => {
        const templates = [
            {
                name: 'sellerNotification',
                generator: () => generateSellerNotificationHtml({
                    propertyAddress: 'Test',
                    formattedClosingDate: null,
                    sellerFormUrl: 'https://test.com',
                }),
            },
            {
                name: 'sellerReminder',
                generator: () => generateSellerReminderHtml({
                    propertyAddress: 'Test',
                    formattedClosingDate: null,
                    sellerFormUrl: 'https://test.com',
                }),
            },
            {
                name: 'tcCompletion',
                generator: () => generateTCCompletionNotificationHtml({
                    propertyAddress: 'Test',
                    dashboardUrl: 'https://test.com',
                }),
            },
            {
                name: 'contactResolution',
                generator: () => generateContactResolutionAlertHtml({
                    propertyAddress: 'Test',
                    unresolvedEntries: [{ category: 'test' }],
                    dashboardUrl: 'https://test.com',
                }),
            },
            {
                name: 'weeklySummary',
                generator: () => generateWeeklySummaryHtml({
                    stats: { totalRequests: 0, submitted: 0, sent: 0, inProgress: 0, needsAttention: 0 },
                    dashboardUrl: 'https://test.com',
                }),
            },
        ];

        for (const template of templates) {
            it(`${template.name}: does not contain undefined or null strings`, () => {
                const html = template.generator();
                expect(html).not.toContain('undefined');
                expect(html).not.toMatch(/\bnull\b/);
            });

            it(`${template.name}: has valid HTML structure`, () => {
                const html = template.generator();
                expect(html).toContain('<!DOCTYPE html>');
                expect(html).toContain('<html>');
                expect(html).toContain('</html>');
                expect(html).toContain('<body');
                expect(html).toContain('</body>');
            });

            it(`${template.name}: includes UtilitySheet branding`, () => {
                const html = template.generator();
                expect(html.toLowerCase()).toContain('utilitysheet');
            });
        }
    });
});

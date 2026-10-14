import { describe, it, expect } from 'vitest';
import { __testing, buildSellerReminderEmail } from '@/lib/email/email-service';

type BrandProfileInput = Parameters<typeof buildSellerReminderEmail>[0]['brandProfile'];

const {
    generateTCCompletionNotificationHtml,
    generateReferralCreditEarnedHtml,
    generateContactResolutionAlertHtml,
    generateWeeklySummaryHtml,
} = __testing;

describe('Email Templates', () => {
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
            expect(html).toContain('Review Submitted Sheet');
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
            expect(html).toContain('Providers without contact details');
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
            expect(html).toContain('No name given');
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

    describe('product email colors', () => {
        const slateBlue = '#23588a';
        const slateBlueDark = '#0b4072';
        const emerald = /#10b981|#059669/gi;
        const stats = { totalRequests: 3, submitted: 1, sent: 1, inProgress: 1, needsAttention: 0 };
        const products = [
            {
                name: 'tcCompletion',
                html: () => generateTCCompletionNotificationHtml({ propertyAddress: 'Test', dashboardUrl: 'https://test.com' }),
                buttonLabel: 'Review Submitted Sheet',
            },
            {
                name: 'referralCreditEarned',
                html: () => generateReferralCreditEarnedHtml({ creditStatus: 'applied', referralSettingsUrl: 'https://test.com' }),
                buttonLabel: 'See your referral credits',
            },
            {
                name: 'weeklySummary',
                html: () => generateWeeklySummaryHtml({ stats, dashboardUrl: 'https://test.com' }),
                buttonLabel: 'Go to Dashboard',
            },
        ];

        for (const product of products) {
            it(`${product.name}: uses the slate-blue header with a solid fallback`, () => {
                const html = product.html();
                expect(html).toContain(`<td bgcolor="${slateBlue}" style="background-color: ${slateBlue}; background-image: linear-gradient(135deg, ${slateBlue} 0%, ${slateBlueDark} 100%);`);
                expect(html).not.toContain('background: linear-gradient');
            });

            it(`${product.name}: uses a slate-blue button with white text`, () => {
                const html = product.html();
                const button = html.slice(html.indexOf('<!--[if mso]>'), html.lastIndexOf(product.buttonLabel));
                expect(button).toContain(`fillcolor="${slateBlue}"`);
                expect(button).toContain(`bgcolor="${slateBlue}"`);
                expect(button).toContain('color: #ffffff');
            });
        }

        it('tcCompletion and referralCreditEarned contain no emerald accents', () => {
            expect(products[0].html().match(emerald)).toBeNull();
            expect(products[1].html().match(emerald)).toBeNull();
        });

        it('tcCompletion uses slate blue for the property card border and fallback link', () => {
            const html = products[0].html();
            expect(html).toContain(`border-left: 4px solid ${slateBlue};`);
            expect(html).toContain(`style="color: ${slateBlue}; word-break: break-all;">https://test.com</a>`);
        });

        it('keeps green only for success indicators', () => {
            // Completion and referral-credit badges are success states.
            expect(products[0].html()).toContain('background-color: #d1fae5; color: #065f46;');
            expect(products[1].html()).toContain('background-color: #d1fae5; color: #065f46;');
            // The weekly summary's completed count stays green, in emerald-700
            // so the number passes 3:1 on its light cell.
            const weekly = products[2].html();
            expect(weekly.match(emerald)).toBeNull();
            expect(weekly).toContain(`color: #047857; font-size: 28px; font-weight: 700;">${stats.submitted}</p>`);
        });

        it('centers the non-Outlook button table', () => {
            for (const product of products) {
                expect(product.html()).toContain('<table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">');
            }
        });
    });

    describe('header gradient fallbacks', () => {
        it('contact resolution alert falls back to the darker amber', () => {
            const html = generateContactResolutionAlertHtml({
                propertyAddress: 'Test',
                unresolvedEntries: [{ category: 'electric' }],
                dashboardUrl: 'https://test.com',
            });

            expect(html).toContain('<td bgcolor="#d97706" style="background-color: #d97706; background-image: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);');
        });

        it('branded seller emails fall back to the brand primary color', () => {
            const brandProfile = { name: 'Riverbend', primary_color: '#7c3aed', secondary_color: '#4c1d95' } as BrandProfileInput;
            const { html } = buildSellerReminderEmail({ sellerEmail: 'seller@example.com', propertyAddress: 'Test', sellerToken: 'synthetic', brandProfile });

            expect(html).toContain('<td bgcolor="#7c3aed" style="background-color: #7c3aed; background-image: linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%);');
        });

        it('branded seller emails never put an unsafe brand color in the header', () => {
            const brandProfile = { name: 'Riverbend', primary_color: '"><script>x</script>', secondary_color: 'red' } as BrandProfileInput;
            const { html } = buildSellerReminderEmail({ sellerEmail: 'seller@example.com', propertyAddress: 'Test', sellerToken: 'synthetic', brandProfile });

            expect(html).not.toContain('<script>x</script>');
            expect(html).toContain('<td bgcolor="#23588a" style="background-color: #23588a; background-image: linear-gradient(135deg, #23588a 0%, #0b4072 100%);');
            expect(html).not.toContain('background: linear-gradient');
        });
    });

    describe('Common template validation', () => {
        const templates = [
            {
                name: 'tcCompletion',
                generator: () => generateTCCompletionNotificationHtml({
                    propertyAddress: 'Test',
                    dashboardUrl: 'https://test.com',
                }),
            },
            {
                name: 'referralCreditEarned',
                generator: () => generateReferralCreditEarnedHtml({
                    creditStatus: 'applied',
                    referralSettingsUrl: 'https://test.com/settings',
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

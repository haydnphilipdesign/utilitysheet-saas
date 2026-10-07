import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('test-drive seller submission safety guards', () => {
    const source = readFileSync(
        join(process.cwd(), 'app/api/seller/[token]/route.ts'),
        'utf8'
    ).replace(/\r\n/g, '\n');

    it('keeps demo resubmission idempotent before persistence', () => {
        const postStart = source.indexOf('// POST /api/seller');
        const idempotencyGuard = source.indexOf(
            "requestRecord.is_demo === true && requestRecord.status === 'submitted'",
            postStart
        );
        const requestUpdate = source.indexOf('await submitSellerRequest(', postStart);
        expect(idempotencyGuard).toBeGreaterThan(postStart);
        expect(idempotencyGuard).toBeLessThan(requestUpdate);
    });

    it('gates quota locking, referral awards, admin fan-out, contact resolution, and acquisition content', () => {
        // The quota decision is made where the submission is stored; behavior is
        // covered in seller-submission-atomic.test.ts.
        const submissionSource = readFileSync(
            join(process.cwd(), 'lib/neon/queries/seller-submission.ts'),
            'utf8'
        ).replace(/\r\n/g, '\n');
        expect(submissionSource).toContain('NOT $19::boolean\n                        AND NOT COALESCE(t.is_demo, FALSE)\n                        AND t.metered_at IS NULL');
        expect(source).not.toContain('getMonthlyUsage');
        expect(source).toContain('if (!isTestDriveSubmission) {\n            scheduleReferralCreditAward');
        expect(source).toContain('if (!isTestDriveSubmission && organization?.id)');
        expect(source).toContain('if (!accessLocked && !isUtilitySheetDemoSubmission && !isTestDriveSubmission)');
        expect(source).toContain('if (!isTestDriveSubmission && ownerIsMember && account?.email && !accessLocked');
        expect(source).toContain('let showReferralFooter = !isTestDriveSubmission && !isPaid');
        expect(source).toContain('isTestDrive: isTestDriveSubmission');
    });

    it('forces one owner-only PDF recipient and persists delivery outcome after core submission writes', () => {
        // The request, provider rows and seller_submitted event are one statement.
        const sellerEvent = source.indexOf('await submitSellerRequest(');
        expect(sellerEvent).toBeGreaterThan(-1);
        const recipientBranch = source.indexOf('const submissionRecipients = isTestDriveSubmission');
        const deliveryEvent = source.indexOf("'test_drive_delivery_succeeded'");
        expect(source).toContain('account?.email');
        expect(source).toContain('attachPdf: true');
        expect(recipientBranch).toBeGreaterThan(sellerEvent);
        expect(deliveryEvent).toBeGreaterThan(recipientBranch);
    });
});

/**
 * Workspace-level notification routing.
 *
 * These settings live on `organizations.notification_settings` (JSONB) and are
 * distinct from personal-account `notification_preferences`. Personal
 * preferences control whether an individual recipient is notified; workspace
 * routing controls who, beyond the request owner, is eligible to be notified.
 */

/** Notify the workspace's admins (in addition to the request owner) on seller submissions. */
export const NOTIFY_ADMINS_ON_SUBMISSION = 'notify_admins_on_submission';

export type WorkspaceNotificationSettings = {
    [NOTIFY_ADMINS_ON_SUBMISSION]: boolean;
};

const DEFAULT_WORKSPACE_NOTIFICATION_SETTINGS: WorkspaceNotificationSettings = {
    [NOTIFY_ADMINS_ON_SUBMISSION]: false,
};

/**
 * Safely normalize the raw `notification_settings` column (object, JSON string,
 * or nullish) into a fully-populated settings object with backward-compatible
 * defaults. Unknown keys are ignored.
 */
export function normalizeWorkspaceNotificationSettings(raw: unknown): WorkspaceNotificationSettings {
    let source: Record<string, unknown> = {};

    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        source = raw as Record<string, unknown>;
    } else if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                source = parsed as Record<string, unknown>;
            }
        } catch {
            source = {};
        }
    }

    return {
        [NOTIFY_ADMINS_ON_SUBMISSION]:
            source[NOTIFY_ADMINS_ON_SUBMISSION] === true
                ? true
                : DEFAULT_WORKSPACE_NOTIFICATION_SETTINGS[NOTIFY_ADMINS_ON_SUBMISSION],
    };
}

export type SubmissionRecipientCandidate = {
    email?: string | null;
    name?: string | null;
    prefs?: Record<string, unknown> | null;
};

export type SubmissionRecipient = {
    email: string;
    name?: string;
    attachPdf: boolean;
};

/**
 * Assemble the ordered, de-duplicated list of seller-submission email recipients
 * from a list of candidates (typically the request owner followed by workspace
 * admins). Each candidate:
 *
 * - is skipped if it has no usable email (safe handling of invalid recipients);
 * - is skipped if its personal `seller_submissions` preference is explicitly off;
 * - is de-duplicated by lowercased email so the same person is emailed once even
 *   when they are both the owner and an admin.
 *
 * `attachPdf` honors each recipient's personal PDF preference and is forced off
 * when the request is access-locked.
 */
export function buildSubmissionRecipients(
    candidates: SubmissionRecipientCandidate[],
    options: { accessLocked: boolean }
): SubmissionRecipient[] {
    const recipients: SubmissionRecipient[] = [];
    const seen = new Set<string>();

    for (const candidate of candidates) {
        const email = candidate.email?.trim();
        if (!email) continue;

        const prefs = (candidate.prefs || {}) as {
            seller_submissions?: boolean;
            seller_submission_pdf_attachment?: boolean;
        };
        // Honor the recipient's personal preference (missing defaults to enabled).
        if (prefs.seller_submissions === false) continue;

        const dedupeKey = email.toLowerCase();
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        recipients.push({
            email,
            name: candidate.name || undefined,
            attachPdf: !options.accessLocked && prefs.seller_submission_pdf_attachment !== false,
        });
    }

    return recipients;
}

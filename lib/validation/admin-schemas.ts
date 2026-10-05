import { z } from 'zod';

/**
 * Runtime validation for Admin server boundaries. TypeScript types and browser
 * controls are not input validation: every Admin action parses its arguments here.
 */
export const ADMIN_REASON_MAX_LENGTH = 500;
export const ADMIN_TRIAGE_NOTE_MAX_LENGTH = 1000;

export const adminIdSchema = z.string().uuid();
export const adminReasonSchema = z
    .string()
    .trim()
    .min(3, 'Admin action requires a reason (min 3 characters)')
    .max(ADMIN_REASON_MAX_LENGTH, `Reason must be ${ADMIN_REASON_MAX_LENGTH} characters or fewer`);

/**
 * For low-risk writes that touch no customer record: Product Updates, Operations
 * triage and feedback status. The write is still audited; the reason is a note
 * the operator may leave. See `.ai/decisions/2026-10-05-optional-admin-reasons.md`.
 */
export const adminOptionalReasonSchema = z
    .string()
    .trim()
    .max(ADMIN_REASON_MAX_LENGTH, `Reason must be ${ADMIN_REASON_MAX_LENGTH} characters or fewer`)
    .nullish()
    .transform((value) => value || null);

const userRoleEnum = z.enum(['user', 'admin', 'banned']);
/** Admin overrides only move between Free and Pro; cancellation belongs to billing. */
const overridePlanEnum = z.enum(['free', 'pro']);
const storedPlanEnum = z.enum(['free', 'pro', 'canceled']);
const requestStatusEnum = z.enum(['draft', 'sent', 'in_progress', 'submitted']);

export const adminRoleChangeSchema = z.object({
    userId: adminIdSchema,
    role: userRoleEnum,
    expectedRole: userRoleEnum,
    reason: adminReasonSchema,
}).strict();

export const adminBanSchema = z.object({
    userId: adminIdSchema,
    expectedRole: userRoleEnum,
    reason: adminReasonSchema,
}).strict();

export const adminPlanChangeSchema = z.object({
    userId: adminIdSchema,
    plan: overridePlanEnum,
    expectedPlan: storedPlanEnum,
    reason: adminReasonSchema,
}).strict();

export const adminRequestStatusSchema = z.object({
    requestId: adminIdSchema,
    status: requestStatusEnum,
    expectedStatus: requestStatusEnum,
    reason: adminReasonSchema,
}).strict();

const optionalText = (max: number) =>
    z.string().trim().max(max).nullish().transform((value) => (value ? value : null));

const sellerContactSchema = z.object({
    sellerName: optionalText(120),
    sellerEmail: z
        .string()
        .trim()
        .max(254)
        .nullish()
        .transform((value) => (value ? value : null))
        .refine((value) => value === null || z.string().email().safeParse(value).success, 'Enter a valid seller email'),
    sellerPhone: optionalText(30),
}).strict();

export const adminRequestSellerSchema = z.object({
    requestId: adminIdSchema,
    seller: sellerContactSchema,
    /**
     * The contact values the operator was looking at; a mismatch is a stale edit.
     * Not format-checked: a stored address may be malformed, and that is exactly what an operator needs to fix.
     */
    expected: z.object({
        sellerName: optionalText(500),
        sellerEmail: optionalText(500),
        sellerPhone: optionalText(500),
    }).strict(),
    reason: adminReasonSchema,
}).strict();

export const adminProductUpdateCreateSchema = z.object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
    body: z.string().trim().min(3, 'Body must be at least 3 characters').max(10_000),
    category: z.enum(['bugfix', 'feature', 'announcement'], { message: 'Invalid category' }),
    reason: adminOptionalReasonSchema,
}).strict();

export const adminConfirmedUpdateSchema = z.object({
    updateId: adminIdSchema,
    reason: adminOptionalReasonSchema,
    confirmed: z.literal(true, { message: 'Admin action requires explicit confirmation' }),
}).strict();

export const adminReconcileBodySchema = z.object({
    limit: z.number().int().min(1).max(200).default(100),
    cursor: z.string().max(500).nullish().transform((value) => value ?? null),
    includeUnverified: z.boolean().default(false),
    scanAll: z.boolean().default(false),
    reason: adminReasonSchema,
    confirmed: z.literal(true, { message: 'Admin action requires explicit confirmation' }),
    /** Eligible signup count shown in the preview the operator reviewed. */
    reviewedEligibleCount: z.number().int().min(0).max(100_000),
}).strict();

export const adminReminderPreviewSchema = z.object({ requestId: adminIdSchema }).strict();

export const adminReminderSendSchema = z.object({
    requestId: adminIdSchema,
    /** Client-generated; the same ID is resubmitted on retry so one click is one operation. */
    operationId: adminIdSchema,
    reason: adminReasonSchema,
    confirmed: z.literal(true, { message: 'Admin action requires explicit confirmation' }),
    /** Fingerprint of the preview the operator reviewed. */
    expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export const adminReminderResolveSchema = z.object({
    operationId: adminIdSchema,
    resolution: z.enum(['accepted', 'failed']),
    reason: adminReasonSchema,
    confirmed: z.literal(true, { message: 'Admin action requires explicit confirmation' }),
}).strict();

export const adminTriageActionSchema = z.object({
    sourceKey: z.string().trim().min(3).max(200).regex(/^[a-z_]+:[A-Za-z0-9:._-]+$/),
    action: z.enum(['acknowledge', 'snooze', 'resolve', 'reopen']),
    /** Version the operator saw; 0 means no triage record existed yet. */
    expectedVersion: z.number().int().min(0),
    snoozeDays: z.number().int().min(1).max(90).optional(),
    note: z.string().trim().max(ADMIN_TRIAGE_NOTE_MAX_LENGTH).optional().transform((value) => value || null),
    reason: adminOptionalReasonSchema,
}).strict().refine((value) => value.action !== 'snooze' || value.snoozeDays !== undefined, {
    message: 'Choose how long to snooze this item',
    path: ['snoozeDays'],
});

export const adminFeedbackStatusSchema = z.object({
    feedbackId: adminIdSchema,
    status: z.enum(['new', 'reviewed', 'resolved']),
    /** Version the operator saw. */
    expectedVersion: z.number().int().min(1),
    note: z.string().trim().max(ADMIN_TRIAGE_NOTE_MAX_LENGTH).optional().transform((value) => value || null),
    reason: adminOptionalReasonSchema,
}).strict();

export type AdminTriageActionInput =z.infer<typeof adminTriageActionSchema>;

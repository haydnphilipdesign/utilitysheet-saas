/**
 * Email Service - Barrel Export
 * 
 * Re-exports all email-related functions and types.
 */

// Types
export type {
    SendSellerNotificationEmailParams,
    GenerateEmailHtmlParams,
    SendFeedbackEmailParams,
    SendTCCompletionNotificationEmailParams,
    GenerateTCCompletionHtmlParams,
    SendContactResolutionAlertEmailParams,
    GenerateContactResolutionAlertHtmlParams,
    WeeklyStats,
    SendWeeklySummaryEmailParams,
    GenerateWeeklySummaryHtmlParams,
    EmailResult,
} from './types';

// Email sending functions
export {
    sendSellerNotificationEmail,
    sendSellerReminderEmail,
    sendFeedbackEmail,
    sendTCCompletionNotificationEmail,
    sendContactResolutionAlertEmail,
    sendWeeklySummaryEmail,
    __testing,
} from './email-service';

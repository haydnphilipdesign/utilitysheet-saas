/**
 * Email Service Types
 * 
 * Shared types and interfaces for email templates and sending functions.
 */

export interface SendSellerNotificationEmailParams {
    sellerEmail: string;
    sellerName?: string;
    propertyAddress: string;
    closingDate?: string;
    agentName?: string;
    publicToken: string;
}

export interface GenerateEmailHtmlParams {
    sellerName?: string;
    propertyAddress: string;
    formattedClosingDate: string | null;
    agentName?: string;
    sellerFormUrl: string;
}

export interface SendFeedbackEmailParams {
    userEmail: string;
    message: string;
    userId?: string;
    userName?: string;
}

export interface SendTCCompletionNotificationEmailParams {
    tcEmail: string;
    tcName?: string;
    propertyAddress: string;
    sellerName?: string;
    requestId: string;
}

export interface GenerateTCCompletionHtmlParams {
    tcName?: string;
    propertyAddress: string;
    sellerName?: string;
    dashboardUrl: string;
}

export interface SendContactResolutionAlertEmailParams {
    tcEmail: string;
    tcName?: string;
    propertyAddress: string;
    unresolvedEntries: { category: string; displayName?: string }[];
    requestId: string;
}

export interface GenerateContactResolutionAlertHtmlParams {
    tcName?: string;
    propertyAddress: string;
    unresolvedEntries: { category: string; displayName?: string }[];
    dashboardUrl: string;
}

export interface WeeklyStats {
    totalRequests: number;
    submitted: number;
    sent: number;
    inProgress: number;
    needsAttention: number;
}

export interface SendWeeklySummaryEmailParams {
    tcEmail: string;
    tcName?: string;
    stats: WeeklyStats;
}

export interface GenerateWeeklySummaryHtmlParams {
    tcName?: string;
    stats: WeeklyStats;
    dashboardUrl: string;
}

export interface EmailResult {
    success: boolean;
    error?: string;
}

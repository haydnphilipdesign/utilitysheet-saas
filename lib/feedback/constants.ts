/** Shared by the feedback dialog, the capture route and the Admin inbox. */
export const FEEDBACK_MESSAGE_MAX_LENGTH = 2000;

export const FEEDBACK_CATEGORIES = ['bug', 'idea', 'question', 'general'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
    bug: 'Bug',
    idea: 'Idea',
    question: 'Question',
    general: 'General',
};

export const FEEDBACK_STATUSES = ['new', 'reviewed', 'resolved'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
    new: 'New',
    reviewed: 'Reviewed',
    resolved: 'Resolved',
};

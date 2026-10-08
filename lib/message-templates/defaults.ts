import type { MessageTemplates } from '@/types';

export const DEFAULT_SELLER_REQUEST_SMS_TEMPLATE =
    'Hi{{seller_first_name_with_space}}! Please complete this utility info form for {{property_address}}: {{link}}';

export const DEFAULT_SELLER_REQUEST_MAILTO_SUBJECT_TEMPLATE =
    'Utility information for {{property_address}}';

export const DEFAULT_SELLER_REQUEST_MAILTO_BODY_TEMPLATE =
    `Hi{{seller_first_name_with_space}},

As part of the home sale process, we need to collect utility provider information for {{property_address}}.

Please complete this short form:
{{link}}

Thank you!`;

export const DEFAULT_SELLER_REQUEST_EMAIL_SUBJECT_TEMPLATE =
    'Utility information needed for {{property_address}}';

export const DEFAULT_SELLER_REQUEST_EMAIL_BODY_TEMPLATE =
    `Hi{{seller_first_name_with_space}},

{{agent_name}} is putting together the utility details for {{property_address}}.

When you have a moment, please fill out this short form. If you’re not sure about a provider, you can choose “Not sure” and keep going.

Thank you!`;

export const DEFAULT_SELLER_REQUEST_EMAIL_BUTTON_TEXT = 'Complete the utility form';

export const DEFAULT_SELLER_REMINDER_EMAIL_SUBJECT_TEMPLATE =
    'Reminder: utility information for {{property_address}}';

export const DEFAULT_SELLER_REMINDER_EMAIL_BODY_TEMPLATE =
    `Hi{{seller_first_name_with_space}},

Quick reminder: when you have a moment, please fill out the utility information for {{property_address}}.

If you already completed it, you can ignore this email. Thank you!`;

export const DEFAULT_SELLER_REMINDER_EMAIL_BUTTON_TEXT = 'Continue the utility form';

export const DEFAULT_MESSAGE_TEMPLATES: MessageTemplates = {
    seller_request: {
        sms: DEFAULT_SELLER_REQUEST_SMS_TEMPLATE,
        mailto: {
            subject: DEFAULT_SELLER_REQUEST_MAILTO_SUBJECT_TEMPLATE,
            body: DEFAULT_SELLER_REQUEST_MAILTO_BODY_TEMPLATE,
        },
        email: {
            subject: DEFAULT_SELLER_REQUEST_EMAIL_SUBJECT_TEMPLATE,
            body: DEFAULT_SELLER_REQUEST_EMAIL_BODY_TEMPLATE,
            button_text: DEFAULT_SELLER_REQUEST_EMAIL_BUTTON_TEXT,
        },
    },
    seller_reminder: {
        email: {
            subject: DEFAULT_SELLER_REMINDER_EMAIL_SUBJECT_TEMPLATE,
            body: DEFAULT_SELLER_REMINDER_EMAIL_BODY_TEMPLATE,
            button_text: DEFAULT_SELLER_REMINDER_EMAIL_BUTTON_TEXT,
        },
    },
};


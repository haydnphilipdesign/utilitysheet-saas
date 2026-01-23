import type { MessageTemplates } from '@/types';

const nonEmpty = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? value : undefined;
};

export function normalizeMessageTemplates(input: unknown): MessageTemplates | undefined {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
    const raw = input as MessageTemplates;

    const out: MessageTemplates = {};

    const sellerRequestSms = nonEmpty(raw.seller_request?.sms);
    const sellerRequestMailtoSubject = nonEmpty(raw.seller_request?.mailto?.subject);
    const sellerRequestMailtoBody = nonEmpty(raw.seller_request?.mailto?.body);
    const sellerRequestEmailSubject = nonEmpty(raw.seller_request?.email?.subject);
    const sellerRequestEmailBody = nonEmpty(raw.seller_request?.email?.body);
    const sellerRequestEmailButtonText = nonEmpty(raw.seller_request?.email?.button_text);

    if (
        sellerRequestSms ||
        sellerRequestMailtoSubject ||
        sellerRequestMailtoBody ||
        sellerRequestEmailSubject ||
        sellerRequestEmailBody ||
        sellerRequestEmailButtonText
    ) {
        out.seller_request = {};
        if (sellerRequestSms) out.seller_request.sms = sellerRequestSms;

        if (sellerRequestMailtoSubject || sellerRequestMailtoBody) {
            out.seller_request.mailto = {};
            if (sellerRequestMailtoSubject) out.seller_request.mailto.subject = sellerRequestMailtoSubject;
            if (sellerRequestMailtoBody) out.seller_request.mailto.body = sellerRequestMailtoBody;
        }

        if (sellerRequestEmailSubject || sellerRequestEmailBody || sellerRequestEmailButtonText) {
            out.seller_request.email = {};
            if (sellerRequestEmailSubject) out.seller_request.email.subject = sellerRequestEmailSubject;
            if (sellerRequestEmailBody) out.seller_request.email.body = sellerRequestEmailBody;
            if (sellerRequestEmailButtonText) out.seller_request.email.button_text = sellerRequestEmailButtonText;
        }
    }

    const sellerReminderEmailSubject = nonEmpty(raw.seller_reminder?.email?.subject);
    const sellerReminderEmailBody = nonEmpty(raw.seller_reminder?.email?.body);
    const sellerReminderEmailButtonText = nonEmpty(raw.seller_reminder?.email?.button_text);

    if (sellerReminderEmailSubject || sellerReminderEmailBody || sellerReminderEmailButtonText) {
        out.seller_reminder = {
            email: {
                ...(sellerReminderEmailSubject ? { subject: sellerReminderEmailSubject } : {}),
                ...(sellerReminderEmailBody ? { body: sellerReminderEmailBody } : {}),
                ...(sellerReminderEmailButtonText ? { button_text: sellerReminderEmailButtonText } : {}),
            },
        };
    }

    return Object.keys(out).length > 0 ? out : {};
}


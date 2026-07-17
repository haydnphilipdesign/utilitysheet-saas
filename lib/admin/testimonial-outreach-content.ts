export const TESTIMONIAL_OUTREACH_SUBJECT = 'Quick UtilitySheet question';

export type TestimonialOutreachEmail = {
    subject: string;
    text: string;
    html: string;
};

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getFirstName(name: string | null | undefined): string | null {
    const first = name?.trim().split(/\s+/)[0];
    return first || null;
}

function paragraphsToHtml(paragraphs: string[]): string {
    return paragraphs
        .map((paragraph) => {
            const escaped = escapeHtml(paragraph).replace(/\n/g, '<br />');
            return `<p>${escaped}</p>`;
        })
        .join('\n');
}

export function buildTestimonialOutreachEmail(input: {
    recipientName?: string | null;
    businessName?: string | null;
}): TestimonialOutreachEmail {
    const firstName = getFirstName(input.recipientName);
    const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
    const activeUserLine = input.businessName
        ? `I wanted to reach out because you've been one of the more active UtilitySheet users at ${input.businessName}, and I really appreciate you using it.`
        : "I wanted to reach out because you've been one of the more active UtilitySheet users, and I really appreciate you using it.";

    const paragraphs = [
        greeting,
        activeUserLine,
        "I'm working on adding a few real customer quotes to the UtilitySheet website so new users can better understand how it helps TCs and real estate professionals in actual day-to-day workflows.",
        'Would you be open to sharing a quick sentence or two about your experience?',
        'A few prompts, just to make it easy:',
        'What were you doing before UtilitySheet?',
        'What has UtilitySheet made easier or faster for you?',
        'Would you recommend it to another TC or agent? If so, why?',
        "Rough thoughts are totally fine. I can turn it into a short testimonial and send it back to you for approval before I use anything publicly.",
        'Thanks again,\nHaydn',
    ];

    return {
        subject: TESTIMONIAL_OUTREACH_SUBJECT,
        text: paragraphs.join('\n\n'),
        html: [
            '<!doctype html>',
            '<html>',
            '<body style="margin:0;padding:0;background:#ffffff;color:#111827;font-family:Arial,sans-serif;font-size:15px;line-height:1.55;">',
            '<div style="max-width:620px;padding:24px;">',
            paragraphsToHtml(paragraphs),
            '</div>',
            '</body>',
            '</html>',
        ].join('\n'),
    };
}


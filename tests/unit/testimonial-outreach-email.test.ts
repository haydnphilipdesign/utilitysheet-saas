import { describe, expect, it } from 'vitest';
import { buildTestimonialOutreachEmail } from '@/lib/admin/testimonial-outreach';

describe('testimonial outreach email', () => {
    it('personalizes the greeting with the recipient first name', () => {
        const email = buildTestimonialOutreachEmail({
            recipientName: 'Avery Agent',
            businessName: 'Example Realty',
        });

        expect(email.subject).toBe('Quick UtilitySheet question');
        expect(email.text).toContain('Hi Avery,');
        expect(email.text).toContain('at Example Realty');
        expect(email.html).toContain('Hi Avery,');
    });

    it('falls back to a friendly greeting when the recipient name is missing', () => {
        const email = buildTestimonialOutreachEmail({
            recipientName: null,
            businessName: null,
        });

        expect(email.text).toContain('Hi there,');
        expect(email.html).toContain('Hi there,');
    });

    it('sends simple personal html and a matching plain text fallback', () => {
        const email = buildTestimonialOutreachEmail({
            recipientName: 'Taylor TC',
            businessName: 'Taylor Closings',
        });

        expect(email.text).toContain('What were you doing before UtilitySheet?');
        expect(email.text).toContain('Thanks again,\nHaydn');
        expect(email.html).toContain('<p>');
        expect(email.html).toContain('Thanks again,<br />Haydn');
        expect(email.html).not.toContain('<table');
    });

    it('escapes personalized values in html output', () => {
        const email = buildTestimonialOutreachEmail({
            recipientName: '<script>alert(1)</script> Agent',
            businessName: 'Unsafe & Co',
        });

        expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(email.html).not.toContain('<script>');
    });
});

import { describe, it, expect } from 'vitest';
import { normalizeMessageTemplates, renderTemplate } from '@/lib/message-templates';

describe('Message Templates', () => {
    it('renders simple {{variables}}', () => {
        const out = renderTemplate('Hi{{seller_first_name_with_space}}!', {
            seller_first_name_with_space: ' Bob',
        });
        expect(out).toBe('Hi Bob!');
    });

    it('normalizes templates by dropping empty strings', () => {
        const out = normalizeMessageTemplates({
            seller_request: {
                sms: '   ',
                email: {
                    subject: 'Action required: {{property_address}}',
                    body: '',
                },
                mailto: {
                    subject: '',
                    body: 'Hello',
                },
            },
        });

        expect(out).toEqual({
            seller_request: {
                mailto: {
                    body: 'Hello',
                },
                email: {
                    subject: 'Action required: {{property_address}}',
                },
            },
        });
    });
});


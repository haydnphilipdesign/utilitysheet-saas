import { describe, expect, it } from 'vitest';
import {
    ALLOWED_MESSAGE_TEMPLATE_VARIABLE_KEYS,
    analyzeMessageTemplate,
    renderMessageTemplatePreview,
} from '@/lib/message-templates';

describe('analyzeMessageTemplate', () => {
    it('treats empty input as clean', () => {
        expect(analyzeMessageTemplate('')).toEqual({ unknownVariables: [], malformedTokens: [] });
        expect(analyzeMessageTemplate(null)).toEqual({ unknownVariables: [], malformedTokens: [] });
    });

    it('accepts all allowed variables', () => {
        const text = Array.from(ALLOWED_MESSAGE_TEMPLATE_VARIABLE_KEYS).map((k) => `{{${k}}}`).join(' ');
        expect(analyzeMessageTemplate(text)).toEqual({ unknownVariables: [], malformedTokens: [] });
    });

    it('flags unknown but well-formed variables', () => {
        const result = analyzeMessageTemplate('Hi {{seller_name}}, ref {{unknown_var}} and {{another_bad}}');
        expect(result.unknownVariables).toEqual(['unknown_var', 'another_bad']);
        expect(result.malformedTokens).toEqual([]);
    });

    it('flags malformed tokens (spaces, punctuation, empty)', () => {
        const result = analyzeMessageTemplate('A {{ first name }} B {{seller-name}} C {{ }}');
        expect(result.malformedTokens).toContain('{{ first name }}');
        expect(result.malformedTokens).toContain('{{seller-name}}');
        expect(result.malformedTokens).toContain('{{ }}');
    });

    it('flags an unclosed token', () => {
        const result = analyzeMessageTemplate('Visit {{link but not closed');
        expect(result.malformedTokens.some((t) => t.includes('unclosed'))).toBe(true);
    });

    it('does not double-count a valid token as malformed', () => {
        const result = analyzeMessageTemplate('{{property_address}}');
        expect(result.malformedTokens).toEqual([]);
        expect(result.unknownVariables).toEqual([]);
    });
});

describe('renderMessageTemplatePreview', () => {
    it('substitutes example values and drops unknown tokens', () => {
        const output = renderMessageTemplatePreview('Hi{{seller_first_name_with_space}}, see {{property_address}} — {{link}}. Ignore {{nope}}.');
        expect(output).toBe('Hi Jordan, see 123 Maple Ave, Austin, TX — https://utilitysheet.com/s/example. Ignore .');
    });
});

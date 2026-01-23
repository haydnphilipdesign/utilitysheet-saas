export type TemplateVariables = Record<string, string | number | null | undefined>;

export function renderTemplate(template: string, variables: TemplateVariables): string {
    return template.replaceAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => {
        const value = variables[key];
        if (value === null || value === undefined) return '';
        return String(value);
    });
}

export function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

export function plainTextToHtml(plainText: string): string {
    const normalized = plainText.replaceAll('\r\n', '\n').trimEnd();
    const blocks = normalized.split(/\n{2,}/g);
    return blocks
        .map((block) => {
            const escaped = escapeHtml(block).replaceAll('\n', '<br />');
            return `<p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">${escaped}</p>`;
        })
        .join('');
}

export function firstNameFromFullName(fullName: string | null | undefined): string {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    return parts[0] || '';
}


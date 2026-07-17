'use client';

import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Eye, Mail, MessageSquare } from 'lucide-react';
import type { MessageTemplates } from '@/types';
import {
    DEFAULT_MESSAGE_TEMPLATES,
    MESSAGE_TEMPLATE_VARIABLES,
    analyzeMessageTemplate,
    renderMessageTemplatePreview,
} from '@/lib/message-templates';

interface MessageTemplatesEditorProps {
    templates: MessageTemplates;
    onChange: (updater: (prev: MessageTemplates) => MessageTemplates) => void;
}

interface TemplateFieldProps {
    id: string;
    label: string;
    value: string;
    placeholder: string;
    onChange: (value: string) => void;
    maxLength: number;
    multiline?: boolean;
}

/**
 * One editable template field with variable-insertion chips, inline validation
 * of unknown/malformed {{tokens}}, and a resolved preview using safe sample
 * data. Insertion happens at the caret so it composes with hand-typed text.
 */
function TemplateField({ id, label, value, placeholder, onChange, maxLength, multiline = false }: TemplateFieldProps) {
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    const insertVariable = (key: string) => {
        const token = `{{${key}}}`;
        const el = inputRef.current;
        if (!el) {
            onChange(value + token);
            return;
        }
        const start = el.selectionStart ?? value.length;
        const end = el.selectionEnd ?? value.length;
        const next = value.slice(0, start) + token + value.slice(end);
        if (next.length > maxLength) return;
        onChange(next);
        requestAnimationFrame(() => {
            el.focus();
            const caret = start + token.length;
            el.setSelectionRange(caret, caret);
        });
    };

    const analysis = analyzeMessageTemplate(value);
    const hasIssues = analysis.unknownVariables.length > 0 || analysis.malformedTokens.length > 0;
    const effectiveTemplate = value.trim() ? value : placeholder;
    const previewText = renderMessageTemplatePreview(effectiveTemplate);

    return (
        <div className="space-y-2">
            <Label htmlFor={id} className="text-foreground text-sm">{label}</Label>
            {multiline ? (
                <Textarea
                    id={id}
                    ref={inputRef as React.Ref<HTMLTextAreaElement>}
                    value={value}
                    placeholder={placeholder}
                    onChange={(e) => onChange(e.target.value)}
                    className="bg-background border-input text-foreground placeholder:text-muted-foreground min-h-[120px]"
                    maxLength={maxLength}
                    aria-invalid={hasIssues}
                />
            ) : (
                <Input
                    id={id}
                    ref={inputRef as React.Ref<HTMLInputElement>}
                    value={value}
                    placeholder={placeholder}
                    onChange={(e) => onChange(e.target.value)}
                    className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                    maxLength={maxLength}
                    aria-invalid={hasIssues}
                />
            )}

            <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground mr-1">Insert:</span>
                {MESSAGE_TEMPLATE_VARIABLES.map((variable) => (
                    <button
                        key={variable.key}
                        type="button"
                        // Keep focus on the field so insertion lands at the caret.
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertVariable(variable.key)}
                        className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/40"
                    >
                        {variable.label}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={() => setShowPreview((prev) => !prev)}
                    aria-expanded={showPreview}
                    className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                >
                    <Eye className="h-3 w-3" aria-hidden="true" />
                    {showPreview ? 'Hide preview' : 'Preview'}
                </button>
            </div>

            {hasIssues && (
                <p className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400" role="alert">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" aria-hidden="true" />
                    <span>
                        {analysis.unknownVariables.length > 0 && (
                            <>Unknown variable{analysis.unknownVariables.length > 1 ? 's' : ''}: {analysis.unknownVariables.map((v) => `{{${v}}}`).join(', ')}. </>
                        )}
                        {analysis.malformedTokens.length > 0 && (
                            <>Check these tokens: {analysis.malformedTokens.join(', ')}. </>
                        )}
                        They will be removed when the message is sent.
                    </span>
                </p>
            )}

            {showPreview && (
                <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                    <p className="text-[11px] font-medium text-muted-foreground mb-1">Preview with sample data{value.trim() ? '' : ' (default template)'}:</p>
                    <p className="text-xs text-foreground whitespace-pre-wrap break-words">{previewText}</p>
                </div>
            )}
        </div>
    );
}

/**
 * Per-profile seller request/reminder message templates. Purely a controlled
 * editor: the parent owns the state and save semantics. Empty fields fall back
 * to the product default template (shown as the placeholder).
 */
export default function MessageTemplatesEditor({ templates, onChange }: MessageTemplatesEditorProps) {
    const setSellerRequest = (patch: (prev: NonNullable<MessageTemplates['seller_request']>) => NonNullable<MessageTemplates['seller_request']>) => {
        onChange((prev) => ({
            ...prev,
            seller_request: patch(prev.seller_request || {}),
        }));
    };

    const setSellerReminder = (patch: (prev: NonNullable<MessageTemplates['seller_reminder']>) => NonNullable<MessageTemplates['seller_reminder']>) => {
        onChange((prev) => ({
            ...prev,
            seller_reminder: patch(prev.seller_reminder || {}),
        }));
    };

    return (
        <div className="space-y-5">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">
                    Use the insert buttons to add variables like{' '}
                    <span className="font-mono">{'{{property_address}}'}</span>. Leave a field blank to use the default
                    template (shown in gray). Preview shows how a message looks with sample data.
                </p>
            </div>

            <Tabs defaultValue="seller_request">
                <TabsList className="grid w-full grid-cols-2 h-auto">
                    <TabsTrigger value="seller_request" className="py-1.5">Seller Request</TabsTrigger>
                    <TabsTrigger value="seller_reminder" className="py-1.5">Seller Reminder</TabsTrigger>
                </TabsList>

                <TabsContent value="seller_request" className="space-y-6 mt-4">
                    {/* SMS */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            <Label className="text-foreground">Text message (copy &amp; share)</Label>
                        </div>
                        <TemplateField
                            id="templateRequestSms"
                            label="Message"
                            multiline
                            value={templates.seller_request?.sms || ''}
                            placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_request?.sms || ''}
                            maxLength={500}
                            onChange={(value) => setSellerRequest((prev) => ({ ...prev, sms: value }))}
                        />
                    </div>

                    {/* Manual mailto */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            <Label className="text-foreground">Email you send yourself (opens in your mail app)</Label>
                        </div>
                        <TemplateField
                            id="templateRequestMailtoSubject"
                            label="Subject"
                            value={templates.seller_request?.mailto?.subject || ''}
                            placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_request?.mailto?.subject || ''}
                            maxLength={200}
                            onChange={(value) => setSellerRequest((prev) => ({ ...prev, mailto: { ...(prev.mailto || {}), subject: value } }))}
                        />
                        <TemplateField
                            id="templateRequestMailtoBody"
                            label="Body"
                            multiline
                            value={templates.seller_request?.mailto?.body || ''}
                            placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_request?.mailto?.body || ''}
                            maxLength={6000}
                            onChange={(value) => setSellerRequest((prev) => ({ ...prev, mailto: { ...(prev.mailto || {}), body: value } }))}
                        />
                    </div>

                    {/* Automatic email */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            <Label className="text-foreground">Email UtilitySheet sends automatically</Label>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <TemplateField
                                id="templateRequestEmailSubject"
                                label="Subject"
                                value={templates.seller_request?.email?.subject || ''}
                                placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_request?.email?.subject || ''}
                                maxLength={200}
                                onChange={(value) => setSellerRequest((prev) => ({ ...prev, email: { ...(prev.email || {}), subject: value } }))}
                            />
                            <TemplateField
                                id="templateRequestEmailButton"
                                label="Button text"
                                value={templates.seller_request?.email?.button_text || ''}
                                placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_request?.email?.button_text || ''}
                                maxLength={80}
                                onChange={(value) => setSellerRequest((prev) => ({ ...prev, email: { ...(prev.email || {}), button_text: value } }))}
                            />
                        </div>
                        <TemplateField
                            id="templateRequestEmailBody"
                            label="Body"
                            multiline
                            value={templates.seller_request?.email?.body || ''}
                            placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_request?.email?.body || ''}
                            maxLength={12000}
                            onChange={(value) => setSellerRequest((prev) => ({ ...prev, email: { ...(prev.email || {}), body: value } }))}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="seller_reminder" className="space-y-6 mt-4">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            <Label className="text-foreground">Reminder email UtilitySheet sends automatically</Label>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <TemplateField
                                id="templateReminderEmailSubject"
                                label="Subject"
                                value={templates.seller_reminder?.email?.subject || ''}
                                placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_reminder?.email?.subject || ''}
                                maxLength={200}
                                onChange={(value) => setSellerReminder((prev) => ({ ...prev, email: { ...(prev.email || {}), subject: value } }))}
                            />
                            <TemplateField
                                id="templateReminderEmailButton"
                                label="Button text"
                                value={templates.seller_reminder?.email?.button_text || ''}
                                placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_reminder?.email?.button_text || ''}
                                maxLength={80}
                                onChange={(value) => setSellerReminder((prev) => ({ ...prev, email: { ...(prev.email || {}), button_text: value } }))}
                            />
                        </div>
                        <TemplateField
                            id="templateReminderEmailBody"
                            label="Body"
                            multiline
                            value={templates.seller_reminder?.email?.body || ''}
                            placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_reminder?.email?.body || ''}
                            maxLength={12000}
                            onChange={(value) => setSellerReminder((prev) => ({ ...prev, email: { ...(prev.email || {}), body: value } }))}
                        />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

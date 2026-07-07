'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, MessageSquare } from 'lucide-react';
import type { MessageTemplates } from '@/types';
import { DEFAULT_MESSAGE_TEMPLATES } from '@/lib/message-templates';

interface MessageTemplatesEditorProps {
    templates: MessageTemplates;
    onChange: (updater: (prev: MessageTemplates) => MessageTemplates) => void;
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
                    Available variables:{' '}
                    <span className="font-mono">
                        {'{{seller_first_name_with_space}}'} {'{{seller_name}}'} {'{{agent_name}}'} {'{{property_address}}'} {'{{closing_date}}'} {'{{link}}'}
                    </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                    Leave a field blank to use the default template (shown in gray).
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
                            <Label htmlFor="templateRequestSms" className="text-foreground">Text message (copy &amp; share)</Label>
                        </div>
                        <Textarea
                            id="templateRequestSms"
                            value={templates.seller_request?.sms || ''}
                            placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_request?.sms || ''}
                            onChange={(e) => {
                                const value = e.target.value;
                                setSellerRequest((prev) => ({ ...prev, sms: value }));
                            }}
                            className="bg-background border-input text-foreground placeholder:text-muted-foreground min-h-[80px]"
                            maxLength={500}
                        />
                    </div>

                    {/* Manual mailto */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            <Label className="text-foreground">Email you send yourself (opens in your mail app)</Label>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="templateRequestMailtoSubject" className="text-foreground text-sm">Subject</Label>
                            <Input
                                id="templateRequestMailtoSubject"
                                value={templates.seller_request?.mailto?.subject || ''}
                                placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_request?.mailto?.subject || ''}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setSellerRequest((prev) => ({
                                        ...prev,
                                        mailto: { ...(prev.mailto || {}), subject: value },
                                    }));
                                }}
                                className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                                maxLength={200}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="templateRequestMailtoBody" className="text-foreground text-sm">Body</Label>
                            <Textarea
                                id="templateRequestMailtoBody"
                                value={templates.seller_request?.mailto?.body || ''}
                                placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_request?.mailto?.body || ''}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setSellerRequest((prev) => ({
                                        ...prev,
                                        mailto: { ...(prev.mailto || {}), body: value },
                                    }));
                                }}
                                className="bg-background border-input text-foreground placeholder:text-muted-foreground min-h-[160px]"
                                maxLength={6000}
                            />
                        </div>
                    </div>

                    {/* Automatic email */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            <Label className="text-foreground">Email UtilitySheet sends automatically</Label>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="templateRequestEmailSubject" className="text-foreground text-sm">Subject</Label>
                                <Input
                                    id="templateRequestEmailSubject"
                                    value={templates.seller_request?.email?.subject || ''}
                                    placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_request?.email?.subject || ''}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setSellerRequest((prev) => ({
                                            ...prev,
                                            email: { ...(prev.email || {}), subject: value },
                                        }));
                                    }}
                                    className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                                    maxLength={200}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="templateRequestEmailButton" className="text-foreground text-sm">Button text</Label>
                                <Input
                                    id="templateRequestEmailButton"
                                    value={templates.seller_request?.email?.button_text || ''}
                                    placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_request?.email?.button_text || ''}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setSellerRequest((prev) => ({
                                            ...prev,
                                            email: { ...(prev.email || {}), button_text: value },
                                        }));
                                    }}
                                    className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                                    maxLength={80}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="templateRequestEmailBody" className="text-foreground text-sm">Body</Label>
                            <Textarea
                                id="templateRequestEmailBody"
                                value={templates.seller_request?.email?.body || ''}
                                placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_request?.email?.body || ''}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setSellerRequest((prev) => ({
                                        ...prev,
                                        email: { ...(prev.email || {}), body: value },
                                    }));
                                }}
                                className="bg-background border-input text-foreground placeholder:text-muted-foreground min-h-[180px]"
                                maxLength={12000}
                            />
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="seller_reminder" className="space-y-6 mt-4">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            <Label className="text-foreground">Reminder email UtilitySheet sends automatically</Label>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="templateReminderEmailSubject" className="text-foreground text-sm">Subject</Label>
                                <Input
                                    id="templateReminderEmailSubject"
                                    value={templates.seller_reminder?.email?.subject || ''}
                                    placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_reminder?.email?.subject || ''}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setSellerReminder((prev) => ({
                                            ...prev,
                                            email: { ...(prev.email || {}), subject: value },
                                        }));
                                    }}
                                    className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                                    maxLength={200}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="templateReminderEmailButton" className="text-foreground text-sm">Button text</Label>
                                <Input
                                    id="templateReminderEmailButton"
                                    value={templates.seller_reminder?.email?.button_text || ''}
                                    placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_reminder?.email?.button_text || ''}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setSellerReminder((prev) => ({
                                            ...prev,
                                            email: { ...(prev.email || {}), button_text: value },
                                        }));
                                    }}
                                    className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                                    maxLength={80}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="templateReminderEmailBody" className="text-foreground text-sm">Body</Label>
                            <Textarea
                                id="templateReminderEmailBody"
                                value={templates.seller_reminder?.email?.body || ''}
                                placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_reminder?.email?.body || ''}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setSellerReminder((prev) => ({
                                        ...prev,
                                        email: { ...(prev.email || {}), body: value },
                                    }));
                                }}
                                className="bg-background border-input text-foreground placeholder:text-muted-foreground min-h-[180px]"
                                maxLength={12000}
                            />
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

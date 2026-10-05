'use client';

import { useState } from 'react';
import { MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { trackEvent } from '@/lib/analytics/events';
import { FEEDBACK_MESSAGE_MAX_LENGTH, type FeedbackCategory } from '@/lib/feedback/constants';
import { toast } from 'sonner';

type ChosenCategory = Exclude<FeedbackCategory, 'general'>;

const DEFAULT_PLACEHOLDER = 'Type your message here...';
const COUNTER_THRESHOLD = FEEDBACK_MESSAGE_MAX_LENGTH - 200;

const CATEGORY_OPTIONS: { value: ChosenCategory; label: string; placeholder: string }[] = [
    { value: 'bug', label: 'Something is broken', placeholder: 'What happened, and what did you expect instead?' },
    { value: 'idea', label: 'Idea', placeholder: 'What would make UtilitySheet more useful for you?' },
    { value: 'question', label: 'Question', placeholder: 'What can we help you with?' },
];

export function FeedbackDialog() {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [category, setCategory] = useState<ChosenCategory | null>(null);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleOpenChange = (nextOpen: boolean) => {
        if (nextOpen && !open) trackEvent('feedback_dialog_opened', {});
        setOpen(nextOpen);
    };

    const handleSubmit = async () => {
        if (!message.trim()) return;

        setLoading(true);
        setErrorMessage(null);
        const sentCategory: FeedbackCategory = category ?? 'general';
        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message.trim(),
                    category: sentCategory,
                    pagePath: window.location.pathname,
                    viewport: `${window.innerWidth}x${window.innerHeight}`,
                }),
            });

            if (!response.ok) {
                trackEvent('feedback_submitted', { category: sentCategory, success: false });
                // The draft stays in the box so nothing has to be retyped.
                setErrorMessage(response.status === 429
                    ? 'You have sent several messages in a short time. Please try again in a few minutes.'
                    : 'We could not send your feedback. Your message is still here, so please try again.');
                return;
            }

            trackEvent('feedback_submitted', { category: sentCategory, success: true });
            toast.success('Thanks, your feedback was sent. We read every message and reply by email when needed.');
            setMessage('');
            setCategory(null);
            setOpen(false);
        } catch {
            setErrorMessage('We could not send your feedback. Check your connection and try again.');
        } finally {
            setLoading(false);
        }
    };

    const placeholder = CATEGORY_OPTIONS.find((option) => option.value === category)?.placeholder ?? DEFAULT_PLACEHOLDER;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger
                aria-label="Send feedback"
                className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary/50 hover:text-foreground sm:px-3 md:min-h-9 md:min-w-9"
            >
                <MessageSquare className="h-4 w-4" />
                <span className="hidden md:inline">Feedback</span>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Send Feedback</DialogTitle>
                    <DialogDescription>
                        Found a bug? Have a suggestion? We read every message and reply by email when needed.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                    <Textarea
                        aria-label="Your feedback"
                        placeholder={placeholder}
                        className="min-h-[120px]"
                        value={message}
                        maxLength={FEEDBACK_MESSAGE_MAX_LENGTH}
                        onChange={(e) => setMessage(e.target.value)}
                    />
                    {message.length >= COUNTER_THRESHOLD ? (
                        <p className="text-right text-xs text-muted-foreground" aria-live="polite">
                            {message.length} of {FEEDBACK_MESSAGE_MAX_LENGTH} characters
                        </p>
                    ) : null}
                    <div role="group" aria-label="Type of feedback (optional)" className="flex flex-wrap gap-2">
                        {CATEGORY_OPTIONS.map((option) => (
                            <Button
                                key={option.value}
                                type="button"
                                size="sm"
                                variant={category === option.value ? 'default' : 'outline'}
                                aria-pressed={category === option.value}
                                onClick={() => setCategory(category === option.value ? null : option.value)}
                                disabled={loading}
                            >
                                {option.label}
                            </Button>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        We include the page you are on and your screen size so we can follow up faster.
                    </p>
                    {errorMessage ? (
                        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                            {errorMessage}
                        </p>
                    ) : null}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={!message.trim() || loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Send Feedback
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

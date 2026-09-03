'use client';

import { useId, useState, type FormEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { PacketMode } from '@/types';

interface QuestionGapCaptureProps {
    context: 'settings' | 'request_creation';
    packetMode?: PacketMode;
}

export function QuestionGapCapture({ context, packetMode }: QuestionGapCaptureProps) {
    const helperId = useId();
    const [requestedText, setRequestedText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submitQuestionRequest = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (requestedText.trim().length < 3 || submitting) return;

        setSubmitting(true);
        setError(null);

        try {
            const response = await fetch('/api/question-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestedText, context, packetMode }),
            });

            if (!response.ok) {
                throw new Error('Question request failed');
            }

            setSubmitted(true);
        } catch {
            setError('We could not save that request. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <details className="group rounded-xl border border-dashed border-border bg-muted/15">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                <span>Don&apos;t see a question you need?</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-border/70 px-4 py-4">
                {submitted ? (
                    <p className="text-sm text-emerald-600 dark:text-emerald-300" role="status">
                        Thanks, your question request was recorded.
                    </p>
                ) : (
                    <form className="space-y-3" onSubmit={submitQuestionRequest}>
                        <label className="block space-y-2">
                            <span className="text-sm font-medium text-foreground">
                                What question should the seller form ask?
                            </span>
                            <Textarea
                                value={requestedText}
                                onChange={(event) => setRequestedText(event.target.value)}
                                maxLength={300}
                                placeholder="Example: Who services the home's water softener?"
                                aria-describedby={helperId}
                                className="min-h-20"
                            />
                        </label>
                        <p id={helperId} className="text-xs leading-relaxed text-muted-foreground">
                            Describe the question you want asked. Do not include real codes, passwords, or property details.
                        </p>
                        {error && (
                            <p className="text-sm text-destructive" role="alert">{error}</p>
                        )}
                        <Button
                            type="submit"
                            size="sm"
                            disabled={submitting || requestedText.trim().length < 3}
                        >
                            {submitting ? 'Sending…' : 'Send request'}
                        </Button>
                    </form>
                )}
            </div>
        </details>
    );
}

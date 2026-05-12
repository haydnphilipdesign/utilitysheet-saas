'use client';

import { useTransition } from 'react';
import { Mail, RotateCcw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    sendTestimonialRequestAdminAction,
    sendTestimonialRequestTestToSelfAdminAction,
} from '@/app/(admin)/admin/testimonial-candidates/actions';

type TestimonialOutreachButtonProps = {
    userId: string;
    recipientEmail: string;
    alreadySent: boolean;
};

export function TestimonialOutreachButton({
    userId,
    recipientEmail,
    alreadySent,
}: TestimonialOutreachButtonProps) {
    const [isPending, startTransition] = useTransition();

    const handleSend = () => {
        if (alreadySent && !window.confirm(`Send another testimonial request to ${recipientEmail}?`)) {
            return;
        }

        startTransition(async () => {
            const result = await sendTestimonialRequestAdminAction(userId, {
                allowResend: alreadySent,
            });

            if (!result.success) {
                toast.error(result.error || 'Failed to send testimonial request');
                return;
            }

            toast.success(result.dryRun ? 'Dry run logged. No email was sent.' : `Request sent to ${recipientEmail}`);
        });
    };

    return (
        <Button
            type="button"
            variant={alreadySent ? 'outline' : 'default'}
            size="sm"
            disabled={isPending}
            onClick={handleSend}
        >
            {alreadySent ? <RotateCcw className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {isPending ? 'Sending...' : alreadySent ? 'Send again' : 'Send request'}
        </Button>
    );
}

export function TestimonialOutreachTestButton() {
    const [isPending, startTransition] = useTransition();

    const handleSendTest = () => {
        startTransition(async () => {
            const result = await sendTestimonialRequestTestToSelfAdminAction();

            if (!result.success) {
                toast.error(result.error || 'Failed to send test email');
                return;
            }

            toast.success(result.dryRun ? 'Dry run test logged. No email was sent.' : 'Test email sent to your admin inbox');
        });
    };

    return (
        <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={handleSendTest}>
            <Mail className="h-4 w-4" />
            {isPending ? 'Sending test...' : 'Send test to myself'}
        </Button>
    );
}

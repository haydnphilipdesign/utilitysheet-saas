import { NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/server';
import { sendFeedbackEmail } from '@/lib/email/email-service';

export async function POST(request: Request) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { message } = body;

        if (!message || typeof message !== 'string' || !message.trim()) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        const result = await sendFeedbackEmail({
            userEmail: user.primaryEmail || 'unknown@example.com',
            message: message.trim(),
            userId: user.id,
            userName: user.displayName || undefined,
        });

        if (!result.success) {
            return NextResponse.json({ error: 'Failed to send feedback' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error submitting feedback:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

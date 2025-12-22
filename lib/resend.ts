import { Resend } from 'resend';

// Lazy-loaded Resend client to avoid initialization errors during build
// The API key is read from RESEND_API_KEY environment variable (set in Vercel)
let _resend: Resend | null = null;

export function getResend(): Resend {
    if (!_resend) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            throw new Error('RESEND_API_KEY environment variable is not set');
        }
        _resend = new Resend(apiKey);
    }
    return _resend;
}

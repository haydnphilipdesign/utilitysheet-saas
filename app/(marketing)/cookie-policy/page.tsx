import type { Metadata } from 'next';
import Link from 'next/link';

const LAST_UPDATED = 'January 14, 2026';

export const metadata: Metadata = {
    title: 'Cookie Policy',
    description: 'How UtilitySheet uses cookies and similar technologies.',
};

export default function CookiePolicyPage() {
    return (
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Cookie Policy</h1>
            <p className="mt-4 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>

            <div className="mt-8 space-y-8 text-base leading-7 text-muted-foreground">
                <p>
                    This Cookie Policy explains how UtilitySheet uses cookies and similar technologies when you use our website and services.
                </p>

                <h2 className="text-2xl font-semibold tracking-tight text-foreground">What are cookies?</h2>
                <p>
                    Cookies are small text files that are stored on your device. They help websites remember information about your visit, which can make
                    the site work properly and improve your experience.
                </p>

                <h2 className="text-2xl font-semibold tracking-tight text-foreground">How we use cookies</h2>
                <ul className="list-disc pl-6 space-y-2">
                    <li>
                        <strong className="text-foreground">Essential cookies:</strong> Used to help the Service function (for example, authentication and
                        security).
                    </li>
                    <li>
                        <strong className="text-foreground">Preference cookies:</strong> Used to remember choices like theme or other settings.
                    </li>
                    <li>
                        <strong className="text-foreground">Analytics:</strong> Used to understand how the Service is used so we can improve it.
                    </li>
                </ul>

                <h2 className="text-2xl font-semibold tracking-tight text-foreground">Your choices</h2>
                <p>
                    You can control cookies through your browser settings. Disabling certain cookies may impact site functionality. For more information
                    about how we handle data, see our{' '}
                    <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
                        Privacy Policy
                    </Link>
                    .
                </p>
            </div>
        </div>
    );
}

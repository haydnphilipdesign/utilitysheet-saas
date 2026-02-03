import type { Metadata } from 'next';
import Link from 'next/link';

const LAST_UPDATED = 'January 14, 2026';

export const metadata: Metadata = {
    title: 'Privacy Policy',
    description: 'How UtilitySheet collects, uses, and shares information when you use the service.',
};

export default function PrivacyPage() {
    return (
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Privacy Policy</h1>
            <p className="mt-4 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>

            <div className="mt-8 space-y-8 text-base leading-7 text-muted-foreground">
                <p>
                    This Privacy Policy explains how UtilitySheet (“UtilitySheet”, “we”, “us”) collects, uses, and shares information when you use our
                    website and services (the “Service”).
                </p>

                <h2 className="text-2xl font-semibold tracking-tight text-foreground">Information we collect</h2>
                <ul className="list-disc pl-6 space-y-2">
                    <li>
                        <strong className="text-foreground">Account information:</strong> When you create an account, we collect details like your email
                        address and any information you choose to provide.
                    </li>
                    <li>
                        <strong className="text-foreground">Request and sheet data:</strong> When you create a request or a seller completes a request,
                        we process the information needed to generate a utility sheet (for example, property address and utility provider details entered
                        or confirmed).
                    </li>
                    <li>
                        <strong className="text-foreground">Usage and device data:</strong> We may collect basic usage data (such as pages visited and
                        actions taken) and device information for security, analytics, and product improvement.
                    </li>
                    <li>
                        <strong className="text-foreground">Communications:</strong> If you contact us, we collect the contents of your message and any
                        information you provide.
                    </li>
                </ul>

                <h2 className="text-2xl font-semibold tracking-tight text-foreground">How we use information</h2>
                <ul className="list-disc pl-6 space-y-2">
                    <li>Provide, operate, and maintain the Service.</li>
                    <li>Generate utility sheets (web + PDF) and enable sharing.</li>
                    <li>Communicate with you about the Service, including support messages and product updates.</li>
                    <li>Improve the Service, including measuring performance and diagnosing issues.</li>
                    <li>Protect the Service from abuse, fraud, and security incidents.</li>
                </ul>

                <h2 className="text-2xl font-semibold tracking-tight text-foreground">How we share information</h2>
                <p>
                    We may share information with service providers who help us operate the Service (for example, hosting, analytics, email delivery, and
                    payment processing). These providers are authorized to use information only as needed to provide services to us.
                </p>
                <p>
                    We may also disclose information if required to comply with law, enforce our terms, or protect the rights, property, or safety of
                    UtilitySheet and our users.
                </p>

                <h2 className="text-2xl font-semibold tracking-tight text-foreground">Cookies</h2>
                <p>
                    We use cookies and similar technologies to help the Service function (for example, keeping you signed in) and to understand usage.
                    See our <Link href="/cookie-policy" className="underline underline-offset-4 hover:text-foreground">Cookie Policy</Link> for details.
                </p>

                <h2 className="text-2xl font-semibold tracking-tight text-foreground">Contact</h2>
                <p>
                    Questions about this Privacy Policy? Email{' '}
                    <a href="mailto:haydn@multimedium.dev" className="underline underline-offset-4 hover:text-foreground">
                        haydn@multimedium.dev
                    </a>
                    .
                </p>
            </div>
        </div>
    );
}

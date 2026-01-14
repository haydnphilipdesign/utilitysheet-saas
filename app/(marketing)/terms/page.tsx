import type { Metadata } from 'next';
import Link from 'next/link';

const LAST_UPDATED = 'January 14, 2026';

export const metadata: Metadata = {
    title: 'Terms of Service',
    description: 'UtilitySheet terms governing access to and use of the UtilitySheet service.',
};

export default function TermsPage() {
    return (
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Terms of Service</h1>
            <p className="mt-4 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>

            <div className="mt-8 space-y-8 text-base leading-7 text-muted-foreground">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">1. Acceptance</h2>
                <p>
                    These Terms of Service (&quot;Terms&quot;) govern your access to and use of UtilitySheet (the &quot;Service&quot;) at utilitysheet.com.
                    By accessing or using the Service, you agree to these Terms. If you do not agree, do not use the Service.
                </p>

                <h2 className="text-2xl font-semibold tracking-tight text-foreground">2. Accounts and use</h2>
                <p>
                    You are responsible for maintaining the confidentiality of your account and for all activity under your account.
                    You agree not to misuse the Service, including attempting to access it using automated means, probing for vulnerabilities, or interfering with other users.
                </p>

                <h2 className="text-2xl font-semibold tracking-tight text-foreground">3. Subscriptions and billing</h2>
                <p>
                    UtilitySheet may offer free and paid plans. If you purchase a paid plan, you authorize us (and our payment processor) to charge applicable fees and taxes.
                    Fees are non-refundable except where required by law.
                </p>

                <h2 className="text-2xl font-semibold tracking-tight text-foreground">4. Privacy</h2>
                <p>
                    Our <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">Privacy Policy</Link> explains how we collect and use information.
                </p>

                <h2 className="text-2xl font-semibold tracking-tight text-foreground">5. Disclaimer</h2>
                <p>
                    The Service is provided &quot;as is&quot; and &quot;as available&quot;. To the fullest extent permitted by law, we disclaim all warranties, whether express or implied,
                    including implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
                </p>

                <h2 className="text-2xl font-semibold tracking-tight text-foreground">6. Limitation of liability</h2>
                <p>
                    To the fullest extent permitted by law, UtilitySheet will not be liable for any indirect, incidental, special, consequential, or punitive damages,
                    or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses,
                    resulting from (a) your use of or inability to use the Service; (b) any unauthorized access to or use of our servers; or (c) any interruption or cessation of transmission to or from the Service.
                </p>

                <h2 className="text-2xl font-semibold tracking-tight text-foreground">7. Changes</h2>
                <p>
                    We may update these Terms from time to time. If we make material changes, we will provide notice as required by law.
                </p>

                <h2 className="text-2xl font-semibold tracking-tight text-foreground">8. Contact</h2>
                <p>
                    Questions about these Terms? Email <a href="mailto:feedback@utilitysheet.com" className="underline underline-offset-4 hover:text-foreground">feedback@utilitysheet.com</a>.
                </p>
            </div>
        </div>
    );
}

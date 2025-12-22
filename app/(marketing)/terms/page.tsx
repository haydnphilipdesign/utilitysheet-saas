export default function TermsPage() {
    return (
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Terms of Service</h1>
            <p className="mt-4 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

            <div className="mt-8 space-y-8 text-base leading-7 text-muted-foreground">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">1. Terms</h2>
                <p>
                    By accessing this Website, accessible from utilitysheet.com, you are agreeing to be bound by these Website Terms and Conditions of Use and agree that you are responsible for the agreement with any applicable local laws. If you disagree with any of these terms, you are prohibited from accessing this site. The materials contained in this Website are protected by copyright and trade mark law.
                </p>

                <h2 className="text-2xl font-semibold tracking-tight text-foreground">2. Use License</h2>
                <p>
                    Permission is granted to temporarily download one copy of the materials on UtilitySheet&apos;s Website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                    <li>modify or copy the materials;</li>
                    <li>use the materials for any commercial purpose or for any public display;</li>
                    <li>attempt to reverse engineer any software contained on UtilitySheet&apos;s Website;</li>
                    <li>remove any copyright or other proprietary notations from the materials; or</li>
                    <li>transfer the materials to another person or &quot;mirror&quot; the materials on any other server.</li>
                </ul>

                <h2 className="text-2xl font-semibold tracking-tight text-foreground">3. Disclaimer</h2>
                <p>
                    All the materials on UtilitySheet&apos;s Website are provided &quot;as is&quot;. UtilitySheet makes no warranties, may it be expressed or implied, therefore negates all other warranties. Furthermore, UtilitySheet does not make any representations concerning the accuracy or likely reliability of the use of the materials on its Website or otherwise relating to such materials or on any sites linked to this Website.
                </p>

                <h2 className="text-2xl font-semibold tracking-tight text-foreground">4. Limitations</h2>
                <p>
                    UtilitySheet or its suppliers will not be hold accountable for any damages that will arise with the use or inability to use the materials on UtilitySheet&apos;s Website, even if UtilitySheet or an authorize representative of this Website has been notified, orally or written, of the possibility of such damage. Some jurisdiction does not allow limitations on implied warranties or limitations of liability for incidental damages, these limitations may not apply to you.
                </p>
            </div>
        </div>
    );
}

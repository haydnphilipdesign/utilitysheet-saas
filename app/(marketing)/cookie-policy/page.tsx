export default function CookiePolicyPage() {
    return (
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Cookie Policy</h1>
            <p className="mt-4 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

            <div className="mt-8 space-y-8 text-base leading-7 text-muted-foreground">
                <p>
                    This is the Cookie Policy for UtilitySheet, accessible from utilitysheet.com.
                </p>

                <h2 className="text-2xl font-semibold tracking-tight text-foreground">What Are Cookies</h2>
                <p>
                    As is common practice with almost all professional websites this site uses cookies, which are tiny files that are downloaded to your computer, to improve your experience. This page describes what information they gather, how we use it and why we sometimes need to store these cookies. We will also share how you can prevent these cookies from being stored however this may downgrade or &quot;break&quot; certain elements of the sites functionality.
                </p>

                <h2 className="text-2xl font-semibold tracking-tight text-foreground">How We Use Cookies</h2>
                <p>
                    We use cookies for a variety of reasons detailed below. Unfortunately in most cases there are no industry standard options for disabling cookies without completely disabling the functionality and features they add to this site. It is recommended that you leave on all cookies if you are not sure whether you need them or not in case they are used to provide a service that you use.
                </p>

                <h2 className="text-2xl font-semibold tracking-tight text-foreground">Disabling Cookies</h2>
                <p>
                    You can prevent the setting of cookies by adjusting the settings on your browser (see your browser Help for how to do this). Be aware that disabling cookies will affect the functionality of this and many other websites that you visit. Disabling cookies will usually result in also disabling certain functionality and features of the this site. Therefore it is recommended that you do not disable cookies.
                </p>

                <h2 className="text-2xl font-semibold tracking-tight text-foreground">The Cookies We Set</h2>
                <ul className="list-disc pl-6 space-y-2">
                    <li>
                        <strong>Account related cookies:</strong> If you create an account with us then we will use cookies for the management of the signup process and general administration. These cookies will usually be deleted when you log out however in some cases they may remain afterwards to remember your site preferences when logged out.
                    </li>
                    <li>
                        <strong>Login related cookies:</strong> We use cookies when you are logged in so that we can remember this fact. This prevents you from having to log in every single time you visit a new page. These cookies are typically removed or cleared when you log out to ensure that you can only access restricted features and areas when logged in.
                    </li>
                </ul>
            </div>
        </div>
    );
}

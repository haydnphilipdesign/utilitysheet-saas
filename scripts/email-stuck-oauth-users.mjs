import { Resend } from 'resend';

// Run with: node --env-file=.env.local scripts/email-stuck-oauth-users.mjs [--send]
const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
    console.error('RESEND_API_KEY not set. Add it to .env.local before running.');
    process.exit(1);
}

const SEND = process.argv.includes('--send');
const FROM = 'Haydn at UtilitySheet <noreply@utilitysheet.com>';
const REPLY_TO = 'Haydn@multimedium.dev';
const LOGIN_URL = 'https://www.utilitysheet.com/auth/login';

// Excludes Haydn's three personal/test accounts.
const recipients = [
    { email: 'info@contracts2closed.com', name: 'Tatiana Mayorga' },
    { email: 'nadine@keirealty.com', name: 'Nadzrolin Urbano' },
    { email: 'christy@homesbysavage.com', name: 'Christy Savage' },
    { email: 'janaleneh@gmail.com', name: 'Janalene Hiller' },
    { email: 'aadenhiller07@gmail.com', name: 'Aaden Hiller' },
    { email: 'grezielpaguia@gmail.com', name: 'Greziel Paguia' },
    { email: 'ayana@gvmrealty.com', name: 'Ayana Youmans' },
    { email: 'ayana.middleton84@gmail.com', name: 'Ayana Youmans' },
    { email: 'ayanasoldit@kw.com', name: 'Ayana Youmans' },
    { email: 'kristina@transactionville.com', name: 'Kristina Gallagher' },
    { email: 'jadezivkoteam@gmail.com', name: 'Jade Zivko Team' },
    { email: 'sara@fastforwardtm.com', name: 'Sara Morrison' },
    { email: 'marc@midastransactiongroup.com', name: 'Marc J Diaz' },
    { email: 'emily@jadetransactions.com', name: 'Emily Peacock' },
    { email: 'thomasriley2344@gmail.com', name: 'Thomas Riley' },
    { email: 'amanda@easypeasytc.com', name: 'Amanda Willis' },
    { email: 'jessica@ctmtransactionservices.com', name: 'Jessica Steffen' },
    { email: 'jennhelpme@gmail.com', name: 'Jennifer Yatzeck' },
    { email: 'jessie@fastforwardtm.com', name: 'Jessie Meermans' },
    { email: 'egallagher@precisionleveragesolutions.com', name: 'Emily Gallagher' },
    { email: 'tammysue33@gmail.com', name: 'Tammy Weinick' },
];

const firstName = (name) => {
    if (!name) return null;
    const trimmed = name.trim().split(/\s+/)[0];
    if (!trimmed || trimmed.toLowerCase().includes('team')) return null;
    return trimmed;
};

const subject = 'Sorry — sign-in with Google was broken when you tried UtilitySheet';

const buildText = (name) => {
    const greeting = name ? `Hi ${name},` : 'Hi there,';
    return `${greeting}

I'm Haydn, the founder of UtilitySheet. I'm reaching out because you signed up using "Continue with Google" but never made it past the sign-in screen.

We discovered a bug in our Google sign-in flow that was silently bouncing every Google signup back to the login page after authenticating. Your account was created on our side, but you never got into the dashboard. I'm really sorry — that's been live longer than I'd like to admit, and you wouldn't have known anything was wrong on your end.

It's now fixed. You can sign back in here and you'll land in your dashboard:
${LOGIN_URL}

If anything still feels off, just reply to this email and I'll sort it out personally.

Thanks for giving us a try,
Haydn
UtilitySheet`;
};

const buildHtml = (name) => {
    const greeting = name ? `Hi ${name},` : 'Hi there,';
    return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;line-height:1.6;max-width:560px;margin:0 auto;padding:24px;">
<p>${greeting}</p>
<p>I'm Haydn, the founder of UtilitySheet. I'm reaching out because you signed up using "Continue with Google" but never made it past the sign-in screen.</p>
<p>We discovered a bug in our Google sign-in flow that was silently bouncing every Google signup back to the login page after authenticating. Your account was created on our side, but you never got into the dashboard. I'm really sorry — that's been live longer than I'd like to admit, and you wouldn't have known anything was wrong on your end.</p>
<p>It's now fixed. You can sign back in here and you'll land in your dashboard:</p>
<p><a href="${LOGIN_URL}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Sign in to UtilitySheet</a></p>
<p>If anything still feels off, just reply to this email and I'll sort it out personally.</p>
<p>Thanks for giving us a try,<br>Haydn<br>UtilitySheet</p>
</body></html>`;
};

const resend = new Resend(apiKey);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`Mode: ${SEND ? 'LIVE SEND' : 'DRY RUN (no emails sent — pass --send to actually send)'}`);
console.log(`Recipients: ${recipients.length}\n`);

let sent = 0;
let failed = 0;

for (const r of recipients) {
    const name = firstName(r.name);
    const payload = {
        from: FROM,
        to: r.email,
        replyTo: REPLY_TO,
        subject,
        text: buildText(name),
        html: buildHtml(name),
    };

    if (!SEND) {
        console.log(`[dry-run] -> ${r.email}  (greeting: "${name ? 'Hi ' + name : 'Hi there'}")`);
        continue;
    }

    try {
        const result = await resend.emails.send(payload);
        if (result.error) {
            failed++;
            console.error(`FAIL ${r.email}:`, result.error);
        } else {
            sent++;
            console.log(`OK   ${r.email}  id=${result.data?.id}`);
        }
    } catch (err) {
        failed++;
        console.error(`THROW ${r.email}:`, err.message);
    }
    await sleep(600); // stay under Resend's 2 req/sec default
}

if (SEND) {
    console.log(`\nDone. sent=${sent} failed=${failed}`);
}

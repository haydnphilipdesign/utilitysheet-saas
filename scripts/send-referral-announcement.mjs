import { neon } from '@neondatabase/serverless';
import { Resend } from 'resend';

// Announces the referral program to every account, with each user's real
// referral link merged in. Draft + rationale: docs/growth/referral-announcement-email.md
//
// Dry run (default):  node --env-file=.env.local scripts/send-referral-announcement.mjs
// Send yourself one:  node --env-file=.env.local scripts/send-referral-announcement.mjs --test you@example.com
// Live send:          node --env-file=.env.local scripts/send-referral-announcement.mjs --send

const apiKey = process.env.RESEND_API_KEY;
const databaseUrl = process.env.DATABASE_URL;
if (!apiKey || !databaseUrl) {
    console.error('RESEND_API_KEY and DATABASE_URL must be set. Run with --env-file=.env.local');
    process.exit(1);
}

const SEND = process.argv.includes('--send');
const testFlagIndex = process.argv.indexOf('--test');
const TEST_EMAIL = testFlagIndex !== -1 ? process.argv[testFlagIndex + 1] : null;

const FROM = 'Haydn at UtilitySheet <noreply@utilitysheet.com>';
const REPLY_TO = 'Haydn@multimedium.dev';
const APP_URL = 'https://www.utilitysheet.com';
const SUBJECT = 'Give a month of Pro, get a month of Pro';

// Gmail ignores dots and +tags, so normalize those away for dedupe and
// exclusion checks (multi.medium.designs@gmail.com == multimediumdesigns@gmail.com).
const normalizeEmail = (raw) => {
    const email = String(raw || '').trim().toLowerCase();
    const at = email.lastIndexOf('@');
    if (at === -1) return email;
    let local = email.slice(0, at);
    const domain = email.slice(at + 1);
    if (domain === 'gmail.com' || domain === 'googlemail.com') {
        local = local.split('+')[0].replace(/\./g, '');
    }
    return `${local}@${domain}`;
};

// Never send to test/demo domains.
const EXCLUDE_DOMAINS = new Set(['example.com', 'utilitysheet.test', 'utilitysheet.com']);

// Accounts that should never receive the announcement (founder + test accounts).
// Add any others before sending. Compared after Gmail normalization.
const EXCLUDE_EMAILS = new Set([
    'demo.tc@utilitysheet.test',
    'multimediumdesigns@gmail.com',
    'haydn@multimedium.dev',
    'haydnpwatkins@gmail.com',
    'lucasbennett994@gmail.com',
    'utilitysheet1@gmail.com',
    'homewifi20222023@gmail.com',
    'multimediumclients@gmail.com',
    'haydnphilipdesign@gmail.com',
].map(normalizeEmail));

const firstName = (name) => {
    if (!name) return null;
    const trimmed = name.trim().split(/\s+/)[0];
    if (!trimmed || trimmed.toLowerCase().includes('team')) return null;
    return trimmed;
};

const referralLink = (slug) => {
    if (!slug) return null;
    const url = new URL('/auth/signup', APP_URL);
    url.searchParams.set('ref', slug);
    return url.toString();
};

const buildText = (name, link) => {
    const greeting = name ? `Hi ${name},` : 'Hi there,';
    const linkBlock = link
        ? `Your referral link:\n${link}\n\nYou can also find it anytime under Settings > Referrals, along with a running count of the months you've earned.`
        : `You can find your referral link under Settings > Referrals, along with a running count of the months you've earned.`;
    return `${greeting}

Quick update from me. UtilitySheet now has a referral program, and it's simple:

Give a month of Pro, get a month of Pro.

Share your personal referral link with another TC or agent. When they sign up and receive their first real seller submission, you get a free month of Pro ($9 credit, applied to your bill automatically) and they get a free Pro month too.

${linkBlock}

If there's one person you'd send it to, it's probably the TC or agent on the other side of your last closing. They've already seen the finished sheet.

That's it. If you have questions or ideas, just reply, I read everything.

Thanks for using UtilitySheet,
Haydn`;
};

const sql = neon(databaseUrl);
const resend = new Resend(apiKey);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const rows = await sql`
    SELECT a.email, a.full_name, il.slug
    FROM accounts a
    LEFT JOIN intake_links il ON il.account_id = a.id
    WHERE a.email IS NOT NULL
    ORDER BY a.created_at ASC
`;

const seen = new Set();
const recipients = [];
for (const row of rows) {
    const email = String(row.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) continue;
    const normalized = normalizeEmail(email);
    const domain = normalized.slice(normalized.lastIndexOf('@') + 1);
    if (EXCLUDE_EMAILS.has(normalized) || EXCLUDE_DOMAINS.has(domain)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    recipients.push({ email, name: firstName(row.full_name), slug: row.slug || null });
}

if (TEST_EMAIL) {
    const sample = recipients.find((r) => r.slug) || recipients[0];
    const payload = {
        from: FROM,
        to: TEST_EMAIL,
        replyTo: REPLY_TO,
        subject: `[TEST] ${SUBJECT}`,
        text: buildText(sample?.name || 'Haydn', referralLink(sample?.slug)),
    };
    const result = await resend.emails.send(payload);
    if (result.error) {
        console.error('Test send failed:', result.error);
        process.exit(1);
    }
    console.log(`Test email sent to ${TEST_EMAIL} (rendered with sample recipient data). id=${result.data?.id}`);
    process.exit(0);
}

console.log(`Mode: ${SEND ? 'LIVE SEND' : 'DRY RUN (no emails sent — pass --send to actually send)'}`);
console.log(`Recipients: ${recipients.length} (excluded ${rows.length - recipients.length} rows: dupes, test accounts, exclude list)\n`);

let sent = 0;
let failed = 0;
let missingSlug = 0;

for (const r of recipients) {
    const link = referralLink(r.slug);
    if (!link) missingSlug++;

    if (!SEND) {
        console.log(`[dry-run] -> ${r.email}  (greeting: "${r.name ? 'Hi ' + r.name : 'Hi there'}", link: ${link || 'NONE — settings fallback copy'})`);
        continue;
    }

    try {
        const result = await resend.emails.send({
            from: FROM,
            to: r.email,
            replyTo: REPLY_TO,
            subject: SUBJECT,
            text: buildText(r.name, link),
        });
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

if (!SEND && missingSlug > 0) {
    console.log(`\nNote: ${missingSlug} recipient(s) have no intake link slug and will get the settings-fallback copy.`);
}
if (SEND) {
    console.log(`\nDone. sent=${sent} failed=${failed}`);
}

import { readFileSync } from 'node:fs';

const raw = JSON.parse(readFileSync('users_sync.json', 'utf8'));
const rows = Array.isArray(raw) ? raw : raw.users ?? raw.data ?? [];
const users = rows.map((r) => r.raw_json ?? r);

const looksGoogle = (u) =>
    u.has_password === false &&
    u.auth_with_email === false &&
    typeof u.profile_image_url === 'string' &&
    u.profile_image_url.includes('googleusercontent.com');

const NEVER_RETURNED_MS = 5 * 60 * 1000;

const stuck = [];
const otherGoogle = [];
const nonGoogle = [];

for (const u of users) {
    const signup = u.signed_up_at_millis ?? 0;
    const last = u.last_active_at_millis ?? signup;
    const sessionGap = last - signup;
    const row = {
        email: u.primary_email,
        name: u.display_name,
        signed_up_at: new Date(signup).toISOString(),
        last_active_gap_ms: sessionGap,
    };
    if (looksGoogle(u)) {
        if (sessionGap < NEVER_RETURNED_MS) stuck.push(row);
        else otherGoogle.push(row);
    } else {
        nonGoogle.push(row);
    }
}

stuck.sort((a, b) => a.signed_up_at.localeCompare(b.signed_up_at));

console.log(`Total users: ${users.length}`);
console.log(`Google sign-ups likely stuck: ${stuck.length}`);
console.log(`Google sign-ups that did return (>5min gap): ${otherGoogle.length}`);
console.log(`Email/password or other: ${nonGoogle.length}`);
console.log('\nLikely affected:');
for (const r of stuck) {
    console.log(`  ${r.signed_up_at}  ${r.email}  (${r.name})  gap=${r.last_active_gap_ms}ms`);
}
console.log('\nGoogle sign-ups that did come back later:');
for (const r of otherGoogle) {
    console.log(`  ${r.signed_up_at}  ${r.email}  (${r.name})  gap=${r.last_active_gap_ms}ms`);
}

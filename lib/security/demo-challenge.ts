import crypto from 'node:crypto';

export const DEMO_CHALLENGE_COOKIE = 'us_demo_challenge';
const DEMO_CHALLENGE_TTL_SECONDS = 5 * 60;

type DemoChallengePayload = {
    n: string;
    exp: number;
    ua: string;
};

function base64UrlEncode(value: string): string {
    return Buffer.from(value, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function base64UrlDecode(value: string): string {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return Buffer.from(padded, 'base64').toString('utf8');
}

function parseCookieValue(rawCookieHeader: string | null, key: string): string | null {
    if (!rawCookieHeader) return null;
    const parts = rawCookieHeader.split(';');
    for (const part of parts) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        const cookieKey = part.slice(0, idx).trim();
        if (cookieKey !== key) continue;
        return part.slice(idx + 1).trim();
    }
    return null;
}

function getChallengeSecret(): string {
    if (process.env.DEMO_CHALLENGE_SECRET) {
        return process.env.DEMO_CHALLENGE_SECRET;
    }

    if (process.env.NODE_ENV === 'production') {
        return '';
    }

    return 'demo-dev-only-secret';
}

function hashUserAgent(userAgent: string | null): string {
    const value = (userAgent || '').slice(0, 500);
    return crypto.createHash('sha256').update(value).digest('hex');
}

function sign(payloadB64: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

function safeEquals(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
}

export function isDemoChallengeConfigured(): boolean {
    return Boolean(getChallengeSecret());
}

export function createDemoChallenge(userAgent: string | null): {
    nonce: string;
    cookie: string;
    expiresAt: string;
} {
    const secret = getChallengeSecret();
    if (!secret) {
        throw new Error('DEMO_CHALLENGE_SECRET is not configured');
    }

    const nonce = crypto.randomUUID();
    const exp = Math.floor(Date.now() / 1000) + DEMO_CHALLENGE_TTL_SECONDS;
    const payload: DemoChallengePayload = { n: nonce, exp, ua: hashUserAgent(userAgent) };
    const payloadB64 = base64UrlEncode(JSON.stringify(payload));
    const signature = sign(payloadB64, secret);
    const encoded = `${payloadB64}.${signature}`;
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    const cookie =
        `${DEMO_CHALLENGE_COOKIE}=${encoded}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${DEMO_CHALLENGE_TTL_SECONDS}${secure}`;

    return {
        nonce,
        cookie,
        expiresAt: new Date(exp * 1000).toISOString(),
    };
}

export function clearDemoChallengeCookie(): string {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return `${DEMO_CHALLENGE_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function verifyDemoChallenge(request: Request, nonce: string): { valid: boolean; reason?: string } {
    const secret = getChallengeSecret();
    if (!secret) {
        return { valid: false, reason: 'unconfigured' };
    }
    if (!nonce || typeof nonce !== 'string' || nonce.length > 200) {
        return { valid: false, reason: 'invalid_nonce' };
    }

    const rawCookie = parseCookieValue(request.headers.get('cookie'), DEMO_CHALLENGE_COOKIE);
    if (!rawCookie) {
        return { valid: false, reason: 'missing_cookie' };
    }

    const [payloadB64, signature] = rawCookie.split('.');
    if (!payloadB64 || !signature) {
        return { valid: false, reason: 'malformed_cookie' };
    }

    const expected = sign(payloadB64, secret);
    if (!safeEquals(signature, expected)) {
        return { valid: false, reason: 'bad_signature' };
    }

    let parsed: DemoChallengePayload;
    try {
        parsed = JSON.parse(base64UrlDecode(payloadB64)) as DemoChallengePayload;
    } catch {
        return { valid: false, reason: 'bad_payload' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (!parsed.exp || parsed.exp <= now) {
        return { valid: false, reason: 'expired' };
    }

    if (parsed.n !== nonce) {
        return { valid: false, reason: 'nonce_mismatch' };
    }

    const requestUaHash = hashUserAgent(request.headers.get('user-agent'));
    if (parsed.ua !== requestUaHash) {
        return { valid: false, reason: 'ua_mismatch' };
    }

    return { valid: true };
}

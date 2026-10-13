import { createHash } from 'node:crypto';

type CapabilityScope = 'seller-submission' | 'seller-ai' | 'seller-send-link' | 'seller-observation' | 'packet-pdf';

// Only for identifiers containing a high-entropy capability, not IP/email alone.
// Version/scope are part of the hash domain and of the opaque identifier.
export function capabilityRateLimitIdentifier(scope: CapabilityScope, identifier: string): string {
    const digest = createHash('sha256')
        .update(JSON.stringify(['utilitysheet:capability-rate-limit:v1', scope, identifier]))
        .digest('hex');
    return `cap:v1:${scope}:${digest}`;
}

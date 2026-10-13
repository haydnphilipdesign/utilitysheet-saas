import { afterEach, describe, expect, it, vi } from 'vitest';
import { logDiagnostic } from '@/lib/telemetry/diagnostics';

afterEach(() => vi.restoreAllMocks());

describe('bounded operational diagnostics', () => {
    it('reconstructs only finite safe fields without serializing payloads or exception text', () => {
        const sink = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const privateText = '987 Sentinel Street SellerSentinel seller@example.test token-sentinel password-sentinel postgres://sentinel';
        const error = Object.assign(new Error(privateText), { status: 503, code: privateText, cause: { privateText } });
        logDiagnostic('error', 'email_send_failed', {
            operation: 'completion_notification', requestId: '12345678-1234-1234-1234-123456789abc',
            bytes: 1234, attempt: Infinity, latencyMs: -1, sourceWidth: 1e20,
            filename: privateText, recipient: privateText, token: privateText, url: privateText,
            source: privateText, message: privateText, nested: { privateText },
        }, error);
        expect(sink).toHaveBeenCalledWith('[diagnostic] email_send_failed', {
            operation: 'completion_notification', requestId: '12345678-1234-1234-1234-123456789abc',
            bytes: 1234, errorName: 'Error', errorFamily: 'upstream_server', status: 503,
        });
        expect(JSON.stringify(sink.mock.calls)).not.toContain(privateText);
    });

    it('drops unknown events, unsafe ids and names; classifies nested numeric status only', () => {
        const sink = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        logDiagnostic('warn', 'gemini_api_failed', { requestId: 'token-sentinel' }, {
            name: 'name-sentinel', error: { code: 429, message: 'password-sentinel' },
        });
        expect(sink).toHaveBeenCalledWith('[diagnostic] gemini_api_failed', {
            errorName: 'UnknownError', errorFamily: 'rate_limit', status: 429,
        });
        logDiagnostic('warn', 'token-sentinel' as never);
        expect(sink).toHaveBeenCalledTimes(1);
    });

    it('never reads message, stack, cause or serialization hooks and tolerates a failing sink', () => {
        const sink = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const error = { name: 'SyntaxError', get message() { throw new Error('must not read'); },
            get stack() { throw new Error('must not read'); }, toJSON() { throw new Error('must not serialize'); } };
        logDiagnostic('error', 'gemini_parse_failed', {}, error);
        expect(sink).toHaveBeenCalledWith('[diagnostic] gemini_parse_failed', { errorName: 'SyntaxError', errorFamily: 'unclassified' });
        sink.mockImplementation(() => { throw new Error('sink unavailable'); });
        expect(() => logDiagnostic('error', 'gemini_parse_failed', {}, error)).not.toThrow();
    });
});

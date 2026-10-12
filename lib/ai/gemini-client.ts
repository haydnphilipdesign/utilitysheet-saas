import { GoogleGenAI } from '@google/genai';
import type { GenerateContentConfig, GenerateContentResponse, ThinkingLevel, Tool } from '@google/genai';

// Get API key from environment
const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;

// Initialize the Generative AI client (null if not configured)
const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Model configuration
const DEFAULT_MODEL_NAME = 'gemini-3.1-flash-lite';
const MODEL_NAME = process.env.GEMINI_MODEL_NAME?.trim() || DEFAULT_MODEL_NAME;
const ALLOWED_THINKING_LEVELS = ['minimal', 'low', 'medium', 'high'] as const;

// Retry configuration
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

// Timeout configuration. One call to the model may take this long; all the
// attempts of one generation together may take twice that unless the caller
// passes its own deadline.
const DEFAULT_CALL_TIMEOUT_MS = 10_000;
const MIN_CALL_TIMEOUT_MS = 1_000;
const MAX_CALL_TIMEOUT_MS = 60_000;
// An attempt with less time than this left is not worth starting (and billing).
const MIN_ATTEMPT_MS = 1_000;

// Circuit breaker configuration
interface CircuitBreakerState {
    failures: number;
    lastFailure: number;
    isOpen: boolean;
}

const circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailure: 0,
    isOpen: false,
};

const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_RESET_TIMEOUT_MS = 60 * 1000; // 60 seconds
let hasLoggedGroundingThresholdDeprecation = false;

interface GeminiRequestConfig {
    model: string;
    config: GenerateContentConfig;
}

export type JSONFailureReason = 'provider_error' | 'parse_error';

/** Why no answer came back. Recorded in AI telemetry as `error_kind`. */
export type GeminiFailureKind =
    | 'unconfigured'
    | 'circuit_open'
    | 'deadline'
    | 'timeout'
    | 'rate_limited'
    | 'empty_response'
    | 'api_error';

/**
 * What one answered call used. Token counts are null when the provider did not
 * report them. Attempts that failed before an answer are not included.
 */
export interface GeminiUsage {
    promptTokens: number | null;
    outputTokens: number | null;
    thinkingTokens: number | null;
    /** Tokens of search results fed back to the model. */
    toolPromptTokens: number | null;
    /** Google Search queries the model ran for this answer. */
    searchQueryCount: number;
    /** Distinct web sources the answer was grounded on. */
    sourceCount: number;
}

export interface JSONGenerationResult<T> {
    data: T | null;
    failure: JSONFailureReason | null;
    groundingSourceUrls: string[];
    usage: GeminiUsage | null;
    failureKind: GeminiFailureKind | null;
}

export interface JSONGenerationOptions {
    responseJsonSchema: unknown;
    /** Epoch milliseconds after which no attempt may still be running. */
    deadlineAt?: number;
}

class GeminiTimeoutError extends Error {
    constructor(timeoutMs: number) {
        super(`Gemini call timed out after ${timeoutMs}ms`);
        this.name = 'GeminiTimeoutError';
    }
}

class GeminiEmptyResponseError extends Error {
    constructor() {
        super('Gemini returned no candidate text');
        this.name = 'GeminiEmptyResponseError';
    }
}

type RetryResult<T> = { ok: true; value: T } | { ok: false; kind: GeminiFailureKind };

function failed(kind: GeminiFailureKind): { ok: false; kind: GeminiFailureKind } {
    return { ok: false, kind };
}

interface GeminiErrorMetadata {
    status: number | null;
    code: string | number | null;
    message: string;
    retryable: boolean;
}

function isSearchGroundingEnabled(): boolean {
    return process.env.GEMINI_GOOGLE_SEARCH_GROUNDING !== 'false';
}

function getThinkingLevel(): ThinkingLevel | undefined {
    const raw = process.env.GEMINI_THINKING_LEVEL?.trim().toLowerCase();
    if (!raw) {
        return undefined;
    }

    if ((ALLOWED_THINKING_LEVELS as readonly string[]).includes(raw)) {
        return raw as ThinkingLevel;
    }

    console.warn(
        `[Gemini] Ignoring invalid GEMINI_THINKING_LEVEL="${raw}". Expected one of: ${ALLOWED_THINKING_LEVELS.join(', ')}.`
    );
    return undefined;
}

function supportsThinkingConfig(modelName: string): boolean {
    const normalized = modelName.trim().toLowerCase();
    if (!normalized.startsWith('gemini-')) {
        return false;
    }

    const unsupportedModelKinds = [
        'embedding',
        'image',
        'imagen',
        'live',
        'tts',
        'veo',
        'lyria',
    ];

    return !unsupportedModelKinds.some((kind) => normalized.includes(kind));
}

function warnGroundingThresholdDeprecationIfSet(): void {
    const raw = process.env.GEMINI_GROUNDING_DYNAMIC_THRESHOLD;
    if (!raw || hasLoggedGroundingThresholdDeprecation) {
        return;
    }
    hasLoggedGroundingThresholdDeprecation = true;
    console.warn(
        '[Gemini] GEMINI_GROUNDING_DYNAMIC_THRESHOLD is deprecated and ignored when using googleSearch grounding.'
    );
}

function getGroundingTools(): Tool[] | undefined {
    if (!isSearchGroundingEnabled()) {
        return undefined;
    }

    warnGroundingThresholdDeprecationIfSet();

    return [
        {
            googleSearch: {},
        },
    ];
}

function getRetryabilityFromStatus(status: number | null): boolean {
    if (status === null) {
        return true;
    }
    if (status === 429) {
        return true;
    }
    if (status >= 500) {
        return true;
    }
    if (status >= 400) {
        return false;
    }
    return true;
}

function extractGeminiErrorMetadata(error: unknown): GeminiErrorMetadata {
    const errorObject =
        typeof error === 'object' && error !== null
            ? (error as Record<string, unknown>)
            : {};
    const nestedError =
        typeof errorObject.error === 'object' && errorObject.error !== null
            ? (errorObject.error as Record<string, unknown>)
            : null;

    const statusCandidates = [
        errorObject.status,
        errorObject.statusCode,
        nestedError?.status,
        errorObject.code,
        nestedError?.code,
    ];
    const statusCandidate = statusCandidates.find((value) => typeof value === 'number');
    const status =
        typeof statusCandidate === 'number' && statusCandidate >= 100 && statusCandidate <= 599
            ? statusCandidate
            : null;

    const codeCandidates = [errorObject.code, nestedError?.code];
    const codeCandidate = codeCandidates.find(
        (value) => typeof value === 'string' || typeof value === 'number'
    );

    const messageCandidates = [errorObject.message, nestedError?.message];
    const messageCandidate = messageCandidates.find(
        (value) => typeof value === 'string' && value.trim().length > 0
    ) as string | undefined;
    const message =
        messageCandidate ||
        (error instanceof Error ? error.message : 'Unknown Gemini API error');

    return {
        status,
        code: (codeCandidate as string | number | undefined) ?? null,
        message,
        retryable: getRetryabilityFromStatus(status),
    };
}

/**
 * Check if circuit breaker allows requests
 */
function isCircuitClosed(): boolean {
    if (!circuitBreaker.isOpen) {
        return true;
    }

    // Check if enough time has passed to attempt a reset
    const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailure;
    if (timeSinceLastFailure >= CIRCUIT_RESET_TIMEOUT_MS) {
        console.log('[Gemini] Circuit breaker attempting reset after timeout');
        circuitBreaker.isOpen = false;
        circuitBreaker.failures = 0;
        return true;
    }

    return false;
}

/**
 * Record a successful call - resets failure count
 */
function recordSuccess(): void {
    circuitBreaker.failures = 0;
    circuitBreaker.isOpen = false;
}

/**
 * Record a failed call - may trip the circuit
 */
function recordFailure(): void {
    circuitBreaker.failures++;
    circuitBreaker.lastFailure = Date.now();

    if (circuitBreaker.failures >= CIRCUIT_FAILURE_THRESHOLD) {
        console.error(`[Gemini] Circuit breaker OPEN after ${circuitBreaker.failures} consecutive failures`);
        circuitBreaker.isOpen = true;
    }
}

/**
 * Get circuit breaker status (for monitoring/debugging)
 */
export function getCircuitBreakerStatus() {
    return {
        isOpen: circuitBreaker.isOpen,
        failures: circuitBreaker.failures,
        timeSinceLastFailure: circuitBreaker.lastFailure
            ? Date.now() - circuitBreaker.lastFailure
            : null,
    };
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getCallTimeoutMs(): number {
    const parsed = Number.parseInt(process.env.GEMINI_CALL_TIMEOUT_MS || '', 10);
    if (!Number.isFinite(parsed)) {
        return DEFAULT_CALL_TIMEOUT_MS;
    }
    return Math.max(MIN_CALL_TIMEOUT_MS, Math.min(MAX_CALL_TIMEOUT_MS, parsed));
}

/**
 * Run one attempt, giving up after timeoutMs. The signal asks the SDK to drop
 * the request; the race ends the wait even if it does not.
 */
async function withTimeout<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number
): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
            reject(new GeminiTimeoutError(timeoutMs));
            controller.abort();
        }, timeoutMs);
    });

    const attempt = fn(controller.signal);
    // The abandoned attempt may still reject after the timeout has won.
    attempt.catch(() => undefined);

    try {
        return await Promise.race([attempt, timedOut]);
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Retry a function with exponential backoff, a timeout on each attempt and a
 * deadline for all of them together. A timed-out attempt is not retried.
 */
async function withRetry<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    deadlineAt?: number,
    retries: number = MAX_RETRIES
): Promise<RetryResult<T>> {
    // Check circuit breaker first
    if (!isCircuitClosed()) {
        console.warn('[Gemini] Circuit breaker is OPEN, skipping AI call');
        return failed('circuit_open');
    }

    const callTimeoutMs = getCallTimeoutMs();
    const deadline = deadlineAt ?? Date.now() + callTimeoutMs * 2;

    for (let attempt = 0; attempt < retries; attempt++) {
        const remainingMs = deadline - Date.now();
        if (remainingMs < MIN_ATTEMPT_MS) {
            console.warn('[Gemini] Deadline reached, skipping AI call');
            return failed('deadline');
        }

        try {
            const result = await withTimeout(fn, Math.min(callTimeoutMs, remainingMs));
            recordSuccess();
            return { ok: true, value: result };
        } catch (error) {
            if (error instanceof GeminiTimeoutError) {
                console.error(`[Gemini] ${error.message}`);
                recordFailure();
                return failed('timeout');
            }

            const metadata = extractGeminiErrorMetadata(error);
            const kind: GeminiFailureKind = error instanceof GeminiEmptyResponseError
                ? 'empty_response'
                : metadata.status === 429 ? 'rate_limited' : 'api_error';
            const isLastAttempt = attempt === retries - 1;
            if (!metadata.retryable) {
                console.error('[Gemini] Non-retryable API error:', metadata);
                recordFailure();
                return failed(kind);
            }

            if (isLastAttempt) {
                console.error(`[Gemini] All ${retries} attempts failed:`, metadata);
                recordFailure();
                return failed(kind);
            }

            const delay = BASE_DELAY_MS * Math.pow(2, attempt);
            if (deadline - Date.now() - delay < MIN_ATTEMPT_MS) {
                console.error('[Gemini] No time left to retry before the deadline:', metadata);
                recordFailure();
                return failed(kind);
            }

            console.warn(
                `[Gemini] Attempt ${attempt + 1} failed (status=${metadata.status ?? 'unknown'}, code=${metadata.code ?? 'unknown'}, retryable=${metadata.retryable}), retrying in ${delay}ms...`
            );
            await sleep(delay);
        }
    }
    return failed('api_error');
}

/**
 * Get the configured Gemini model instance
 * Returns null if API key is not configured
 */
export function getGeminiModel(
    jsonMode: boolean = false,
    responseJsonSchema?: unknown
) {
    if (!genAI) {
        return null;
    }

    const config: GenerateContentConfig = {};
    if (jsonMode) {
        config.responseMimeType = 'application/json';
        if (responseJsonSchema) {
            config.responseJsonSchema = responseJsonSchema;
        }
    }

    const thinkingLevel = getThinkingLevel();
    if (thinkingLevel && supportsThinkingConfig(MODEL_NAME)) {
        config.thinkingConfig = {
            thinkingLevel,
        };
    } else if (thinkingLevel) {
        console.warn(
            `[Gemini] GEMINI_THINKING_LEVEL is set, but "${MODEL_NAME}" does not appear to support thinkingConfig. Omitting thinkingConfig.`
        );
    }

    const tools = getGroundingTools();
    if (tools) {
        config.tools = tools;
    }

    const requestConfig: GeminiRequestConfig = {
        model: MODEL_NAME,
        config,
    };

    return requestConfig;
}

/**
 * Check if Gemini AI is configured
 */
export function isGeminiConfigured(): boolean {
    return !!apiKey;
}

export function getGeminiModelName(): string {
    return MODEL_NAME;
}

/** The thinking level sent with each call, or 'default' when none is sent. */
export function getGeminiThinkingLevelName(): string {
    const level = getThinkingLevel();
    return level && supportsThinkingConfig(MODEL_NAME) ? String(level) : 'default';
}

/**
 * Generate content using Gemini with retry logic
 * Returns null if not configured or on error after retries
 */
export async function generateContent(prompt: string): Promise<string | null> {
    const requestConfig = getGeminiModel();
    if (!requestConfig || !genAI) {
        console.log('[Gemini] Not configured, skipping AI generation');
        return null;
    }

    const result = await withRetry(async (signal) => {
        const response = await genAI.models.generateContent({
            ...requestConfig,
            config: { ...requestConfig.config, abortSignal: signal },
            contents: prompt,
        });
        return response.text ?? '';
    });
    return result.ok ? result.value : null;
}

/**
 * Generate JSON content using Gemini with structured output and retry logic
 * Uses JSON mode for reliable structured responses
 * Returns null if not configured or on error after retries
 */
export async function generateJSON<T>(
    prompt: string,
    options: JSONGenerationOptions
): Promise<T | null> {
    const result = await generateJSONWithMeta<T>(prompt, options);
    return result.data;
}

/**
 * Generate JSON content with normalized failure metadata
 */
export async function generateJSONWithMeta<T>(
    prompt: string,
    options: JSONGenerationOptions
): Promise<JSONGenerationResult<T>> {
    const requestConfig = getGeminiModel(true, options.responseJsonSchema);
    if (!requestConfig || !genAI) {
        console.log('[Gemini] Not configured, skipping AI generation');
        return {
            data: null,
            failure: 'provider_error',
            groundingSourceUrls: [],
            usage: null,
            failureKind: 'unconfigured',
        };
    }

    const attempt = await withRetry(async (signal) => {
        const response = await genAI.models.generateContent({
            ...requestConfig,
            config: { ...requestConfig.config, abortSignal: signal },
            contents: prompt,
        });
        const text = response.text?.trim();
        if (!response.candidates?.length || !text) {
            throw new GeminiEmptyResponseError();
        }

        const groundingSourceUrls = getGroundingSourceUrls(response);
        return {
            text,
            groundingSourceUrls,
            usage: getUsage(response, groundingSourceUrls.length),
        };
    }, options.deadlineAt);

    if (!attempt.ok) {
        return {
            data: null,
            failure: 'provider_error',
            groundingSourceUrls: [],
            usage: null,
            failureKind: attempt.kind,
        };
    }
    const responseData = attempt.value;

    try {
        // With JSON mode, response should be clean JSON, but still handle edge cases
        let jsonStr = responseData.text.trim();
        // Remove markdown code fences if present (fallback for edge cases)
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
        }
        return {
            data: JSON.parse(jsonStr) as T,
            failure: null,
            groundingSourceUrls: responseData.groundingSourceUrls,
            usage: responseData.usage,
            failureKind: null,
        };
    } catch (error) {
        console.error('[Gemini] Error parsing JSON response:', {
            message: error instanceof Error ? error.message : 'Unknown parse error',
        });
        return {
            data: null,
            failure: 'parse_error',
            groundingSourceUrls: responseData.groundingSourceUrls,
            usage: responseData.usage,
            failureKind: null,
        };
    }
}

function tokenCount(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

function getUsage(response: GenerateContentResponse, sourceCount: number): GeminiUsage {
    const usage = response.usageMetadata;
    const searchQueryCount = (response.candidates || [])
        .reduce((total, candidate) => total + (candidate.groundingMetadata?.webSearchQueries?.length ?? 0), 0);
    return {
        promptTokens: tokenCount(usage?.promptTokenCount),
        outputTokens: tokenCount(usage?.candidatesTokenCount),
        thinkingTokens: tokenCount(usage?.thoughtsTokenCount),
        toolPromptTokens: tokenCount(usage?.toolUsePromptTokenCount),
        searchQueryCount,
        sourceCount,
    };
}

function getGroundingSourceUrls(response: GenerateContentResponse): string[] {
    return Array.from(new Set(
        (response.candidates || [])
            .flatMap((candidate) => candidate.groundingMetadata?.groundingChunks || [])
            .map((chunk) => chunk.web?.uri)
            .filter((uri): uri is string => Boolean(uri))
    ));
}

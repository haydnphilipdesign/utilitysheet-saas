import { GenerateContentConfig, GoogleGenAI, Tool } from '@google/genai';

// Get API key from environment
const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;

// Initialize the Generative AI client (null if not configured)
const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Model configuration
const MODEL_NAME = 'gemini-flash-latest';

// Retry configuration
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

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

export interface JSONGenerationResult<T> {
    data: T | null;
    failure: JSONFailureReason | null;
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

/**
 * Retry a function with exponential backoff
 */
async function withRetry<T>(
    fn: () => Promise<T>,
    retries: number = MAX_RETRIES
): Promise<T | null> {
    // Check circuit breaker first
    if (!isCircuitClosed()) {
        console.warn('[Gemini] Circuit breaker is OPEN, skipping AI call');
        return null;
    }

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const result = await fn();
            recordSuccess();
            return result;
        } catch (error) {
            const metadata = extractGeminiErrorMetadata(error);
            const isLastAttempt = attempt === retries - 1;
            if (!metadata.retryable) {
                console.error('[Gemini] Non-retryable API error:', metadata);
                recordFailure();
                return null;
            }

            if (isLastAttempt) {
                console.error(`[Gemini] All ${retries} attempts failed:`, metadata);
                recordFailure();
                return null;
            }

            const delay = BASE_DELAY_MS * Math.pow(2, attempt);
            console.warn(
                `[Gemini] Attempt ${attempt + 1} failed (status=${metadata.status ?? 'unknown'}, code=${metadata.code ?? 'unknown'}, retryable=${metadata.retryable}), retrying in ${delay}ms...`
            );
            await sleep(delay);
        }
    }
    return null;
}

/**
 * Get the configured Gemini model instance
 * Returns null if API key is not configured
 */
export function getGeminiModel(jsonMode: boolean = false) {
    if (!genAI) {
        return null;
    }

    const config: GenerateContentConfig = {};
    if (jsonMode) {
        config.responseMimeType = 'application/json';
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

    return withRetry(async () => {
        const response = await genAI.models.generateContent({
            ...requestConfig,
            contents: prompt,
        });
        return response.text ?? '';
    });
}

/**
 * Generate JSON content using Gemini with structured output and retry logic
 * Uses JSON mode for reliable structured responses
 * Returns null if not configured or on error after retries
 */
export async function generateJSON<T>(prompt: string): Promise<T | null> {
    const result = await generateJSONWithMeta<T>(prompt);
    return result.data;
}

/**
 * Generate JSON content with normalized failure metadata
 */
export async function generateJSONWithMeta<T>(prompt: string): Promise<JSONGenerationResult<T>> {
    const requestConfig = getGeminiModel(true); // Use JSON mode
    if (!requestConfig || !genAI) {
        console.log('[Gemini] Not configured, skipping AI generation');
        return {
            data: null,
            failure: 'provider_error',
        };
    }

    const raw = await withRetry(async () => {
        const response = await genAI.models.generateContent({
            ...requestConfig,
            contents: prompt,
        });
        return response.text ?? '';
    });

    if (!raw) {
        return {
            data: null,
            failure: 'provider_error',
        };
    }

    try {
        // With JSON mode, response should be clean JSON, but still handle edge cases
        let jsonStr = raw.trim();
        // Remove markdown code fences if present (fallback for edge cases)
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
        }
        return {
            data: JSON.parse(jsonStr) as T,
            failure: null,
        };
    } catch (error) {
        console.error('[Gemini] Error parsing JSON response:', {
            message: error instanceof Error ? error.message : 'Unknown parse error',
        });
        return {
            data: null,
            failure: 'parse_error',
        };
    }
}

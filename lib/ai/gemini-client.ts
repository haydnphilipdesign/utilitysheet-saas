import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai';

// Get API key from environment
const apiKey = process.env.GOOGLE_AI_API_KEY;

// Initialize the Generative AI client (null if not configured)
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Model configuration
const MODEL_NAME = 'gemini-3-flash-preview';

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
            const isLastAttempt = attempt === retries - 1;
            if (isLastAttempt) {
                console.error(`[Gemini] All ${retries} attempts failed:`, error);
                recordFailure();
                return null;
            }
            const delay = BASE_DELAY_MS * Math.pow(2, attempt);
            console.warn(`[Gemini] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
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

    const generationConfig: GenerationConfig = jsonMode
        ? { responseMimeType: 'application/json' }
        : {};

    return genAI.getGenerativeModel({
        model: MODEL_NAME,
        generationConfig
    });
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
    const model = getGeminiModel();
    if (!model) {
        console.log('[Gemini] Not configured, skipping AI generation');
        return null;
    }

    return withRetry(async () => {
        const result = await model.generateContent(prompt);
        const response = result.response;
        return response.text();
    });
}

/**
 * Generate JSON content using Gemini with structured output and retry logic
 * Uses JSON mode for reliable structured responses
 * Returns null if not configured or on error after retries
 */
export async function generateJSON<T>(prompt: string): Promise<T | null> {
    const model = getGeminiModel(true); // Use JSON mode
    if (!model) {
        console.log('[Gemini] Not configured, skipping AI generation');
        return null;
    }

    const result = await withRetry(async () => {
        const response = await model.generateContent(prompt);
        return response.response.text();
    });

    if (!result) {
        return null;
    }

    try {
        // With JSON mode, response should be clean JSON, but still handle edge cases
        let jsonStr = result.trim();
        // Remove markdown code fences if present (fallback for edge cases)
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
        }
        return JSON.parse(jsonStr) as T;
    } catch (error) {
        console.error('[Gemini] Error parsing JSON response:', error);
        console.error('[Gemini] Raw response:', result);
        return null;
    }
}

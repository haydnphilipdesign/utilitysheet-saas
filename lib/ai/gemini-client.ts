import { GoogleGenerativeAI } from '@google/generative-ai';

// Get API key from environment
const apiKey = process.env.GOOGLE_AI_API_KEY;

// Initialize the Generative AI client (null if not configured)
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Model configuration
const MODEL_NAME = 'gemini-3-flash-preview';

/**
 * Get the configured Gemini model instance
 * Returns null if API key is not configured
 */
export function getGeminiModel() {
    if (!genAI) {
        return null;
    }
    return genAI.getGenerativeModel({ model: MODEL_NAME });
}

/**
 * Check if Gemini AI is configured
 */
export function isGeminiConfigured(): boolean {
    return !!apiKey;
}

/**
 * Generate content using Gemini
 * Returns null if not configured or on error
 */
export async function generateContent(prompt: string): Promise<string | null> {
    const model = getGeminiModel();
    if (!model) {
        console.log('[Gemini] Not configured, skipping AI generation');
        return null;
    }

    try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        return response.text();
    } catch (error) {
        console.error('[Gemini] Error generating content:', error);
        return null;
    }
}

/**
 * Generate JSON content using Gemini with structured output
 * Returns null if not configured or on error
 */
export async function generateJSON<T>(prompt: string): Promise<T | null> {
    const text = await generateContent(prompt);
    if (!text) {
        return null;
    }

    try {
        // Extract JSON from the response (handle markdown code blocks)
        let jsonStr = text;
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
        }
        return JSON.parse(jsonStr) as T;
    } catch (error) {
        console.error('[Gemini] Error parsing JSON response:', error);
        console.error('[Gemini] Raw response:', text);
        return null;
    }
}

/**
 * Redis Cache Utility
 * 
 * Provides persistent caching using Upstash Redis with automatic fallback
 * to in-memory cache when Redis is not configured.
 */
import { Redis } from '@upstash/redis';

// Initialize Redis client if configured
let redis: Redis | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
}

// In-memory fallback cache
const memoryCache = new Map<string, { value: unknown; expiresAt: number }>();

/**
 * Check if Redis is configured
 */
export function isRedisConfigured(): boolean {
    return redis !== null;
}

/**
 * Get a value from cache
 */
export async function getFromCache<T>(key: string): Promise<T | null> {
    try {
        if (redis) {
            const value = await redis.get<T>(key);
            return value;
        }

        // Fallback to memory cache
        const cached = memoryCache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.value as T;
        }
        if (cached) {
            memoryCache.delete(key);
        }
        return null;
    } catch (error) {
        console.error('Cache get error:', error);
        return null;
    }
}

/**
 * Set a value in cache with TTL
 * @param key Cache key
 * @param value Value to cache
 * @param ttlSeconds Time to live in seconds
 */
export async function setInCache<T>(key: string, value: T, ttlSeconds: number): Promise<boolean> {
    try {
        if (redis) {
            await redis.set(key, value, { ex: ttlSeconds });
            return true;
        }

        // Fallback to memory cache
        memoryCache.set(key, {
            value,
            expiresAt: Date.now() + ttlSeconds * 1000,
        });
        return true;
    } catch (error) {
        console.error('Cache set error:', error);
        return false;
    }
}

/**
 * Delete a value from cache
 */
export async function deleteFromCache(key: string): Promise<boolean> {
    try {
        if (redis) {
            await redis.del(key);
            return true;
        }

        memoryCache.delete(key);
        return true;
    } catch (error) {
        console.error('Cache delete error:', error);
        return false;
    }
}

/**
 * Clear memory cache (for testing/debugging)
 */
export function clearMemoryCache(): void {
    memoryCache.clear();
}

/**
 * Get cache stats
 */
export function getCacheStats() {
    return {
        type: redis ? 'redis' : 'memory',
        memoryCacheSize: memoryCache.size,
    };
}

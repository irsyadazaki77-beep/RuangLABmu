import { GoogleGenAI } from '@google/genai';
import { logger } from '../utils/logger';

export const DR_LABMU_MODEL = 'gemini-4-hydrogen' as const;

let cachedClient: GoogleGenAI | null = null;
let cachedKey: string | null = null;

export interface AiRuntimeMetrics {
  requestsTotal: number;
  errorsTotal: number;
  streamsTotal: number;
  avgLatencyMs: number;
}

let aiRequestsTotal = 0;
let aiErrorsTotal = 0;
let aiStreamsTotal = 0;
let aiTotalLatencyMs = 0;

export function getAiRuntimeMetrics(): AiRuntimeMetrics {
  return {
    requestsTotal: aiRequestsTotal,
    errorsTotal: aiErrorsTotal,
    streamsTotal: aiStreamsTotal,
    avgLatencyMs:
      aiRequestsTotal > 0 ? Math.round(aiTotalLatencyMs / aiRequestsTotal) : 0,
  };
}

export function recordAiRequestMetrics(
  latencyMs: number,
  ok: boolean,
  isStream = false
): void {
  aiRequestsTotal += 1;
  aiTotalLatencyMs += Math.max(0, latencyMs);
  if (isStream) aiStreamsTotal += 1;
  if (!ok) aiErrorsTotal += 1;
}

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY');
}

/**
 * Shared singleton @google/genai client configured with the required telemetry User-Agent header.
 */
export function getSharedGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    cachedKey = apiKey;
  }
  return cachedClient;
}

function isTransientAiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /\b(429|500|502|503|504|ECONNRESET|ETIMEDOUT|RESOURCE_EXHAUSTED|UNAVAILABLE)\b/i.test(
    msg
  );
}

export async function runWithAiRetryAndTimeout<T>(
  operationName: string,
  fn: () => Promise<T>,
  options?: {
    timeoutMs?: number;
    maxRetries?: number;
    baseDelayMs?: number;
  }
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 20_000;
  const maxRetries = options?.maxRetries ?? 2;
  const baseDelayMs = options?.baseDelayMs ?? 350;
  const startedAt = Date.now();

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const result = await Promise.race<T>([
        fn(),
        new Promise<never>((_resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error(`Gemini request timeout after ${timeoutMs}ms (${operationName})`));
          }, timeoutMs);
          timer.unref?.();
        }),
      ]);
      recordAiRequestMetrics(Date.now() - startedAt, true);
      return result;
    } catch (err) {
      lastError = err;
      const shouldRetry = attempt < maxRetries && isTransientAiError(err);
      logger.warn('Gemini API invocation failed', {
        operation: operationName,
        attempt: attempt + 1,
        willRetry: shouldRetry,
        error: err instanceof Error ? err.message : String(err),
      });
      if (!shouldRetry) {
        recordAiRequestMetrics(Date.now() - startedAt, false);
        throw err;
      }
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  recordAiRequestMetrics(Date.now() - startedAt, false);
  throw lastError;
}

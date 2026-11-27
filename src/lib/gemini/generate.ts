import "server-only";
import type { GenerateContentParameters } from "@google/genai";
import { ai, GEMINI_MODEL } from "./client";

const RETRYABLE_STATUS = new Set([429, 500, 503, 504]);
const NETWORK_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ENOTFOUND",
  "UND_ERR_CONNECT_TIMEOUT",
]);

// One quick retry per model for short overloads
const ATTEMPTS_PER_MODEL = 2;
// A single attempt that takes longer than this is abandoned
const ATTEMPT_TIMEOUT_MS = 12_000;
// The customer never waits longer than this in total
const TOTAL_BUDGET_MS = 25_000;

// Optional: "minimal", "low", "medium" or "high". Empty = model default.
// Supported levels differ per model, so an unsupported value is retried without it.
const THINKING_LEVEL = (process.env.GEMINI_THINKING_LEVEL ?? "").trim();

// Comma-separated list, tried in order after the main model
const FALLBACKS = (process.env.GEMINI_FALLBACK_MODELS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function statusOf(err: unknown): number | undefined {
  if (typeof err === "object" && err !== null && "status" in err) {
    return Number((err as { status: unknown }).status);
  }
  return undefined;
}

function isDailyQuota(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return statusOf(err) === 429 && /per[ _-]?day/i.test(message);
}

function isTimeout(err: unknown): boolean {
  const e = err as { name?: string };
  return e?.name === "TimeoutError" || e?.name === "AbortError";
}

function isNetworkError(err: unknown): boolean {
  const e = err as { message?: string; cause?: { code?: string } };
  return (
    isTimeout(err) ||
    e?.message === "fetch failed" ||
    NETWORK_CODES.has(e?.cause?.code ?? "")
  );
}

export class GeminiBusyError extends Error {}

export async function generateWithRetry(
  params: Omit<GenerateContentParameters, "model">
) {
  const models = [...new Set([GEMINI_MODEL, ...FALLBACKS])];
  const startedAt = Date.now();
  const remaining = () => TOTAL_BUDGET_MS - (Date.now() - startedAt);
  let useThinking = THINKING_LEVEL !== "";
  let lastErr: unknown;

  for (const model of models) {
    for (let attempt = 0; attempt < ATTEMPTS_PER_MODEL; attempt++) {
      if (remaining() <= 1_000) {
        console.error("Gemini time budget used up. Last error:", lastErr);
        throw new GeminiBusyError("Gemini is busy");
      }

      const attemptStart = Date.now();
      try {
        const result = await ai.models.generateContent({
          ...params,
          model,
          config: {
            ...params.config,
            abortSignal: AbortSignal.timeout(
              Math.min(ATTEMPT_TIMEOUT_MS, remaining())
            ),
            ...(useThinking
              ? { thinkingConfig: { thinkingLevel: THINKING_LEVEL } as never }
              : {}),
          },
        });
        console.log(`[gemini] ${model} ok in ${Date.now() - attemptStart}ms`);
        return result;
      } catch (err) {
        lastErr = err;
        const status = statusOf(err);
        console.warn(
          `[gemini] ${model} attempt ${attempt + 1} failed after ${Date.now() - attemptStart}ms (${status ?? (err as Error)?.name ?? "error"})`
        );

        // The thinking level may be unsupported by this model: retry without it
        if (useThinking && status === 400) {
          useThinking = false;
          attempt--;
          continue;
        }

        // Daily quota used up, or model not available: next model now
        if (isDailyQuota(err) || status === 404) break;
        // Too slow: do not wait on this model again
        if (isTimeout(err)) break;

        const retryable =
          (status !== undefined && RETRYABLE_STATUS.has(status)) ||
          isNetworkError(err);
        if (!retryable) throw err;
        await sleep(500);
      }
    }
  }

  console.error("Gemini unavailable after trying all models:", lastErr);
  throw new GeminiBusyError("Gemini is busy");
}
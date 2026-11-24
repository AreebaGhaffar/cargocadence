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
const ATTEMPTS_PER_MODEL = 2;

// Comma-separated list, tried in order after the main model
const FALLBACKS = (
  process.env.GEMINI_FALLBACK_MODELS ?? process.env.GEMINI_FALLBACK_MODEL ?? ""
)
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

function isNetworkError(err: unknown): boolean {
  const e = err as { name?: string; message?: string; cause?: { code?: string } };
  return (
    e?.name === "TimeoutError" ||
    e?.name === "AbortError" ||
    e?.message === "fetch failed" ||
    NETWORK_CODES.has(e?.cause?.code ?? "")
  );
}

export class GeminiBusyError extends Error {}

export async function generateWithRetry(
  params: Omit<GenerateContentParameters, "model">
) {
  const models = [...new Set([GEMINI_MODEL, ...FALLBACKS])];
  let lastErr: unknown;

  for (const model of models) {
    for (let attempt = 0; attempt < ATTEMPTS_PER_MODEL; attempt++) {
      try {
        return await ai.models.generateContent({ ...params, model });
      } catch (err) {
        lastErr = err;
        // Daily quota used up, or model not available: go to the next model now
        if (isDailyQuota(err) || statusOf(err) === 404) break;

        const status = statusOf(err);
        const retryable =
          (status !== undefined && RETRYABLE_STATUS.has(status)) ||
          isNetworkError(err);
        if (!retryable) throw err;
        await sleep(1000 * 2 ** attempt);
      }
    }
  }

  console.error("Gemini unavailable after trying all models:", lastErr);
  throw new GeminiBusyError("Gemini is busy");
}
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
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL;
const ATTEMPTS_PER_MODEL = 2;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function statusOf(err: unknown): number | undefined {
  if (typeof err === "object" && err !== null && "status" in err) {
    return Number((err as { status: unknown }).status);
  }
  return undefined;
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
  const models = [GEMINI_MODEL, ...(FALLBACK_MODEL ? [FALLBACK_MODEL] : [])];
  let lastErr: unknown;

  for (const model of models) {
    for (let attempt = 0; attempt < ATTEMPTS_PER_MODEL; attempt++) {
      try {
        return await ai.models.generateContent({ ...params, model });
      } catch (err) {
        lastErr = err;
        const status = statusOf(err);
        const retryable =
          (status !== undefined && RETRYABLE_STATUS.has(status)) ||
          isNetworkError(err);
        if (!retryable) throw err;
        await sleep(1000 * 2 ** attempt);
      }
    }
  }

  console.error("Gemini unavailable after retries:", lastErr);
  throw new GeminiBusyError("Gemini is busy");
}
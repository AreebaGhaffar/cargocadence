import "server-only";
import type { GenerateContentParameters } from "@google/genai";
import { ai, GEMINI_MODEL } from "./client";

const RETRYABLE = new Set([429, 500, 503, 504]);
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function statusOf(err: unknown): number | undefined {
  if (typeof err === "object" && err !== null && "status" in err) {
    return Number((err as { status: unknown }).status);
  }
  return undefined;
}

export class GeminiBusyError extends Error {}

export async function generateWithRetry(
  params: Omit<GenerateContentParameters, "model">
) {
  const models = [GEMINI_MODEL, ...(FALLBACK_MODEL ? [FALLBACK_MODEL] : [])];
  let lastErr: unknown;

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await ai.models.generateContent({ ...params, model });
      } catch (err) {
        lastErr = err;
        const status = statusOf(err);
        // Only retry temporary problems; fail fast on 400/401/404 etc.
        if (!status || !RETRYABLE.has(status)) throw err;
        await sleep(1000 * 2 ** attempt);
      }
    }
  }

  console.error("Gemini still busy after retries:", lastErr);
  throw new GeminiBusyError("Gemini is busy");
}
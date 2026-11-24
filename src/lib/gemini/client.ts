import "server-only";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set");
}

// Give up on any single request after 20 seconds instead of hanging
export const ai = new GoogleGenAI({
  apiKey,
  httpOptions: { timeout: 20_000 },
});
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.7-flash";
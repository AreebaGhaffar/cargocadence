import { NextResponse, type NextRequest } from "next/server";
import { generateWithRetry, GeminiBusyError } from "@/lib/gemini/generate";
import { createClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rate-limit";

import {
  chatRequestSchema,
  geminiResponseSchema,
  modelOutputSchema,
} from "@/lib/ai/booking-schema";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";

// Per-user limits that protect the Gemini quota
const MINUTE_LIMIT = 1;
const DAY_LIMIT = 200;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Rate limit before doing any expensive work
  const limited = await isRateLimited(user.id, [
    { bucket: "chat-minute", limit: MINUTE_LIMIT, windowSeconds: 60 },
    { bucket: "chat-day", limit: DAY_LIMIT, windowSeconds: 86_400 },
  ]);
  if (limited) {
    return NextResponse.json(
      { error: "You are sending messages too quickly. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const { data: trucks, error: trucksError } = await supabase
    .from("truck_types")
    .select("name, max_weight_lbs")
    .eq("active", true)
    .order("name");
  if (trucksError || !trucks?.length) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);

  try {
    const response = await generateWithRetry({
      contents: parsed.data.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      config: {
        systemInstruction: buildSystemPrompt(trucks, today),
        responseMimeType: "application/json",
        responseSchema: geminiResponseSchema,
      },
    });

    const output = modelOutputSchema.safeParse(JSON.parse(response.text ?? ""));
    if (!output.success) {
      console.error("Gemini output failed validation:", output.error.issues);
      return NextResponse.json({ error: "The assistant had a problem. Please try again." }, { status: 502 });
    }

    const { reply, details, customDeal } = output.data;

    // Never trust the model: the truck must be a real, active one
    if (details.truckType && !trucks.some((t) => t.name === details.truckType)) {
      details.truckType = null;
    }

    // The server (not the model) decides when details are complete
    const complete =
      !!details.pickupLocation &&
      !!details.dropoffLocation &&
      !!details.cargoDescription &&
      details.cargoWeightLbs !== null &&
      !!details.pickupDate &&
      details.pickupDate >= yesterday &&
      !!details.pickupTime &&
      !!details.pickupTimezone &&
      !!details.truckType;

    return NextResponse.json({ reply, details, customDeal, complete });
  } catch (err) {
    if (err instanceof GeminiBusyError) {
      return NextResponse.json(
        { error: "The assistant is busy right now. Please try again in a moment." },
        { status: 503 }
      );
    }
    console.error("Chat request failed:", err);
    return NextResponse.json({ error: "The assistant had a problem. Please try again." }, { status: 502 });
  }
}
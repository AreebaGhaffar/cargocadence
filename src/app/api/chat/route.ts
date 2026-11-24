import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ai, GEMINI_MODEL } from "@/lib/gemini/client";
import {
  chatRequestSchema,
  geminiResponseSchema,
  modelOutputSchema,
} from "@/lib/ai/booking-schema";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";

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
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
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
    console.error("Chat request failed:", err);
    return NextResponse.json({ error: "The assistant had a problem. Please try again." }, { status: 502 });
  }
}
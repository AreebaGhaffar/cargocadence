import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateWithRetry } from "@/lib/gemini/generate";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const response = await generateWithRetry({
      contents: "Reply with exactly: CargoCadence AI is online",
    });
    return NextResponse.json({ text: response.text });
  } catch (err) {
    console.error("Gemini test failed:", err);
    return NextResponse.json({ error: "Gemini request failed" }, { status: 502 });
  }
}
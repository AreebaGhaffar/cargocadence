import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { confirmedDetailsSchema } from "@/lib/booking/schema";
import { buildQuote } from "@/lib/booking/quote";

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
  const parsed = confirmedDetailsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid booking details" }, { status: 400 });
  }

  const result = await buildQuote(supabase, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { quote } = result;
  return NextResponse.json({
    truckName: quote.truckName,
    miles: quote.miles,
    lines: quote.estimate.lines,
    total: quote.estimate.total,
    pickupAt: quote.pickupAt.toISOString(),
    isCustomDeal: quote.isCustomDeal,
    customDealNotes: quote.customDealNotes,
  });
}
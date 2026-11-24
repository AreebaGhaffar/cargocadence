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
  const d = parsed.data;

  // Price is recalculated here. Nothing price-related is read from the request.
  const result = await buildQuote(supabase, d);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const { quote } = result;

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      user_id: user.id,
      status: quote.isCustomDeal ? "pending_approval" : "quoted",
      pickup_location: d.pickupLocation,
      dropoff_location: d.dropoffLocation,
      cargo_description: d.cargoDescription,
      cargo_weight_lbs: d.cargoWeightLbs,
      pickup_at: quote.pickupAt.toISOString(),
      pickup_timezone: d.pickupTimezone,
      truck_type_id: quote.truckId,
      distance_miles: quote.miles,
      estimate_breakdown: quote.estimate,
      estimated_total: quote.estimate.total,
      is_custom_deal: quote.isCustomDeal,
      custom_deal_notes: quote.customDealNotes,
    })
    .select("id, status, estimated_total")
    .single();

  if (error || !booking) {
    console.error("Booking insert failed:", error);
    return NextResponse.json({ error: "Could not save the booking" }, { status: 500 });
  }

  return NextResponse.json({ booking }, { status: 201 });
}
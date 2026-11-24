import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRoadMiles } from "@/lib/geo/distance";
import { calculateEstimate, type Estimate } from "@/lib/pricing/estimate";
import { isWeekend, zonedToUtc } from "./time";
import type { ConfirmedDetails } from "./schema";

export type Quote = {
  truckId: string;
  truckName: string;
  miles: number;
  estimate: Estimate;
  pickupAt: Date;
  isCustomDeal: boolean;
  customDealNotes: string | null;
};

export type QuoteResult =
  | { ok: true; quote: Quote }
  | { ok: false; status: number; error: string };

export async function buildQuote(
  supabase: SupabaseClient,
  d: ConfirmedDetails
): Promise<QuoteResult> {
  const { data: truck } = await supabase
    .from("truck_types")
    .select("id, name, base_fee, rate_per_mile, max_weight_lbs")
    .eq("name", d.truckType)
    .eq("active", true)
    .maybeSingle();
  if (!truck) {
    return { ok: false, status: 400, error: "That truck type is not available" };
  }

  const pickupAt = zonedToUtc(d.pickupDate, d.pickupTime, d.pickupTimezone);
  if (Number.isNaN(pickupAt.getTime()) || pickupAt.getTime() <= Date.now()) {
    return { ok: false, status: 400, error: "Pickup time must be in the future" };
  }

  const { data: rules, error: rulesError } = await supabase
    .from("surcharges")
    .select("name, kind, amount, applies_when")
    .eq("active", true)
    .in("applies_when", ["always", "weekend"]);
  if (rulesError) {
    return { ok: false, status: 503, error: "Pricing is unavailable right now" };
  }
  const weekend = isWeekend(d.pickupDate);
  const surcharges = (rules ?? []).filter(
    (s) => s.applies_when === "always" || (s.applies_when === "weekend" && weekend)
  );

  let miles: number;
  try {
    ({ miles } = await getRoadMiles(d.pickupLocation, d.dropoffLocation));
  } catch (err) {
    console.error("Route lookup failed:", err);
    return {
      ok: false,
      status: 422,
      error: "We could not calculate a route between those locations. Please check the addresses.",
    };
  }

  const overweight =
    truck.max_weight_lbs !== null && d.cargoWeightLbs > truck.max_weight_lbs;
  const notes =
    [
      d.customDeal.requested ? d.customDeal.notes : null,
      overweight
        ? `Cargo weight ${d.cargoWeightLbs} lbs exceeds the ${truck.name} limit of ${truck.max_weight_lbs} lbs`
        : null,
    ]
      .filter(Boolean)
      .join(" | ") || null;

  return {
    ok: true,
    quote: {
      truckId: truck.id,
      truckName: truck.name,
      miles,
      estimate: calculateEstimate({ truck, miles, surcharges }),
      pickupAt,
      isCustomDeal: d.customDeal.requested || overweight,
      customDealNotes: notes,
    },
  };
}
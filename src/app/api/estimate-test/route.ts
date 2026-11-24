import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRoadMiles } from "@/lib/geo/distance";
import { calculateEstimate } from "@/lib/pricing/estimate";

const querySchema = z.object({
  from: z.string().trim().min(3).max(200),
  to: z.string().trim().min(3).max(200),
  truck: z.string().trim().min(1).max(60),
  surcharges: z.string().trim().max(300).optional(),
});

export async function GET(request: NextRequest) {
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

  const params = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!params.success) {
    return NextResponse.json({ error: params.error.issues[0].message }, { status: 400 });
  }
  const { from, to, truck: truckName, surcharges: surchargeParam } = params.data;

  const { data: truck } = await supabase
    .from("truck_types")
    .select("name, base_fee, rate_per_mile")
    .eq("name", truckName)
    .eq("active", true)
    .maybeSingle();
  if (!truck) {
    return NextResponse.json({ error: "Truck type not found" }, { status: 404 });
  }

  const surchargeNames = (surchargeParam ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let surcharges: { name: string; kind: "flat" | "percent"; amount: number }[] = [];
  if (surchargeNames.length > 0) {
    const { data } = await supabase
      .from("surcharges")
      .select("name, kind, amount")
      .in("name", surchargeNames)
      .eq("active", true);
    surcharges = data ?? [];
  }

  try {
    const { miles } = await getRoadMiles(from, to);
    return NextResponse.json({
      miles,
      ...calculateEstimate({ truck, miles, surcharges }),
    });
  } catch (err) {
    console.error("Estimate test failed:", err);
    return NextResponse.json({ error: "Estimate failed" }, { status: 502 });
  }
}
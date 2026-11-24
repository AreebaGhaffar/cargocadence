import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { TruckTypeForm } from "./truck-type-form";
import { SurchargeForm } from "./surcharge-form";

async function TruckTypes() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: trucks, error } = await supabase
    .from("truck_types")
    .select("id, name, base_fee, rate_per_mile, max_weight_lbs, active")
    .order("name");

  if (error) return <p className="text-red-400">Could not load truck types.</p>;

  return (
    <div className="flex flex-col gap-4">
      {trucks.map((t) => (
        <TruckTypeForm key={t.id} truck={t} />
      ))}
      <h3 className="mt-2 text-lg font-semibold">Add a new truck type</h3>
      <TruckTypeForm />
    </div>
  );
}

async function Surcharges() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: surcharges, error } = await supabase
    .from("surcharges")
    .select("id, name, kind, amount, active, applies_when")
    .order("name");

  if (error) return <p className="text-red-400">Could not load surcharges.</p>;

  return (
    <div className="flex flex-col gap-4">
      {surcharges.map((s) => (
        <SurchargeForm key={s.id} surcharge={s} />
      ))}
      <h3 className="mt-2 text-lg font-semibold">Add a new surcharge</h3>
      <SurchargeForm />
    </div>
  );
}

export default function RatesPage() {
  return (
    <main className="flex flex-col gap-4">
      <Link href="/admin" className="text-sm text-blue-500 hover:underline">
        ← Back to admin
      </Link>
      <h1 className="text-2xl font-bold">Rates &amp; surcharges</h1>

      <h2 className="mt-4 text-xl font-semibold">Truck types</h2>
      <Suspense fallback={<p>Loading...</p>}>
        <TruckTypes />
      </Suspense>

      <h2 className="mt-8 text-xl font-semibold">Surcharges</h2>
      <Suspense fallback={<p>Loading...</p>}>
        <Surcharges />
      </Suspense>
    </main>
  );
}
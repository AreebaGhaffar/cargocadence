import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { TruckTypeForm } from "./truck-type-form";

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
      <h2 className="mt-6 text-lg font-semibold">Add a new truck type</h2>
      <TruckTypeForm />
    </div>
  );
}

export default function RatesPage() {
  return (
    <main className="flex flex-col gap-4">
      <Link href="/admin" className="text-sm text-blue-500 hover:underline">
        ← Back to admin
      </Link>
      <h1 className="text-2xl font-bold">Truck rates</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <TruckTypes />
      </Suspense>
    </main>
  );
}
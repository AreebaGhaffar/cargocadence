import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { BookingActions } from "./booking-actions";

const money = (n: number | null) =>
  n === null
    ? "n/a"
    : n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const STATUS_STYLE: Record<string, string> = {
  quoted: "bg-blue-100 text-blue-800",
  pending_approval: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-800",
  paid: "bg-emerald-100 text-emerald-800",
  completed: "bg-gray-100 text-gray-700	",
  cancelled: "bg-red-100 text-red-800",
};

function truckName(t: unknown): string {
  const row = Array.isArray(t) ? t[0] : t;
  return (row as { name?: string } | null)?.name ?? "n/a";
}

async function BookingList() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(
      "id, user_id, status, pickup_location, dropoff_location, cargo_description, cargo_weight_lbs, pickup_at, pickup_timezone, distance_miles, estimate_breakdown, estimated_total, is_custom_deal, custom_deal_notes, final_total, admin_notes, created_at, truck_types(name)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return <p className="text-red-600">Could not load bookings.</p>;
  if (!bookings.length) return <p className="text-gray-600">No bookings yet.</p>;

  const userIds = [...new Set(bookings.map((b) => b.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  // Awaiting approval first, then newest first
  const sorted = [...bookings].sort(
    (a, b) =>
      Number(b.status === "pending_approval") -
      Number(a.status === "pending_approval")
  );

  return (
    <div className="flex flex-col gap-4">
      {sorted.map((b) => (
        <article
          key={b.id}
          className="rounded-xl border border-gray-200 bg-white p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-gray-900">
              {b.pickup_location} → {b.dropoff_location}
            </p>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[b.status] ?? ""}`}
            >
              {b.status.replace("_", " ")}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            {names.get(b.user_id) ?? "Customer"} · ref{" "}
            {b.id.slice(0, 8).toUpperCase()} · {truckName(b.truck_types)} ·{" "}
            {b.distance_miles} mi
          </p>
          <p className="mt-2 text-sm text-gray-800">
            {b.cargo_description}
            {b.cargo_weight_lbs ? ` (${b.cargo_weight_lbs} lbs)` : ""}
          </p>
          <p className="mt-1 text-sm text-gray-700">
            Pickup:{" "}
            {new Date(b.pickup_at).toLocaleString("en-US", {
              timeZone: b.pickup_timezone ?? "UTC",
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZoneName: "short",
            })}
          </p>
          <p className="mt-1 text-sm text-gray-700">
            Estimate {money(b.estimated_total)}
            {b.final_total !== null ? ` · Final ${money(b.final_total)}` : ""}
          </p>
          {b.custom_deal_notes && (
            <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
              Custom deal: {b.custom_deal_notes}
            </p>
          )}
          {b.admin_notes && (
            <p className="mt-2 text-sm text-gray-600">Admin note: {b.admin_notes}</p>
          )}
          {b.estimate_breakdown?.lines && (
            <details className="mt-2 text-sm text-gray-600">
              <summary className="cursor-pointer">Price breakdown</summary>
              <ul className="mt-1">
                {b.estimate_breakdown.lines.map(
                  (l: { label: string; amount: number }) => (
                    <li key={l.label} className="flex justify-between">
                      <span>{l.label}</span>
                      <span>{money(l.amount)}</span>
                    </li>
                  )
                )}
              </ul>
            </details>
          )}
          <BookingActions
            id={b.id}
            status={b.status}
            estimatedTotal={b.estimated_total}
          />
        </article>
      ))}
    </div>
  );
}

export default function AdminBookingsPage() {
  return (
    <main className="flex flex-col gap-4">
      <Link href="/admin" className="text-sm text-blue-500 hover:underline">
        ← Back to admin
      </Link>
      <h1 className="text-2xl font-bold">Bookings</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <BookingList />
      </Suspense>
    </main>
  );
}
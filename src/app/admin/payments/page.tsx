import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";

type BookingInfo = {
  pickup_location: string;
  dropoff_location: string;
  status: string;
};

type PaymentRow = {
  id: string;
  booking_id: string;
  user_id: string;
  amount: number | string;
  currency: string;
  status: string;
  payment_intent: string | null;
  checkout_session_id: string;
  created_at: string;
  bookings: BookingInfo | BookingInfo[] | null;
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-US", DATE_FORMAT).format(date);
}

function formatMoney(value: number | string, currency = "usd"): string {
  const n = Number(value);
  if (Number.isNaN(n)) return "-";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function firstBooking(b: PaymentRow["bookings"]): BookingInfo | null {
  if (!b) return null;
  return Array.isArray(b) ? (b[0] ?? null) : b;
}

async function PaymentsLedger() {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, booking_id, user_id, amount, currency, status, payment_intent, checkout_session_id, created_at, bookings(pickup_location, dropoff_location, status)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return <p className="text-red-400">Could not load payments: {error.message}</p>;
  }

  const payments = (data ?? []) as unknown as PaymentRow[];

  // Customer names (best effort: fall back to a short user id)
  const userIds = Array.from(new Set(payments.map((p) => p.user_id)));
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      if (p.full_name) names.set(p.id as string, p.full_name as string);
    }
  }

  // Total collected, summed in whole cents
  const totalCents = payments
    .filter((p) => p.status === "succeeded")
    .reduce((sum, p) => sum + Math.round(Number(p.amount) * 100), 0);

  return (
    <>
      <div className="flex flex-wrap gap-6 rounded-lg border border-gray-700 p-4">
        <div>
          <p className="text-sm text-gray-400">Total collected</p>
          <p className="text-2xl font-bold">{formatMoney(totalCents / 100)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Payments</p>
          <p className="text-2xl font-bold">{payments.length}</p>
        </div>
      </div>

      {payments.length === 0 ? (
        <p className="text-gray-400">No payments recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-700 text-gray-400">
              <tr>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Customer</th>
                <th className="py-2 pr-4">Route</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Payment</th>
                <th className="py-2 pr-4">Booking</th>
                <th className="py-2">Stripe payment_intent</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const booking = firstBooking(p.bookings);
                return (
                  <tr key={p.id} className="border-b border-gray-800 align-top">
                    <td className="py-2 pr-4 whitespace-nowrap">{formatDate(p.created_at)}</td>
                    <td className="py-2 pr-4">
                      {names.get(p.user_id) ?? `${p.user_id.slice(0, 8)}…`}
                    </td>
                    <td className="py-2 pr-4">
                      {booking
                        ? `${booking.pickup_location} → ${booking.dropoff_location}`
                        : "-"}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap font-medium">
                      {formatMoney(p.amount, p.currency)}
                    </td>
                    <td className="py-2 pr-4">{p.status}</td>
                    <td className="py-2 pr-4">{booking?.status ?? "-"}</td>
                    <td className="py-2 font-mono text-xs break-all">
                      {p.payment_intent ?? "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function AdminPaymentsPage() {
  return (
    <main className="flex flex-col gap-4">
      <Link href="/admin" className="w-fit text-sm text-blue-400 hover:underline">
        ← Admin home
      </Link>
      <h1 className="text-2xl font-bold">Payments ledger</h1>
      <Suspense fallback={<p>Loading payments...</p>}>
        <PaymentsLedger />
      </Suspense>
    </main>
  );
}
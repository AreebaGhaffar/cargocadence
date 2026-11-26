import { createClient } from "@/lib/supabase/server";
import PayButton from "./pay-button";

type BookingRow = {
  id: string;
  status: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_at: string;
  pickup_timezone: string | null;
  estimated_total: number | string | null;
  final_total: number | string | null;
  is_custom_deal: boolean;
  admin_notes: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  quoted: { label: "Quoted", className: "bg-gray-100 text-gray-800" },
  pending_approval: { label: "Awaiting approval", className: "" },
  confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-800" },
  paid: { label: "Paid", className: "bg-green-100 text-green-800" },
  completed: { label: "Completed", className: "bg-green-200 text-green-900" },
  cancelled: { label: "Cancelled", className: "bg-red-200 text-red-900" },
};

// Note: dateStyle/timeStyle cannot be combined with timeZoneName,
// so we use explicit date and time parts instead.
const PICKUP_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
};

function formatPickup(iso: string, timeZone: string | null): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  try {
    return new Intl.DateTimeFormat("en-US", {
      ...PICKUP_FORMAT,
      timeZone: timeZone || "UTC",
    }).format(date);
  } catch {
    // Invalid timezone name: fall back to UTC instead of crashing the page
    return new Intl.DateTimeFormat("en-US", {
      ...PICKUP_FORMAT,
      timeZone: "UTC",
    }).format(date);
  }
}

function formatMoney(value: number | string | null): string | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function isPayable(b: BookingRow): boolean {
  const hasTotal = b.final_total !== null || b.estimated_total !== null;
  return (
    hasTotal &&
    ((b.status === "quoted" && !b.is_custom_deal) || b.status === "confirmed")
  );
}

export default async function MyBookings() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, status, pickup_location, dropoff_location, pickup_at, pickup_timezone, estimated_total, final_total, is_custom_deal, admin_notes, created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return <p className="text-red-600">Could not load your bookings. Please refresh.</p>;
  }

  const bookings = (data ?? []) as BookingRow[];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">My bookings</h2>

      {bookings.length === 0 ? (
        <p className="text-gray-600">You have no bookings yet. Use “Book a truck” to get started.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {bookings.map((b) => {
            const status = STATUS_LABELS[b.status] ?? {
              label: b.status,
              className: "bg-gray-100 text-gray-800",
            };
            const finalTotal = formatMoney(b.final_total);
            const estimate = formatMoney(b.estimated_total);

            return (
              <li key={b.id} className="rounded-lg border border-gray-300 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {b.pickup_location} → {b.dropoff_location}
                  </span>
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                <p className="mt-1 text-sm text-gray-600">
                  Pickup: {formatPickup(b.pickup_at, b.pickup_timezone)}
                </p>

                <p className="mt-1 text-sm">
                  {finalTotal ? (
                    <>Final total: <strong>{finalTotal}</strong></>
                  ) : b.is_custom_deal ? (
                    <>Custom deal: price will be set by our team</>
                  ) : estimate ? (
                    <>Estimated total: <strong>{estimate}</strong></>
                  ) : null}
                </p>

                {b.admin_notes ? (
                  <p className="mt-2 rounded bg-gray-100 p-2 text-sm text-gray-700">
                    Note from admin: {b.admin_notes}
                  </p>
                ) : null}

                {isPayable(b) ? <PayButton bookingId={b.id} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
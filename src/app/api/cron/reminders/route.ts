import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isEmailConfigured,
  sendReminderEmail,
  type ReminderBooking,
} from "@/lib/email/send-reminder";

export const runtime = "nodejs";

const COLUMNS =
  "id, pickup_location, dropoff_location, pickup_at, pickup_timezone, cargo_description, cargo_weight_lbs, status, final_total, estimated_total";

function isAuthorized(request: Request, secret: string): boolean {
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function windowHours(): number {
  const n = Number(process.env.REMINDER_WINDOW_HOURS);
  if (!Number.isFinite(n) || n <= 0) return 24;
  return Math.min(n, 720);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isEmailConfigured()) {
    console.error("RESEND_API_KEY or ADMIN_NOTIFY_EMAIL is not set");
    return NextResponse.json({ error: "Email not configured" }, { status: 500 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const until = new Date(now.getTime() + windowHours() * 60 * 60 * 1000);

  // 1) Find bookings that need a reminder
  const { data: due, error: dueError } = await supabase
    .from("bookings")
    .select("id")
    .in("status", ["confirmed", "paid"])
    .is("reminder_sent_at", null)
    .gte("pickup_at", now.toISOString())
    .lte("pickup_at", until.toISOString());

  if (dueError) {
    console.error("Reminder lookup failed:", dueError.message);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
  if (!due || due.length === 0) {
    return NextResponse.json({ checked: 0, reminded: 0 });
  }

  // 2) Claim them first so overlapping runs cannot double-send
  const ids = due.map((row) => row.id as string);
  const { data: claimed, error: claimError } = await supabase
    .from("bookings")
    .update({ reminder_sent_at: now.toISOString() })
    .in("id", ids)
    .is("reminder_sent_at", null)
    .select(COLUMNS);

  if (claimError) {
    console.error("Reminder claim failed:", claimError.message);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ checked: ids.length, reminded: 0 });
  }

  const bookings = (claimed as unknown as ReminderBooking[]).sort(
    (a, b) => new Date(a.pickup_at).getTime() - new Date(b.pickup_at).getTime()
  );

  // 3) Send one email. If it fails, un-claim so the next run retries.
  try {
    await sendReminderEmail(bookings);
  } catch (err) {
    console.error("Reminder email failed:", err);
    await supabase
      .from("bookings")
      .update({ reminder_sent_at: null })
      .in(
        "id",
        bookings.map((b) => b.id)
      );
    return NextResponse.json({ error: "Email failed" }, { status: 502 });
  }

  return NextResponse.json({ checked: ids.length, reminded: bookings.length });
}
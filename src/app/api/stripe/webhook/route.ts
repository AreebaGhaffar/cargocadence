import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Events that mean "the customer has paid"
const PAID_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // The signature is computed over the RAW body, so read it as text
  const rawBody = await request.text();

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!PAID_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  // Event data can be stale: fetch the latest session from Stripe
  const eventSession = event.data.object as { id: string };
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(eventSession.id);
  } catch (err) {
    console.error("Could not retrieve checkout session:", err);
    return NextResponse.json({ error: "Stripe lookup failed" }, { status: 500 });
  }

  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true, ignored: "not paid" });
  }

  const bookingId = session.metadata?.booking_id;
  const metaUserId = session.metadata?.user_id;
  if (!bookingId || !metaUserId || session.amount_total == null) {
    // Retrying will not fix this, so acknowledge and log
    console.error("Paid session without booking metadata:", session.id);
    return NextResponse.json({ received: true, ignored: "no booking metadata" });
  }

  const supabase = createAdminClient();

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, user_id, status, final_total, estimated_total")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) {
    console.error("Booking lookup failed:", bookingError.message);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
  if (!booking || booking.user_id !== metaUserId) {
    console.error("Booking not found or owner mismatch for session:", session.id);
    return NextResponse.json({ received: true, ignored: "booking mismatch" });
  }

  const amount = session.amount_total / 100;
  const expected = Number(booking.final_total ?? booking.estimated_total);
  if (Number.isFinite(expected) && Math.abs(expected - amount) > 0.005) {
    // Money was received, so still record it, but flag it for a human
    console.warn(
      `Amount mismatch for booking ${booking.id}: paid ${amount}, expected ${expected}`
    );
  }

  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  // 1) Record the payment (unique checkout_session_id makes retries safe)
  const { error: insertError } = await supabase.from("payments").insert({
    booking_id: booking.id,
    user_id: booking.user_id,
    amount,
    currency: session.currency ?? "usd",
    status: "succeeded",
    payment_intent: paymentIntent,
    checkout_session_id: session.id,
  });

  // 23505 = already recorded by an earlier delivery: not an error
  if (insertError && insertError.code !== "23505") {
    console.error("Payment insert failed:", insertError.message);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // 2) Mark the booking paid (only from a payable state)
  const { error: updateError } = await supabase
    .from("bookings")
    .update({ status: "paid" })
    .eq("id", booking.id)
    .in("status", ["quoted", "confirmed"]);

  if (updateError) {
    console.error("Booking update failed:", updateError.message);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
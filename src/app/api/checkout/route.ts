import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";

const bodySchema = z.object({
  bookingId: z.string().uuid(),
});

const MIN_AMOUNT_CENTS = 50; // Stripe minimum charge for USD

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid booking id." }, { status: 400 });
  }

  // RLS means a customer can only ever load their own booking here.
  // The user_id filter also keeps admins from paying for someone else's booking.
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      "id, user_id, status, pickup_location, dropoff_location, estimated_total, final_total, is_custom_deal"
    )
    .eq("id", parsed.data.bookingId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  const payable =
    (booking.status === "quoted" && !booking.is_custom_deal) ||
    booking.status === "confirmed";
  if (!payable) {
    return NextResponse.json(
      { error: "This booking cannot be paid right now." },
      { status: 409 }
    );
  }

  const total = Number(booking.final_total ?? booking.estimated_total);
  if (!Number.isFinite(total) || total <= 0) {
    return NextResponse.json(
      { error: "This booking has no payable total yet." },
      { status: 409 }
    );
  }

  // All money math in whole cents
  const amountCents = Math.round(total * 100);
  if (amountCents < MIN_AMOUNT_CENTS) {
    return NextResponse.json(
      { error: "The total is below the minimum payment amount." },
      { status: 409 }
    );
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email ?? undefined,
      client_reference_id: booking.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: `Truck booking: ${booking.pickup_location} to ${booking.dropoff_location}`,
            },
          },
        },
      ],
      // The webhook reads these to know which booking was paid
      metadata: { booking_id: booking.id, user_id: user.id },
      payment_intent_data: {
        metadata: { booking_id: booking.id, user_id: user.id },
      },
      success_url: `${siteUrl}/dashboard?payment=success`,
      cancel_url: `${siteUrl}/dashboard?payment=cancelled`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Could not start payment." },
        { status: 502 }
      );
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout session failed:", err);
    return NextResponse.json(
      { error: "Could not start payment. Please try again." },
      { status: 502 }
    );
  }
}
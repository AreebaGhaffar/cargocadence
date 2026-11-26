import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const primaryButton =
  "rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500";
const secondaryButton =
  "rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-800 hover:bg-gray-100";

function GuestButtons() {
  return (
    <>
      <Link href="/register" className={primaryButton}>
        Get started
      </Link>
      <Link href="/login" className={secondaryButton}>
        Log in
      </Link>
    </>
  );
}

async function HeroButtons() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <GuestButtons />;

  return (
    <>
      <Link href="/book" className={primaryButton}>
        Book a truck
      </Link>
      <Link href="/dashboard" className={secondaryButton}>
        My dashboard
      </Link>
    </>
  );
}

const STEPS = [
  {
    title: "Tell our AI about your load",
    text: "Chat naturally: pickup location, drop-off point, what you are shipping and when.",
  },
  {
    title: "Get an instant estimate",
    text: "Your price is calculated from current truck rates, road distance and applicable surcharges.",
  },
  {
    title: "Confirm and pay online",
    text: "Book in one click and pay securely by card. Special requests go to our team for approval.",
  },
];

const FEATURES = [
  {
    title: "AI-assisted booking",
    text: "No long forms. The assistant collects every detail it needs in a simple conversation.",
  },
  {
    title: "Transparent rates",
    text: "Prices come from rates set by our team, calculated on the server, never guessed by the AI.",
  },
  {
    title: "Custom deals",
    text: "Need special terms or a heavier load? Submit it for approval and we will confirm a final price.",
  },
  {
    title: "Secure payments",
    text: "Card payments are handled by Stripe. We never see or store your card details.",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-6 py-16">
      <section className="flex flex-col items-start gap-6">
        <p className="rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-600">
          Freight booking across the USA
        </p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
          Book a truck in minutes, not phone calls.
        </h1>
        <p className="max-w-2xl text-lg text-gray-600">
          CargoCadence uses an AI assistant to take your pickup and delivery details,
          quote a fair price instantly, and keep your booking moving from request to pickup.
        </p>
        <div className="flex flex-wrap gap-3">
          <Suspense fallback={<GuestButtons />}>
            <HeroButtons />
          </Suspense>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold">How it works</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-lg border border-gray-300 p-5">
              <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 font-semibold text-white">
                {index + 1}
              </span>
              <h3 className="mb-1 font-semibold">{step.title}</h3>
              <p className="text-sm text-gray-600">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold">Why CargoCadence</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-lg border border-gray-300 p-5">
              <h3 className="mb-1 font-semibold">{feature.title}</h3>
              <p className="text-sm text-gray-600">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type ChatMessage = { role: "user" | "assistant"; content: string };

type Details = {
  pickupLocation: string | null;
  dropoffLocation: string | null;
  cargoDescription: string | null;
  cargoWeightLbs: number | null;
  pickupDate: string | null;
  pickupTime: string | null;
  pickupTimezone: string | null;
  truckType: string | null;
};

type CustomDeal = { requested: boolean; notes: string | null };

type Quote = {
  truckName: string;
  miles: number;
  lines: { label: string; amount: number }[];
  total: number;
  pickupAt: string;
  isCustomDeal: boolean;
  customDealNotes: string | null;
};

type SavedBooking = { id: string; status: string; estimated_total: number };

const GREETING =
  "Hi! I'm the CargoCadence booking assistant. Tell me where we're picking up, where it's going, what you're shipping and when, and I'll prepare your estimate.";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const post = (url: string, body: unknown) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export default function BookingChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [details, setDetails] = useState<Details | null>(null);
  const [customDeal, setCustomDeal] = useState<CustomDeal>({
    requested: false,
    notes: null,
  });
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<SavedBooking | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, quote, loading, booking]);

  const atLimit = messages.length >= 28;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading || booking || atLimit) return;

    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await post("/api/chat", { messages: next });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");

      setMessages([...next, { role: "assistant", content: data.reply }]);
      setDetails(data.details);
      setCustomDeal(data.customDeal);

      if (data.complete) {
        const q = await post("/api/quote", {
          ...data.details,
          customDeal: data.customDeal,
        });
        const quoteData = await q.json();
        if (q.ok) {
          setQuote(quoteData);
        } else {
          setQuote(null);
          setError(quoteData.error ?? "We could not calculate an estimate.");
        }
      } else {
        setQuote(null);
      }
    } catch (err) {
      // Put the message back so the customer can simply press Send again
      setMessages(messages);
      setInput(text);
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmBooking() {
    if (!details || !quote || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await post("/api/bookings", { ...details, customDeal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save your booking.");
      setBooking(data.booking);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save your booking."
      );
    } finally {
      setSaving(false);
    }
  }

  function startOver() {
    setMessages([]);
    setInput("");
    setDetails(null);
    setCustomDeal({ requested: false, notes: null });
    setQuote(null);
    setError(null);
    setBooking(null);
  }

  const shown: ChatMessage[] = [{ role: "assistant", content: GREETING }, ...messages];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        {shown.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
              m.role === "user"
                ? "self-end bg-blue-600 text-white"
                : "self-start bg-neutral-800 text-neutral-100"
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="self-start rounded-2xl bg-neutral-800 px-4 py-2 text-sm text-neutral-400">
            Thinking...
          </div>
        )}
      </div>

      {quote && !booking && (
        <div className="rounded-2xl border border-blue-500/40 bg-neutral-900 p-5">
          <h2 className="text-lg font-semibold text-white">Your estimate</h2>
          <p className="mt-1 text-sm text-neutral-400">
            {quote.truckName} · {quote.miles} miles · pickup{" "}
            {new Date(quote.pickupAt).toLocaleString("en-US", {
              timeZone: details?.pickupTimezone ?? undefined,
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZoneName: "short",
            })}
          </p>
          <ul className="mt-4 flex flex-col gap-1 text-sm text-neutral-200">
            {quote.lines.map((l) => (
              <li key={l.label} className="flex justify-between">
                <span>{l.label}</span>
                <span>{money(l.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-neutral-700 pt-3 text-base font-bold text-white">
            <span>Estimated total</span>
            <span>{money(quote.total)}</span>
          </div>
          {quote.isCustomDeal && (
            <p className="mt-3 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-300">
              This request needs admin approval, and the final price may change.
              {quote.customDealNotes ? ` Note: ${quote.customDealNotes}` : ""}
            </p>
          )}
          <button
            onClick={confirmBooking}
            disabled={saving}
            className="mt-4 w-full rounded-lg bg-blue-600 py-2.5 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : quote.isCustomDeal
                ? "Submit for approval"
                : "Confirm booking"}
          </button>
        </div>
      )}

      {booking && (
        <div className="rounded-2xl border border-green-500/40 bg-neutral-900 p-5">
          <h2 className="text-lg font-semibold text-green-400">
            {booking.status === "pending_approval"
              ? "Request submitted"
              : "Booking received"}
          </h2>
          <p className="mt-2 text-sm text-neutral-300">
            Reference {booking.id.slice(0, 8).toUpperCase()} · estimated total{" "}
            {money(booking.estimated_total)}
            {booking.status === "pending_approval"
              ? ". An admin will review your request."
              : "."}
          </p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={startOver}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              New booking
            </button>
            <Link
              href="/dashboard"
              className="rounded-lg bg-neutral-800 px-4 py-2 text-sm text-white hover:bg-neutral-700"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>
      )}

      {!booking && (
        <form onSubmit={send} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={1000}
            disabled={loading || atLimit}
            placeholder={
              atLimit ? "Conversation limit reached. Start over." : "Type your message..."
            }
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-white placeholder-neutral-500 outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            disabled={loading || atLimit || !input.trim()}
            className="rounded-lg bg-blue-600 px-5 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      )}

      {messages.length > 0 && !booking && (
        <button
          onClick={startOver}
          className="w-fit text-sm text-neutral-400 underline hover:text-neutral-200"
        >
          Start over
        </button>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
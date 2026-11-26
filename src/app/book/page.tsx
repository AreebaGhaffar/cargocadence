import Link from "next/link";
import BookingChat from "./chat";

export default function BookPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl p-4">
      <Link href="/dashboard" className="text-sm text-blue-500 hover:underline">
        ← Back to dashboard
      </Link>
      <p className="mt-4 text-sm font-semibold tracking-wide text-blue-500">CARGOCADENCE</p>
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Book a truck</h1>
      <BookingChat />
    </main>
  );
}
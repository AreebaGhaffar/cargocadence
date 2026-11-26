import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import Link from "next/link";
import MyBookings from "./my-bookings";
import SupportInfo from "@/components/support-info";

async function UserInfo() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-700">
        Logged in as <span className="font-semibold text-slate-900">{user.email}</span>
      </p>
      <form action={logout}>
        <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 hover:bg-gray-100">
          Log out
        </button>
      </form>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <Link
          href="/book"
          className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white shadow-sm hover:bg-slate-700"
        >
          Book a truck
        </Link>
      </div>
      <Suspense fallback={<p className="text-gray-600">Loading...</p>}>
        <UserInfo />
      </Suspense>
      <Suspense fallback={<p className="text-gray-600">Loading your bookings...</p>}>
        <MyBookings />
      </Suspense>
      <Suspense fallback={null}>
        <SupportInfo variant="card" />
      </Suspense>
    </main>
  );
}
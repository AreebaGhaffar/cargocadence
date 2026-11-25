import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import Link from "next/link";
import MyBookings from "./my-bookings";

async function UserInfo() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <>
      <p>Logged in as {user.email}</p>
      <form action={logout}>
        <button className="rounded bg-gray-700 px-4 py-2 text-white">Log out</button>
      </form>
    </>
  );
}

export default function DashboardPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <Link
        href="/book"
        className="w-fit rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500"
      >
        Book a truck
      </Link>
      <Suspense fallback={<p>Loading...</p>}>
        <UserInfo />
      </Suspense>
      <Suspense fallback={<p>Loading your bookings...</p>}>
        <MyBookings />
      </Suspense>
    </main>
  );
}
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/require-admin";
import Link from "next/link";

async function AdminHome() {
  const user = await requireAdmin();
  return <p>Welcome, {user.email}</p>;
}

export default function AdminHomePage() {
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Admin Control Panel</h1>
      <Link href="/admin/rates" className="w-fit rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700">Manage truck rates</Link>
      <Link href="/admin/bookings" className="w-fit rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700">View bookings</Link>
      <Link href="/admin/payments" className="w-fit rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700">Payments ledger</Link>
      <Link href="/admin/settings" className="w-fit rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700">Contact and support settings</Link>
      <Suspense fallback={<p>Checking access...</p>}>
        <AdminHome />
      </Suspense>
    </main>
  );
}
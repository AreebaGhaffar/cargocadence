import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/require-admin";

async function AdminHome() {
  const user = await requireAdmin();
  return <p>Welcome, {user.email}</p>;
}

export default function AdminHomePage() {
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Admin Control Panel</h1>
      <Suspense fallback={<p>Checking access...</p>}>
        <AdminHome />
      </Suspense>
    </main>
  );
}
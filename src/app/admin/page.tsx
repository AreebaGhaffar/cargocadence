import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminHomePage() {
  const user = await requireAdmin();

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Admin Control Panel</h1>
      <p>Welcome, {user.email}</p>
    </main>
  );
}
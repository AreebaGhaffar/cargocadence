import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p>Logged in as {user.email}</p>
      <form action={logout}>
        <button className="rounded bg-gray-700 px-4 py-2 text-white">Log out</button>
      </form>
    </main>
  );
}
import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import SettingsForm, { type SettingsValues } from "./settings-form";

async function SettingsLoader() {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("platform_settings")
    .select(
      "company_name, support_email, support_phone, whatsapp_number, support_hours, office_address, updated_at"
    )
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    return (
      <p className="text-red-600">
        Could not load settings. Check that migration 009 was run.
      </p>
    );
  }

  const { updated_at, ...values } = data as SettingsValues & { updated_at: string };

  // key = updated_at remounts the form with fresh values after each save
  return <SettingsForm key={updated_at} values={values} />;
}

export default function AdminSettingsPage() {
  return (
    <main className="flex flex-col gap-4">
      <Link href="/admin" className="w-fit text-sm text-blue-600 hover:underline">
        ← Admin home
      </Link>
      <h1 className="text-2xl font-bold">Contact details and support channels</h1>
      <p className="text-gray-600">
        These details are shown to customers in the site footer and on their dashboard.
        Leave a field empty to hide it.
      </p>
      <Suspense fallback={<p>Loading settings...</p>}>
        <SettingsLoader />
      </Suspense>
    </main>
  );
}
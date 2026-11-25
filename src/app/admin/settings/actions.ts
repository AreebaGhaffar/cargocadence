"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { settingsSchema } from "@/lib/validators/settings";

export type SettingsState = {
  ok: boolean;
  message: string;
  errors: Record<string, string>;
};

const FIELDS = [
  "company_name",
  "support_email",
  "support_phone",
  "whatsapp_number",
  "support_hours",
  "office_address",
] as const;

export async function updateSettings(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  // Server actions are public endpoints: always check the role here too
  await requireAdmin();

  const raw: Record<string, string> = {};
  for (const field of FIELDS) {
    raw[field] = String(formData.get(field) ?? "");
  }

  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { ok: false, message: "Please fix the highlighted fields.", errors };
  }

  const supabase = await createClient();
  // select() lets us detect the case where RLS silently updated 0 rows
  const { data, error } = await supabase
    .from("platform_settings")
    .update(parsed.data)
    .eq("id", 1)
    .select("id");

  if (error || !data || data.length === 0) {
    console.error("Settings update failed:", error?.message ?? "no row updated");
    return {
      ok: false,
      message: "Could not save settings. Please try again.",
      errors: {},
    };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved.", errors: {} };
}
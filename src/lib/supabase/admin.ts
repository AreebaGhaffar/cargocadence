import "server-only";
import { createClient } from "@supabase/supabase-js";

// Privileged client: bypasses RLS. Use ONLY in trusted server code
// (for example the Stripe webhook). Never import this in client components.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Supabase URL or SUPABASE_SECRET_KEY is not set");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type RateLimitRule = {
  bucket: string;
  limit: number;
  windowSeconds: number;
};

// Returns true if the user has exceeded ANY rule.
// If the limiter itself fails, we log and allow the request (fail open)
// so that a database hiccup does not block every customer.
export async function isRateLimited(
  userId: string,
  rules: RateLimitRule[]
): Promise<boolean> {
  const admin = createAdminClient();

  for (const rule of rules) {
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_user_id: userId,
      p_bucket: rule.bucket,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    });

    if (error) {
      console.error("Rate limit check failed:", error.message);
      continue;
    }
    if (data === false) return true;
  }
  return false;
}
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema } from "@/lib/validators/auth";

export type AuthState = { error?: string; message?: string } | undefined;

export async function register(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });
  if (error) return { error: error.message };

  if (!data.session) {
    return { message: "Check your email to confirm your account, then log in." };
  }
  redirect("/dashboard");
}

export async function login(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Invalid email or password" };

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
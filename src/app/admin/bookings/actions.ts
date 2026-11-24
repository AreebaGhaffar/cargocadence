"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { approveSchema } from "@/lib/validators/bookings";

export type BookingActionState = { error?: string; ok?: boolean } | undefined;

export async function approveBooking(
  _prev: BookingActionState,
  formData: FormData
): Promise<BookingActionState> {
  await requireAdmin();
  const parsed = approveSchema.safeParse({
    id: formData.get("id"),
    finalTotal: formData.get("finalTotal"),
    adminNotes: formData.get("adminNotes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({
      status: "confirmed",
      final_total: parsed.data.finalTotal,
      admin_notes: parsed.data.adminNotes || null,
    })
    .eq("id", parsed.data.id)
    .eq("status", "pending_approval")
    .select("id");

  if (error) return { error: "Could not approve. Please try again." };
  if (!data?.length) return { error: "This booking is no longer awaiting approval" };

  revalidatePath("/admin/bookings");
  return { ok: true };
}

export async function cancelBooking(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createClient();
  // Paid bookings are excluded on purpose: they will need a refund flow
  await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id.data)
    .in("status", ["quoted", "pending_approval", "confirmed"]);

  revalidatePath("/admin/bookings");
}
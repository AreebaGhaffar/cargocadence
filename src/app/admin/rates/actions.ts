"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { truckTypeSchema } from "@/lib/validators/rates";

export type RateState = { error?: string; ok?: boolean } | undefined;

function parseTruck(formData: FormData) {
  return truckTypeSchema.safeParse({
    name: formData.get("name"),
    baseFee: formData.get("baseFee"),
    ratePerMile: formData.get("ratePerMile"),
    maxWeightLbs: formData.get("maxWeightLbs"),
    active: formData.get("active") === "on",
  });
}

function toRow(d: z.infer<typeof truckTypeSchema>) {
  return {
    name: d.name,
    base_fee: d.baseFee,
    rate_per_mile: d.ratePerMile,
    max_weight_lbs: d.maxWeightLbs,
    active: d.active,
  };
}

function friendlyError(code?: string) {
  return code === "23505"
    ? "A truck type with that name already exists"
    : "Could not save. Please try again.";
}

export async function createTruckType(
  _prev: RateState,
  formData: FormData
): Promise<RateState> {
  await requireAdmin();
  const parsed = parseTruck(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("truck_types").insert(toRow(parsed.data));
  if (error) return { error: friendlyError(error.code) };

  revalidatePath("/admin/rates");
  return { ok: true };
}

export async function updateTruckType(
  _prev: RateState,
  formData: FormData
): Promise<RateState> {
  await requireAdmin();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Invalid truck type" };

  const parsed = parseTruck(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("truck_types")
    .update(toRow(parsed.data))
    .eq("id", id.data);
  if (error) return { error: friendlyError(error.code) };

  revalidatePath("/admin/rates");
  return { ok: true };
}
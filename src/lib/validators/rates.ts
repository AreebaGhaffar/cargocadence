import { z } from "zod";

const money = z.coerce.number().min(0, "Amounts must be 0 or more").max(100000);

export const truckTypeSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(60),
  baseFee: money,
  ratePerMile: money,
  maxWeightLbs: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.number().int().positive().max(200000).nullable()
  ),
  active: z.boolean(),
});

export const surchargeSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a name").max(60),
    kind: z.enum(["flat", "percent"]),
    amount: money,
    active: z.boolean(),
  })
  .refine((d) => d.kind !== "percent" || d.amount <= 100, {
    message: "A percentage can't be above 100",
    path: ["amount"],
  });
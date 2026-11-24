import { z } from "zod";

export const approveSchema = z.object({
  id: z.string().uuid(),
  finalTotal: z.coerce.number().positive("Enter the final total").max(1_000_000),
  adminNotes: z.preprocess((v) => (v == null ? "" : v), z.string().trim().max(500)),
});
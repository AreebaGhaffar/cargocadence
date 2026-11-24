import { z } from "zod";
import { US_TIMEZONES } from "@/lib/ai/booking-schema";

// Details the customer confirmed in chat: every field is required here
export const confirmedDetailsSchema = z.object({
  pickupLocation: z.string().trim().min(3).max(200),
  dropoffLocation: z.string().trim().min(3).max(200),
  cargoDescription: z.string().trim().min(2).max(500),
  cargoWeightLbs: z.number().int().positive().max(200000),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickupTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  pickupTimezone: z.enum(US_TIMEZONES),
  truckType: z.string().trim().min(1).max(60),
  customDeal: z.object({
    requested: z.boolean(),
    notes: z.string().trim().max(500).nullable(),
  }),
});

export type ConfirmedDetails = z.infer<typeof confirmedDetailsSchema>;
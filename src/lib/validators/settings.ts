import { z } from "zod";

const emptyToNull = (v: string) => (v === "" ? null : v);

// Digits, spaces and common phone punctuation only
const PHONE_PATTERN = /^[0-9+()\-\s.]*$/;

const optionalPhone = z
  .string()
  .trim()
  .max(50, "Max 50 characters")
  .refine((v) => PHONE_PATTERN.test(v), "Use digits, spaces, + ( ) - . only")
  .transform(emptyToNull);

export const settingsSchema = z.object({
  company_name: z
    .string()
    .trim()
    .min(1, "Company name is required")
    .max(100, "Max 100 characters"),
  support_email: z
    .string()
    .trim()
    .max(200, "Max 200 characters")
    .refine(
      (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      "Enter a valid email address"
    )
    .transform(emptyToNull),
  support_phone: optionalPhone,
  whatsapp_number: optionalPhone,
  support_hours: z.string().trim().max(200, "Max 200 characters").transform(emptyToNull),
  office_address: z.string().trim().max(300, "Max 300 characters").transform(emptyToNull),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
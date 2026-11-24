import { Type, type Schema } from "@google/genai";
import { z } from "zod";

export const US_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
] as const;

// What the browser may send us
export const chatRequestSchema = z
  .object({
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().trim().min(1).max(1000),
        })
      )
      .min(1)
      .max(30),
  })
  .refine((d) => d.messages[0].role === "user", {
    message: "Conversation must start with a user message",
  })
  .refine((d) => d.messages[d.messages.length - 1].role === "user", {
    message: "Last message must be from the user",
  });

const text = (max: number) => z.string().trim().max(max).nullable();

export const detailsSchema = z.object({
  pickupLocation: text(200),
  dropoffLocation: text(200),
  cargoDescription: text(500),
  cargoWeightLbs: z.number().int().positive().max(200000).nullable(),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  pickupTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  pickupTimezone: z.enum(US_TIMEZONES).nullable(),
  truckType: text(60),
});

// What we accept back from Gemini
export const modelOutputSchema = z.object({
  reply: z.string().trim().min(1).max(1500),
  details: detailsSchema,
  customDeal: z.object({
    requested: z.boolean(),
    notes: text(500),
  }),
});

export type BookingDetails = z.infer<typeof detailsSchema>;

// The same shape, described to Gemini so it answers in JSON
const nullableString: Schema = { type: Type.STRING, nullable: true };

export const geminiResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING },
    details: {
      type: Type.OBJECT,
      properties: {
        pickupLocation: nullableString,
        dropoffLocation: nullableString,
        cargoDescription: nullableString,
        cargoWeightLbs: { type: Type.INTEGER, nullable: true },
        pickupDate: nullableString,
        pickupTime: nullableString,
        pickupTimezone: {
          type: Type.STRING,
          enum: [...US_TIMEZONES],
          nullable: true,
        },
        truckType: nullableString,
      },
      required: [
        "pickupLocation",
        "dropoffLocation",
        "cargoDescription",
        "cargoWeightLbs",
        "pickupDate",
        "pickupTime",
        "pickupTimezone",
        "truckType",
      ],
    },
    customDeal: {
      type: Type.OBJECT,
      properties: {
        requested: { type: Type.BOOLEAN },
        notes: nullableString,
      },
      required: ["requested", "notes"],
    },
  },
  required: ["reply", "details", "customDeal"],
};
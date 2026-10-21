import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const contactSchema = z
  .object({
    name: z.string().trim().min(2, "Please enter your name.").max(80),
    email: z
      .union([z.literal(""), z.email("Enter a valid email.")])
      .optional()
      .transform((v) => (v ? v.toLowerCase() : null)),
    phone: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => !v || v.replace(/\D/g, "").length >= 10, "Enter a valid phone number."),
    skillLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "PRO"]).nullish(),
  })
  .refine((c) => !!c.email || !!c.phone, {
    message: "Add an email or a phone number so we can reach you.",
    path: ["email"],
  });

export const extrasSchema = z
  .object({
    balls: z.boolean(),
    fulfillment: z.enum(["PICKUP", "DELIVERY_COURT", "DELIVERY_ADDRESS"]),
    courtId: z.string().nullish(),
    deliveryAddress: optionalText(200),
  })
  .refine((e) => e.fulfillment !== "DELIVERY_COURT" || !!e.courtId, { message: "Pick a court.", path: ["courtId"] })
  .refine((e) => e.fulfillment !== "DELIVERY_ADDRESS" || !!e.deliveryAddress, {
    message: "Enter the delivery address.",
    path: ["deliveryAddress"],
  });

export const checkoutSchema = z.object({
  productId: z.string().min(1),
  machineId: z.string().min(1),
  startsAt: z.iso.datetime(),
  extras: extrasSchema,
  contact: contactSchema,
  notes: optionalText(500),
  termsAccepted: z.literal(true, { error: "Please accept the rental terms." }),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;

export const quoteSchema = z.object({
  productId: z.string().min(1),
  machineId: z.string().min(1),
  extras: extrasSchema,
});

export type QuoteInput = z.input<typeof quoteSchema>;

/** First error message per field path ("contact.email" → "…"). */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

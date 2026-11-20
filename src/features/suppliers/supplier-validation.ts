import { z } from "zod";
const optionalLocation = z.preprocess(value => typeof value === "string" && !value.trim() ? undefined : value, z.string().trim().min(1).max(200).optional());
export const supplierAccountSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the contact's full name").max(200),
  companyName: z.string().trim().min(2, "Enter the company name").max(200),
  email: z.string().trim().email("Enter a valid email address").max(254).transform(value => value.toLowerCase()),
  phone: z.string().trim().regex(/^\+?[0-9][0-9 ()-]{6,19}$/, "Enter a valid phone number"),
  gstNumber: z.string().trim().transform(value => value.toUpperCase()).refine(value => !value || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value), "Enter a valid GST number").optional(),
  supplierType: z.enum(["manufacturer", "trader", "buying_house"]),
  city: optionalLocation, locationState: optionalLocation,
});

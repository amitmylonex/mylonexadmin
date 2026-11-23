import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();

const port = z.coerce
  .number()
  .int()
  .min(1)
  .max(65535)
  .safeParse(process.env.PORT || "4000");
if (!port.success)
  throw new Error("Invalid backend environment: PORT must be 1..65535");
const frontendOrigin = z
  .string()
  .url()
  .safeParse(process.env.FRONTEND_ORIGIN || "http://localhost:5173");
if (!frontendOrigin.success)
  throw new Error(
    "Invalid backend environment: FRONTEND_ORIGIN must be an absolute URL",
  );
export const config = {
  port: port.data,
  host: process.env.HOST || "0.0.0.0",
  frontendOrigin: frontendOrigin.data,
  databaseUrl: process.env.DATABASE_URL || "",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || "",
  postmarkEnabled: process.env.POSTMARK_ENABLED === "true",
  postmarkToken: process.env.POSTMARK_SERVER_TOKEN || "",
  postmarkFrom: process.env.POSTMARK_FROM_EMAIL || "",
  postmarkStream: process.env.POSTMARK_MESSAGE_STREAM || "outbound",
  appBaseUrl: process.env.APP_BASE_URL || "",
  anonymizeRfqBuyers: process.env.RFQ_ANONYMIZE_BUYERS !== "false",
};

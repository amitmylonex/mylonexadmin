import { z } from "zod";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "../../config.js";
import { CatalogError } from "./catalog.service.js";
export const imagePayloadSchema = z.object({ contentType: z.enum(["image/jpeg", "image/png", "image/webp"]), data: z.string().min(1).max(13981016).regex(/^[A-Za-z0-9+/]+={0,2}$/) });
export function validateImage(payload: unknown) {
  const input = imagePayloadSchema.parse(payload);
  const bytes = Buffer.from(input.data, "base64");
  if (!bytes.length || bytes.length > 10*1024*1024) throw new CatalogError(400, "Images must be between 1 byte and 10MB");
  const valid = input.contentType === "image/png" ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : input.contentType === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.toString("ascii",0,4) === "RIFF" && bytes.toString("ascii",8,12) === "WEBP";
  if (!valid) throw new CatalogError(400, "Image contents do not match the selected type");
  return { bytes, contentType: input.contentType };
}
export async function uploadImage(supplierId: string, payload: unknown) {
  const { bytes, contentType } = validateImage(payload);
  if (!config.supabaseSecretKey) throw new CatalogError(503, "Image storage is not configured");
  const storage = createClient(config.supabaseUrl, config.supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
  const bucket = process.env.SUPABASE_PRODUCT_IMAGES_BUCKET || "product-images";
  const path = `${supplierId}/${randomUUID()}.${contentType.split("/")[1]}`;
  const { error } = await storage.from(bucket).upload(path, bytes, { contentType, upsert: false });
  if (error) throw new CatalogError(502, "Image upload failed. Please retry.");
  return storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

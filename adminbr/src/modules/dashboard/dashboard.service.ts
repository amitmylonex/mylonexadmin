import { originalMetrics, moderationMetrics } from "./dashboard.repository.js";
import { metrics as buyerMetrics } from "../buyers/buyer.repository.js";
import { MemoryCache } from "../../shared/cache/ttl-cache.js";
const cache = new MemoryCache(3);
export const platformWidget = () => cache.remember("platform", 15_000, originalMetrics);
export const buyerWidget = () => cache.remember("buyers", 15_000, buyerMetrics);
export const moderationWidget = () => cache.remember("moderation", 15_000, moderationMetrics);
export async function dashboard() {
  const [platformMetrics, buyers, moderation] = await Promise.all([
    platformWidget(),
    buyerWidget(),
    moderationWidget(),
  ]);
  return { ...moderation, platformMetrics, buyerMetrics: buyers };
}

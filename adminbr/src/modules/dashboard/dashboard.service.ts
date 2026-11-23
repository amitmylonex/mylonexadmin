import { originalMetrics, moderationMetrics } from "./dashboard.repository.js";
import { metrics as buyerMetrics } from "../buyers/buyer.repository.js";
export async function dashboard() {
  const [platformMetrics, buyers, moderation] = await Promise.all([
    originalMetrics(),
    buyerMetrics(),
    moderationMetrics(),
  ]);
  return { ...moderation, platformMetrics, buyerMetrics: buyers };
}

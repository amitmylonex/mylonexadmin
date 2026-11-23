import { PrismaClient } from "@prisma/client";
import { config } from "../config.js";
import { pooledDatabaseUrl } from "./pool-config.js";

export const prisma = new PrismaClient({
  datasourceUrl: pooledDatabaseUrl(config.databaseUrl, process.env.DATABASE_CONNECTION_LIMIT, process.env.DATABASE_POOL_TIMEOUT),
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

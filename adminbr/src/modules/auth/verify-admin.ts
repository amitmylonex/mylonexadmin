import {allowAuthVerification} from "../../common/auth/request-limit.js";
import { resolveAdminSession, AdminSessionError } from "./admin-session.js";
import { allowAdminWrite } from "./write-limit.js";
import { FastifyRequest, FastifyReply } from "fastify";
import { createClient } from "@supabase/supabase-js";
import { config } from "../../config.js";
import { prisma } from "../../infrastructure/db.js";
import type { UserRole } from "@prisma/client";

const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey);

export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
}

declare module "fastify" {
  interface FastifyRequest {
    admin?: AdminUser;
  }
}

export type AdminSessionResolver = (token: string) => Promise<AdminUser>;
export function createAdminAuthenticator(resolve: AdminSessionResolver = token => resolveAdminSession(token, supabase.auth, prisma.user)) {
 return async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Global namespace protection and older route hooks share this verified identity.
  if (request.admin) return;
  const authHeader = request.headers.authorization;
  if (!authHeader || !/^Bearer\s+\S+$/i.test(authHeader)) {
    return reply.status(401).send({ error: "Missing or invalid authorization header" });
  }

  if(!allowAuthVerification(request.ip))return reply.header("Retry-After","60").code(429).send({error:"Too many authentication checks. Wait a minute and retry."});
  const token = authHeader.replace(/^Bearer\s+/i, "");

  try {
    const dbUser = await resolve(token);

    request.admin = dbUser;
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !allowAdminWrite(dbUser.id)) {
      return reply.header("Retry-After", "60").code(429).send({ error: "Too many admin changes. Wait a minute and retry." });
    }
  } catch (err: any) {
    if (err instanceof AdminSessionError) return reply.code(err.statusCode).send({ error: { code: err.code || (err.statusCode === 503 ? "AUTH_PROVIDER_UNAVAILABLE" : err.statusCode === 403 ? "FORBIDDEN" : "UNAUTHORIZED"), message: err.message } });
    request.log.error({ requestId: request.id }, "Authentication provider unavailable");
    return reply.status(503).send({ error: "Unable to verify Admin access. Retry shortly." });
  }
 };
}
export const requireAdminAuth = createAdminAuthenticator();

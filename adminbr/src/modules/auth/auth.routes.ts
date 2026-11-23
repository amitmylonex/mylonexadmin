import { FastifyInstance } from "fastify";
import { requireAdminAuth } from "./verify-admin.js";

export async function authRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/admin/auth/me",
    { preHandler: [requireAdminAuth] },
    async (request, reply) => {
      return reply.send({ user: request.admin });
    }
  );
}

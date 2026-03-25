import type { AuthPayload } from "../lib/authTokens.js";

declare module "fastify" {
  interface FastifyRequest {
    authUser: AuthPayload | null;
  }
}

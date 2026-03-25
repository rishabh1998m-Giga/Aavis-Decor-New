import type { FastifyRequest } from "fastify";
import { COOKIE_NAME, verifyAuthToken, type AuthPayload } from "../lib/authTokens.js";

export async function getAuthFromRequest(req: FastifyRequest): Promise<AuthPayload | null> {
  const raw = req.cookies[COOKIE_NAME];
  if (!raw) return null;
  return verifyAuthToken(raw);
}

export function requireAuth(auth: AuthPayload | null): AuthPayload {
  if (!auth) throw new Error("UNAUTHORIZED");
  return auth;
}

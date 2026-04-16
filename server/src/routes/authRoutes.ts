import type { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { COOKIE_NAME, signAuthToken } from "../lib/authTokens.js";
import { ApiError, sendError } from "../lib/errors.js";
import { getAuthFromRequest } from "../plugins/requestAuth.js";

const BCRYPT_ROUNDS = 10;

export async function registerAuthRoutes(app: FastifyInstance) {
  const cookieSecure = process.env.COOKIE_SECURE === "true";
  // Cross-origin deployments (frontend + API on different domains) require
  // SameSite=None; Secure. Set COOKIE_SAMESITE=none in that case.
  const cookieSameSite = (process.env.COOKIE_SAMESITE ?? "lax") as "lax" | "none" | "strict";
  const cookieOpts = () => ({
    path: "/",
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    maxAge: 60 * 60 * 24 * 7,
    domain: process.env.COOKIE_DOMAIN || undefined,
  });

  app.post("/api/auth/register", async (req, reply) => {
    try {
      const body = req.body as {
        email?: string;
        password?: string;
        fullName?: string;
      };
      const email = String(body.email || "")
        .trim()
        .toLowerCase();
      const password = String(body.password || "");
      const fullName = body.fullName?.trim() || null;
      if (!email || !password) throw new ApiError(400, "Email and password required");

      const existing = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);
      if (existing.length) throw new ApiError(409, "Email already registered");

      const id = nanoid();
      const now = new Date().toISOString();
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await db.insert(schema.users).values({
        id,
        email,
        passwordHash,
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(schema.profiles).values({
        userId: id,
        fullName,
        phone: null,
        avatarUrl: null,
        createdAt: now,
        updatedAt: now,
      });
      let role: "customer" | "admin" | "staff" = "customer";
      await db.insert(schema.userRoles).values({ userId: id, role: "customer" });

      const firstAdminEmail = process.env.FIRST_ADMIN_EMAIL?.trim().toLowerCase();
      if (firstAdminEmail && firstAdminEmail === email) {
        await db
          .update(schema.userRoles)
          .set({ role: "admin" })
          .where(eq(schema.userRoles.userId, id));
        role = "admin";
      }

      const token = await signAuthToken({ sub: id, email, role });
      reply.setCookie(COOKIE_NAME, token, cookieOpts());

      return { user: { id, email, role } };
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.post("/api/auth/login", async (req, reply) => {
    try {
      const body = req.body as { email?: string; password?: string };
      const email = String(body.email || "")
        .trim()
        .toLowerCase();
      const password = String(body.password || "");
      if (!email || !password) throw new ApiError(400, "Email and password required");

      const rows = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);
      if (!rows.length) throw new ApiError(401, "Invalid email or password");

      const user = rows[0];
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) throw new ApiError(401, "Invalid email or password");

      const roles = await db
        .select()
        .from(schema.userRoles)
        .where(eq(schema.userRoles.userId, user.id))
        .limit(1);
      const role = roles[0]?.role ?? "customer";

      const token = await signAuthToken({ sub: user.id, email: user.email, role });
      reply.setCookie(COOKIE_NAME, token, cookieOpts());

      return { user: { id: user.id, email: user.email, role } };
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.post("/api/auth/logout", async (_req, reply) => {
    reply.clearCookie(COOKIE_NAME, {
      path: "/",
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      domain: process.env.COOKIE_DOMAIN || undefined,
    });
    return { ok: true };
  });

  app.get("/api/auth/me", async (req, reply) => {
    try {
      const auth = await getAuthFromRequest(req);
      if (!auth) return reply.status(401).send({ user: null });

      const prof = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, auth.sub))
        .limit(1);

      const roles = await db
        .select()
        .from(schema.userRoles)
        .where(eq(schema.userRoles.userId, auth.sub))
        .limit(1);
      const role = roles[0]?.role ?? auth.role;

      return {
        user: {
          id: auth.sub,
          email: auth.email,
          role,
          fullName: prof[0]?.fullName ?? null,
        },
      };
    } catch (e) {
      return sendError(reply, e);
    }
  });

  // TEMPORARY: one-time admin promotion endpoint — remove after use
  app.post("/api/auth/promote-admin", async (req, reply) => {
    const body = req.body as { secret?: string; email?: string };
    if (body.secret !== "aavis-promote-2024") {
      return reply.status(403).send({ error: "Forbidden" });
    }
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return reply.status(400).send({ error: "email required" });
    const rows = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    if (!rows.length) return reply.status(404).send({ error: "User not found" });
    const userId = rows[0].id;
    const roleRows = await db.select().from(schema.userRoles).where(eq(schema.userRoles.userId, userId)).limit(1);
    if (roleRows.length) {
      await db.update(schema.userRoles).set({ role: "admin" }).where(eq(schema.userRoles.userId, userId));
    } else {
      await db.insert(schema.userRoles).values({ userId, role: "admin" });
    }
    return { ok: true, email, role: "admin" };
  });
}

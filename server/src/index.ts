import "dotenv/config";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { registerAuthRoutes } from "./routes/authRoutes.js";
import { registerCatalogRoutes } from "./routes/catalogRoutes.js";
import { registerCheckoutRoutes } from "./routes/checkoutRoutes.js";
import { registerPublicOrderRoutes } from "./routes/publicOrderRoutes.js";
import { registerAccountRoutes } from "./routes/accountRoutes.js";
import { registerAdminRoutes } from "./routes/adminRoutes.js";
import { registerUploadRoutes } from "./routes/uploadRoutes.js";
import { registerShiprocketWebhookRoutes } from "./routes/shiprocketWebhookRoutes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16)
    throw new Error("JWT_SECRET must be set and at least 16 characters");
  if (!process.env.COOKIE_SECRET && !process.env.JWT_SECRET)
    throw new Error("COOKIE_SECRET (or JWT_SECRET fallback) is required");

  const app = Fastify({ logger: true });

  // In production FRONTEND_ORIGIN must be set (wildcard + credentials is rejected by browsers).
  const rawOrigin = process.env.FRONTEND_ORIGIN;
  const origins: string[] | boolean = rawOrigin
    ? rawOrigin.split(",").map((s) => s.trim())
    : process.env.NODE_ENV === "production"
    ? (() => { throw new Error("FRONTEND_ORIGIN is required in production"); })()
    : ["http://localhost:8080", "http://localhost:3000"];

  await app.register(cors, {
    origin: origins,
    credentials: true,
  });
  await app.register(cookie, {
    secret:
      process.env.COOKIE_SECRET || process.env.JWT_SECRET || "dev-change-me",
  });
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  const uploadDir =
    process.env.UPLOAD_DIR || join(__dirname, "../uploads/product-images");
  await mkdir(uploadDir, { recursive: true });
  await app.register(fastifyStatic, {
    root: join(__dirname, "../uploads"),
    prefix: "/media/",
  });

  await registerAuthRoutes(app);
  await registerCatalogRoutes(app);
  await registerCheckoutRoutes(app);
  await registerPublicOrderRoutes(app);
  await registerAccountRoutes(app);
  await registerUploadRoutes(app);
  await registerAdminRoutes(app);
  await registerShiprocketWebhookRoutes(app);

  app.get("/api/health", async () => ({ ok: true }));

  // Serve the React SPA when FRONTEND_DIR is set (production Hostinger mode).
  // All non-API, non-media, non-file requests fall back to index.html.
  const frontendDir = process.env.FRONTEND_DIR;
  if (frontendDir && existsSync(frontendDir)) {
    await app.register(fastifyStatic, {
      root: frontendDir,
      prefix: "/",
      decorateReply: false,
    });
    app.setNotFoundHandler(async (_req, reply) => {
      return reply.sendFile("index.html", frontendDir);
    });
    app.log.info(`Serving React SPA from ${frontendDir}`);
  }

  // Integration presence summary — makes misconfigured envs obvious at boot.
  const rzpKey = process.env.RAZORPAY_KEY_ID || "";
  const rzpMode = rzpKey.startsWith("rzp_live_")
    ? "LIVE"
    : rzpKey.startsWith("rzp_test_")
    ? "test"
    : "missing";
  const srConfigured = Boolean(
    process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD
  );
  const srWebhookSigned = Boolean(process.env.SHIPROCKET_WEBHOOK_SECRET);
  app.log.info(
    `Integrations — Razorpay: ${rzpMode}  Shiprocket: ${
      srConfigured ? "configured" : "missing"
    }  Shiprocket webhook signing: ${srWebhookSigned ? "on" : "off"}`
  );

  const port = Number(process.env.PORT) || 3001;
  const host = process.env.HOST || "0.0.0.0";
  await app.listen({ port, host });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

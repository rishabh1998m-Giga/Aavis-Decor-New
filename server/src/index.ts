import "dotenv/config";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
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

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const app = Fastify({ logger: true });

  const origins = process.env.FRONTEND_ORIGIN
    ? process.env.FRONTEND_ORIGIN.split(",").map((s) => s.trim())
    : true;

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

  app.get("/api/health", async () => ({ ok: true }));

  const port = Number(process.env.PORT) || 3001;
  const host = process.env.HOST || "0.0.0.0";
  await app.listen({ port, host });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

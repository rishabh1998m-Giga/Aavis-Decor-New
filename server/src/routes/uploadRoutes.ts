import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { ApiError, sendError } from "../lib/errors.js";
import { getAuthFromRequest } from "../plugins/requestAuth.js";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import * as t from "../db/schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function assertAdmin(req: Parameters<typeof getAuthFromRequest>[0]) {
  const auth = await getAuthFromRequest(req);
  if (!auth) throw new ApiError(401, "Unauthorized");
  const row = await db
    .select()
    .from(t.userRoles)
    .where(eq(t.userRoles.userId, auth.sub))
    .limit(1);
  if (row[0]?.role !== "admin") throw new ApiError(403, "Forbidden");
}

export async function registerUploadRoutes(app: FastifyInstance) {
  app.post("/api/admin/upload", async (req, reply) => {
    try {
      await assertAdmin(req);
      const uploadDir =
        process.env.UPLOAD_DIR || join(__dirname, "../../uploads/product-images");
      await mkdir(uploadDir, { recursive: true });

      const data = await req.file();
      if (!data) throw new ApiError(400, "No file");

      const q = req.query as { productId?: string };
      const productId = q.productId || "misc";
      const ext = data.filename.split(".").pop() || "bin";
      const safeExt = ext.replace(/[^a-z0-9]/gi, "").slice(0, 5) || "bin";
      const name = `${productId}/${Date.now()}-${nanoid(6)}.${safeExt}`;
      const full = join(uploadDir, ...name.split("/"));
      await mkdir(dirname(full), { recursive: true });

      const buf = await data.toBuffer();
      await writeFile(full, buf);

      const base =
        process.env.PUBLIC_MEDIA_BASE_URL?.replace(/\/$/, "") ||
        "/media";
      const url = `${base}/product-images/${name}`;
      return { url };
    } catch (e) {
      return sendError(reply, e);
    }
  });
}

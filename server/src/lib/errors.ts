import type { FastifyReply } from "fastify";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function sendError(reply: FastifyReply, err: unknown) {
  if (err instanceof ApiError) {
    return reply.status(err.statusCode).send({
      error: err.message,
      code: err.code ?? "error",
    });
  }
  console.error(err);

  // Third-party integration errors carry actionable info (e.g. Shiprocket
  // "Wrong Pickup location entered"). Surface them as 502 instead of masking
  // as a generic 500 — these messages come from upstream API bodies, not
  // internal stack traces, so they're safe to expose to admins.
  const msg = err instanceof Error ? err.message : "";
  if (msg.startsWith("Shiprocket ")) {
    return reply.status(502).send({ error: msg, code: "shiprocket_error" });
  }

  return reply.status(500).send({ error: "Internal server error", code: "internal" });
}

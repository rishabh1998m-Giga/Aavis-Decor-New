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
  return reply.status(500).send({ error: "Internal server error", code: "internal" });
}

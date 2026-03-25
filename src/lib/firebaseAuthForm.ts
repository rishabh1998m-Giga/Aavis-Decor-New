import { apiConfigMessage, isApiConfigured } from "@/lib/api";

/** Map auth errors to user-friendly UI copy (signup / login forms). */
export function authExceptionMessage(err: unknown): string {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const msg = raw.toLowerCase();

  if (
    msg.includes("invalid login credentials") ||
    msg.includes("invalid email or password")
  ) {
    return "We couldn't sign you in. Check your email and password, then try again.";
  }
  if (msg.includes("user already registered") || msg.includes("409")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (
    msg.includes("password") &&
    (msg.includes("weak") || msg.includes("short") || msg.includes("least"))
  ) {
    return "Choose a stronger password (at least 6 characters).";
  }
  if (msg.includes("invalid email")) {
    return "Please enter a valid email address.";
  }

  return raw || "Something went wrong. Please try again.";
}

export function authFormBlockedMessage(): string | null {
  return apiConfigMessage() ?? (!isApiConfigured() ? "API is not configured." : null);
}

export { isApiConfigured, apiConfigMessage };

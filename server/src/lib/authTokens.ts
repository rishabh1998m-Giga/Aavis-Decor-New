import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "auth_token";

export function getJwtSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error("JWT_SECRET must be set (min 16 chars)");
  }
  return new TextEncoder().encode(s);
}

export async function signAuthToken(payload: {
  sub: string;
  email: string;
  role: string;
}): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES ?? "7d")
    .sign(secret);
}

export type AuthPayload = {
  sub: string;
  email: string;
  role: string;
};

export async function verifyAuthToken(token: string): Promise<AuthPayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    const sub = String(payload.sub ?? "");
    const email = String(payload.email ?? "");
    const role = String(payload.role ?? "customer");
    if (!sub) return null;
    return { sub, email, role };
  } catch {
    return null;
  }
}

export { COOKIE_NAME };

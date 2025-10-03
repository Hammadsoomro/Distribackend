import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { db, User } from "./store";

const SECRET = process.env.JWT_SECRET || "dev-secret";

export interface AuthTokenPayload {
  uid: string;
  ts: number;
}

export function signToken(payload: AuthTokenPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken(
  token: string | undefined,
): AuthTokenPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(body)
    .digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
    return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    ) as AuthTokenPayload;
    return payload;
  } catch {
    return null;
  }
}

export interface AuthedRequest extends Request {
  user?: User;
}

export function authMiddleware(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
) {
  const header = req.headers["authorization"] || "";
  const token =
    typeof header === "string" && header.startsWith("Bearer ")
      ? header.slice(7)
      : undefined;
  const payload = verifyToken(token);
  if (payload) {
    const u = db.users.get(payload.uid);
    if (u) req.user = u;
  }
  next();
}

export function requireUser(
  req: AuthedRequest,
  res: Response,
  role?: "admin" | "member",
) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  if (role && req.user.role !== role) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

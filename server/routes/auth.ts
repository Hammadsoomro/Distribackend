import type { RequestHandler } from "express";
import {
  adminExists,
  db,
  findUserByEmail,
  hashPassword,
  newId,
  publicUser,
} from "../store";
import { signToken } from "../auth";

export const adminSetup: RequestHandler = (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: "Missing fields" });
  if (adminExists())
    return res.status(400).json({ error: "Admin already exists" });
  if (findUserByEmail(email))
    return res.status(400).json({ error: "Email already in use" });
  const id = newId("user");
  const user = {
    id,
    name,
    email,
    passwordHash: hashPassword(password),
    role: "admin" as const,
    inbox: [],
  };
  db.users.set(id, user);
  const token = signToken({ uid: id, ts: Date.now() });
  res.json({ token, user: publicUser(user) });
};

export const login: RequestHandler = (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: "Missing fields" });
  const u = findUserByEmail(email);
  if (!u || u.passwordHash !== hashPassword(password))
    return res.status(401).json({ error: "Invalid credentials" });
  const token = signToken({ uid: u.id, ts: Date.now() });
  res.json({ token, user: publicUser(u) });
};

export const me: RequestHandler = (req, res) => {
  // This route will be wrapped with auth middleware to add req.user if present
  // If no user, return 401
  const anyReq = req as any;
  const u = anyReq.user;
  if (!u) return res.status(401).json({ error: "Unauthorized" });
  res.json({ user: publicUser(u) });
};

export const updateProfile: RequestHandler = (req, res) => {
  const areq = req as any;
  if (!areq.user) return res.status(401).json({ error: "Unauthorized" });
  const { name, password, avatarBase64 } = req.body || {};
  const user = areq.user as any;
  if (typeof name === "string" && name.trim()) user.name = name.trim();
  if (typeof password === "string" && password.trim())
    user.passwordHash = hashPassword(password);
  if (typeof avatarBase64 === "string" && avatarBase64.trim())
    user.avatar = avatarBase64;
  // persist into in-memory DB
  const stored = db.users.get(user.id);
  if (stored) {
    stored.name = user.name;
    if (user.passwordHash) stored.passwordHash = user.passwordHash;
    if (user.avatar) stored.avatar = user.avatar;
    db.users.set(user.id, stored);
  }
  res.json({ user: publicUser(user) });
};

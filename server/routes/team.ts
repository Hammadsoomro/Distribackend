import type { RequestHandler } from "express";
import { db, hashPassword, newId, publicUser } from "../store";
import { requireUser, AuthedRequest } from "../auth";

export const listTeam: RequestHandler = (req, res) => {
  if (!requireUser(req as AuthedRequest, res)) return;
  const members = Array.from(db.users.values()).map(publicUser);
  res.json({ members });
};

export const createMember: RequestHandler = (req, res) => {
  if (!requireUser(req as AuthedRequest, res, "admin")) return;
  const { name, email, password } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: "Missing fields" });
  for (const u of db.users.values())
    if (u.email.toLowerCase() === email.toLowerCase())
      return res.status(400).json({ error: "Email already in use" });
  const id = newId("user");
  const user = {
    id,
    name,
    email,
    passwordHash: hashPassword(password),
    role: "member" as const,
    inbox: [],
  };
  db.users.set(id, user);
  res.json({ member: publicUser(user) });
};

export const deleteMember: RequestHandler = (req, res) => {
  if (!requireUser(req as AuthedRequest, res, "admin")) return;
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "Missing id" });
  const user = db.users.get(id);
  if (!user || user.role !== "member")
    return res.status(404).json({ error: "Not found" });
  db.users.delete(id);
  res.json({ ok: true });
};

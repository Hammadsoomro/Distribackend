import type { RequestHandler } from "express";
import { AuthedRequest, requireUser } from "../auth";

export const getInbox: RequestHandler = (req, res) => {
  const areq = req as AuthedRequest;
  if (!requireUser(areq, res)) return;
  res.json({ inbox: areq.user!.inbox });
};

export const clearInbox: RequestHandler = (req, res) => {
  const areq = req as AuthedRequest;
  if (!requireUser(areq, res)) return;
  areq.user!.inbox = [];
  res.json({ ok: true });
};

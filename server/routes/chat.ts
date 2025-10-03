import type { RequestHandler } from "express";
import { db, newId } from "../store";
import { AuthedRequest, requireUser } from "../auth";

export const listConversations: RequestHandler = (req, res) => {
  const areq = req as AuthedRequest;
  if (!requireUser(areq, res)) return;
  const userId = areq.user!.id;
  const conversations = Array.from(db.conversations.values())
    .filter((c) => c.participantIds.includes(userId))
    .map((c) => {
      const last = c.messages[c.messages.length - 1];
      const unreadCount = c.messages.filter(
        (m) => !m.readBy.includes(userId),
      ).length;
      return {
        id: c.id,
        name: c.name,
        participantIds: c.participantIds,
        isGroup: c.isGroup,
        lastMessage: last,
        unreadCount,
      };
    });
  res.json({ conversations });
};

export const createConversation: RequestHandler = (req, res) => {
  const areq = req as AuthedRequest;
  if (!requireUser(areq, res)) return;
  const { participantIds, isGroup, name } = req.body || {};
  const provided = Array.isArray(participantIds) ? participantIds : [];
  const all = Array.from(new Set([areq.user!.id, ...provided]));
  if (all.length === 0)
    return res.status(400).json({ error: "Invalid participants" });

  // If this is a 1-on-1, check for existing conversation between the two participants and reuse it
  if (!isGroup && all.length === 2) {
    const [a, b] = all;
    for (const c of db.conversations.values()) {
      if (
        !c.isGroup &&
        c.participantIds.length === 2 &&
        c.participantIds.includes(a) &&
        c.participantIds.includes(b)
      ) {
        return res.json({
          conversation: {
            id: c.id,
            name: c.name,
            participantIds: c.participantIds,
            isGroup: c.isGroup,
          },
        });
      }
    }
  }

  const id = newId("conv");
  const conv = {
    id,
    name: name || undefined,
    participantIds: all,
    isGroup: !!isGroup,
    messages: [],
  };
  db.conversations.set(id, conv);
  res.json({
    conversation: {
      id: conv.id,
      name: conv.name,
      participantIds: conv.participantIds,
      isGroup: conv.isGroup,
    },
  });
};

export const getConversation: RequestHandler = (req, res) => {
  const areq = req as AuthedRequest;
  if (!requireUser(areq, res)) return;
  const { id } = req.params;
  const conv = id ? db.conversations.get(id) : undefined;
  if (!conv || !conv.participantIds.includes(areq.user!.id))
    return res.status(404).json({ error: "Not found" });
  res.json({ messages: conv.messages });
};

export const sendMessage: RequestHandler = (req, res) => {
  const areq = req as AuthedRequest;
  if (!requireUser(areq, res)) return;
  const { conversationId, text } = req.body || {};
  if (!conversationId || typeof text !== "string")
    return res.status(400).json({ error: "Invalid" });
  const conv = db.conversations.get(conversationId);
  if (!conv || !conv.participantIds.includes(areq.user!.id))
    return res.status(404).json({ error: "Not found" });
  const msgId = newId("msg");
  const msg = {
    id: msgId,
    text,
    fromId: areq.user!.id,
    ts: Date.now(),
    readBy: [areq.user!.id],
    conversationId,
  };
  conv.messages.push(msg);
  db.messages.set(msgId, msg);
  // Also push to inbox of participants who are not in the conversation? Keep conversations separate. Notify participants via their inbox as well for compatibility
  for (const pid of conv.participantIds) {
    const u = db.users.get(pid);
    if (!u) continue;
    if (pid !== areq.user!.id) {
      u.inbox.push(msg);
    }
  }
  res.json({ message: msg });
};

export const markConversationRead: RequestHandler = (req, res) => {
  const areq = req as AuthedRequest;
  if (!requireUser(areq, res)) return;
  const { conversationId } = req.body || {};
  if (!conversationId)
    return res.status(400).json({ error: "Missing conversationId" });
  const conv = db.conversations.get(conversationId);
  if (!conv) return res.status(404).json({ error: "Not found" });
  for (const m of conv.messages) {
    if (!m.readBy.includes(areq.user!.id)) m.readBy.push(areq.user!.id);
  }
  res.json({ ok: true });
};

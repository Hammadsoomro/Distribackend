import "dotenv/config";
import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { authMiddleware } from "./auth";
import { adminSetup, login, me, updateProfile } from "./routes/auth";
import { listTeam, createMember, deleteMember } from "./routes/team";
import {
  createJob,
  listJobs,
  getJob,
  cancelJob,
  listQueues,
} from "./routes/distributor";
import { getInbox, clearInbox } from "./routes/inbox";
import {
  listConversations,
  createConversation,
  getConversation,
  sendMessage,
  markConversationRead,
} from "./routes/chat";
import { connectDB } from "./db";

export function createServer() {
  const app = express();

  // Connect to DB (async)
  connectDB().catch((err) => console.error("DB connect error", err));

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(authMiddleware);

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Auth
  app.post("/api/auth/admin-setup", adminSetup);
  app.post("/api/auth/login", login);
  app.get("/api/auth/me", me);
  app.post("/api/auth/update", updateProfile);

  // Team management (admin)
  app.get("/api/team", listTeam);
  app.post("/api/team", createMember);
  app.delete("/api/team/:id", deleteMember);

  // Distributor jobs (admin)
  app.post("/api/distribute", createJob);
  app.get("/api/jobs", listJobs);
  app.get("/api/jobs/history", listQueues);
  app.get("/api/jobs/:id", getJob);
  app.post("/api/jobs/:id/cancel", cancelJob);

  // Inbox (member or admin)
  app.get("/api/inbox", getInbox);
  app.post("/api/inbox/clear", clearInbox);
  app.post("/api/inbox/mark-read", (req, res) => {
    // Mark message ids as read in user's inbox
    const areq: any = req as any;
    if (!areq.user) return res.status(401).json({ error: "Unauthorized" });
    const { messageIds } = req.body || {};
    const user = areq.user;
    if (!messageIds) {
      // mark all
      user.inbox.forEach((m: any) => {
        if (!m.readBy.includes(user.id)) m.readBy.push(user.id);
      });
    } else if (Array.isArray(messageIds)) {
      user.inbox.forEach((m: any) => {
        if (messageIds.includes(m.id) && !m.readBy.includes(user.id))
          m.readBy.push(user.id);
      });
    }
    res.json({ ok: true });
  });

  // Chat endpoints
  app.get("/api/chat", listConversations);
  app.post("/api/chat", createConversation);
  app.get("/api/chat/:id", getConversation);
  app.post("/api/chat/send", sendMessage);
  app.post("/api/chat/mark-read", markConversationRead);

  return app;
}

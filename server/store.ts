import crypto from "crypto";

export type Role = "admin" | "member";

export interface Message {
  id: string;
  text: string;
  fromId: string | null; // null for system
  ts: number;
  readBy: string[]; // user ids who have read
  conversationId?: string;
}

export interface Conversation {
  id: string;
  name?: string;
  participantIds: string[];
  isGroup: boolean;
  messages: Message[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  inbox: Message[]; // direct messages / system messages
  avatar?: string | null; // data URL or image URL
}

export interface DistributionJob {
  id: string;
  ownerId: string; // admin id
  createdAt: number;
  intervalSec: number; // 30 | 40 | 50
  linesPerTick: number; // 1 | 3 | 5
  targets: string[]; // user ids
  textLines: string[];
  nextIndex: number; // next line index to send
  status: "running" | "completed" | "cancelled";
  _timer?: NodeJS.Timer; // internal
}

export const db = {
  users: new Map<string, User>(),
  jobs: new Map<string, DistributionJob>(),
  conversations: new Map<string, Conversation>(),
  messages: new Map<string, Message>(),
};

export function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function newId(prefix = "id") {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function findUserByEmail(email: string) {
  for (const u of db.users.values()) {
    if (u.email.toLowerCase() === email.toLowerCase()) return u;
  }
  return undefined;
}

export function adminExists() {
  for (const u of db.users.values()) {
    if (u.role === "admin") return true;
  }
  return false;
}

export function publicUser(u: User) {
  const { passwordHash } = u;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    inboxCount: u.inbox.length,
    unreadCount: u.inbox.filter((m) => !m.readBy.includes(u.id)).length,
    avatar: u.avatar || null,
  };
}

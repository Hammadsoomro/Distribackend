/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

export type Role = "admin" | "member";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  inboxCount: number;
  unreadCount: number;
  avatar?: string | null;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface TeamListResponse {
  members: PublicUser[];
}

export interface Message {
  id: string;
  text: string;
  fromId: string | null;
  ts: number;
  readBy: string[];
  conversationId?: string;
}

export interface Conversation {
  id: string;
  name?: string;
  participantIds: string[];
  isGroup: boolean;
}

export interface ConversationSummary {
  id: string;
  name?: string;
  participantIds: string[];
  isGroup: boolean;
  unreadCount: number;
  lastMessage?: Message;
}

export interface CreateConversationRequest {
  participantIds: string[];
  isGroup?: boolean;
  name?: string;
}

export interface SendMessageRequest {
  conversationId: string;
  text: string;
}

export interface ConversationResponse {
  messages: Message[];
}
export interface ConversationsListResponse {
  conversations: ConversationSummary[];
}

export interface CreateMemberRequest {
  name: string;
  email: string;
  password: string;
}

export interface QueueItem {
  lineNumber: number;
  line: string;
  userId: string;
  status: "sent" | "pending" | "failed";
  sentAt?: number;
}

export interface Job {
  id: string;
  ownerId: string;
  createdAt: number;
  intervalSec: number;
  linesPerTick: number;
  targets: string[];
  textLines: string[];
  nextIndex: number;
  status: "running" | "completed" | "cancelled";
  queue?: QueueItem[];
}

export interface CreateJobRequest {
  text: string;
  intervalSec: 1 | 30 | 60 | 120 | 180 | 240 | 300;
  linesPerTick: 1 | 3 | 5 | 7 | 10 | 12 | 15;
  targetIds: string[];
}

export interface JobsListResponse {
  jobs: Job[];
}
export interface JobResponse {
  job: Job;
}

export interface JobQueueHistoryResponse {
  jobs: { id: string; status: Job["status"]; queue: QueueItem[] }[];
}

export interface InboxResponse {
  inbox: string[];
}

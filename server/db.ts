import mongoose, { Schema, Document } from "mongoose";

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

export async function connectDB() {
  if (!uri) {
    console.warn("MONGO_URI not set; skipping MongoDB connection");
    return;
  }
  try {
    await mongoose.connect(uri, {
      // useNewUrlParser etc are defaults in modern mongoose
    } as any);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    throw err;
  }
}

// Schemas
const MessageSchema = new Schema({
  text: { type: String, required: true },
  fromId: { type: String, default: null },
  ts: { type: Number, default: () => Date.now() },
  readBy: { type: [String], default: [] },
  conversationId: { type: String, default: null },
});

const ConversationSchema = new Schema({
  name: { type: String },
  participantIds: { type: [String], default: [] },
  isGroup: { type: Boolean, default: false },
  messages: { type: [MessageSchema], default: [] },
});

const UserSchema = new Schema({
  name: String,
  email: { type: String, index: true, unique: true },
  passwordHash: String,
  role: { type: String, enum: ["admin", "member"], default: "member" },
  inbox: { type: [MessageSchema], default: [] },
});

const JobSchema = new Schema({
  jobId: { type: String, index: true },
  ownerId: String,
  createdAt: Number,
  intervalSec: Number,
  linesPerTick: Number,
  targets: [String],
  textLines: [String],
  nextIndex: Number,
  status: { type: String, enum: ["running", "completed", "cancelled"] },
  queue: {
    type: [
      new Schema(
        {
          lineNumber: Number,
          line: String,
          userId: String,
          status: { type: String, enum: ["sent", "pending", "failed"], default: "pending" },
          sentAt: { type: Number },
        },
        { _id: false }
      ),
    ],
    default: [],
  },
});

export const MessageModel = mongoose.model("Message", MessageSchema);
export const ConversationModel = mongoose.model(
  "Conversation",
  ConversationSchema,
);
export const UserModel = mongoose.model("User", UserSchema);
export const JobModel = mongoose.model("Job", JobSchema);

export default mongoose;

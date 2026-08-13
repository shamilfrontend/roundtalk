import { Schema, Types, model } from "mongoose";

export interface ChatMessageDoc {
  roomId: string;
  senderDisplayName: string;
  senderUserId?: Types.ObjectId;
  text: string;
  createdAt: Date;
}

const chatMessageSchema = new Schema<ChatMessageDoc>(
  {
    roomId: { type: String, required: true, index: true },
    senderDisplayName: { type: String, required: true },
    senderUserId: { type: Schema.Types.ObjectId, ref: "User" },
    text: { type: String, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

chatMessageSchema.index({ roomId: 1, createdAt: -1 });

export const ChatMessageModel = model<ChatMessageDoc>(
  "ChatMessage",
  chatMessageSchema,
);

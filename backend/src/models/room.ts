import { Schema, Types, model } from "mongoose";
import type { ParticipantRole, RoomStatus } from "../types/room.js";

export interface ParticipantDoc {
  userId?: Types.ObjectId;
  displayName: string;
  role: ParticipantRole;
  isMuted: boolean;
  isCameraOff: boolean;
  isHandRaised: boolean;
  socketId?: string;
}

export interface RoomDoc {
  roomId: string;
  title: string;
  status: RoomStatus;
  hostId: Types.ObjectId;
  endedAt: Date | null;
  createdAt: Date;
  participants: ParticipantDoc[];
}

const participantSchema = new Schema<ParticipantDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    displayName: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ["host", "participant"],
    },
    isMuted: { type: Boolean, required: true, default: false },
    isCameraOff: { type: Boolean, required: true, default: false },
    isHandRaised: { type: Boolean, required: true, default: false },
    socketId: { type: String },
  },
  { _id: false },
);

const roomSchema = new Schema<RoomDoc>(
  {
    roomId: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    status: {
      type: String,
      required: true,
      enum: ["live", "ended"],
    },
    hostId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    endedAt: { type: Date, default: null },
    participants: { type: [participantSchema], default: [] },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

export const RoomModel = model<RoomDoc>("Room", roomSchema);

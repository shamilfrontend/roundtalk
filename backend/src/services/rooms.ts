import { Types } from "mongoose";
import { ChatMessageModel } from "../models/chat-message.js";
import { RoomModel, type ParticipantDoc, type RoomDoc } from "../models/room.js";
import type {
  ChatMessagePublic,
  ParticipantPublic,
  RoomListItem,
  RoomPublic,
} from "../types/room.js";
import { HttpError } from "../utils/http-error.js";
import { createRoomId } from "../utils/ids.js";
import { DURATION_MIN_DEFAULT, MAX_ROOM_PARTICIPANTS } from "../utils/validate.js";

const CHAT_HISTORY_LIMIT = 100;

function toRoomPublic(room: RoomDoc): RoomPublic {
  return {
    roomId: room.roomId,
    title: room.title,
    status: room.status,
    scheduledAt: room.scheduledAt ? room.scheduledAt.toISOString() : null,
    hostId: String(room.hostId),
  };
}

export function toRoomListItem(room: RoomDoc): RoomListItem {
  return {
    ...toRoomPublic(room),
    durationMin: room.durationMin,
    createdAt: room.createdAt.toISOString(),
    endedAt: room.endedAt ? room.endedAt.toISOString() : null,
  };
}

export function toParticipantPublic(participant: ParticipantDoc): ParticipantPublic {
  const result: ParticipantPublic = {
    displayName: participant.displayName,
    role: participant.role,
    isMuted: participant.isMuted,
    isCameraOff: participant.isCameraOff,
    isHandRaised: participant.isHandRaised,
  };

  if (participant.userId !== undefined) {
    result.userId = String(participant.userId);
  }

  if (participant.socketId !== undefined) {
    result.socketId = participant.socketId;
  }

  return result;
}

function toChatMessagePublic(doc: {
  _id: Types.ObjectId;
  roomId: string;
  senderDisplayName: string;
  senderUserId?: Types.ObjectId;
  text: string;
  createdAt: Date;
}): ChatMessagePublic {
  const result: ChatMessagePublic = {
    id: String(doc._id),
    roomId: doc.roomId,
    senderDisplayName: doc.senderDisplayName,
    text: doc.text,
    createdAt: doc.createdAt.toISOString(),
  };

  if (doc.senderUserId !== undefined) {
    result.senderUserId = String(doc.senderUserId);
  }

  return result;
}

function sameIdentity(
  participant: ParticipantDoc,
  userId: string | undefined,
  displayName: string,
): boolean {
  if (userId !== undefined && participant.userId !== undefined) {
    return String(participant.userId) === userId;
  }

  if (userId === undefined && participant.userId === undefined) {
    return participant.displayName === displayName;
  }

  return false;
}

export async function createRoom(input: {
  hostId: string;
  title?: string | undefined;
  scheduledAt?: Date | undefined;
  durationMin?: number | undefined;
}): Promise<RoomListItem> {
  const scheduledAt = input.scheduledAt;
  const room = await RoomModel.create({
    roomId: createRoomId(),
    title: input.title ?? "Встреча",
    status: scheduledAt === undefined ? "live" : "scheduled",
    hostId: new Types.ObjectId(input.hostId),
    scheduledAt: scheduledAt ?? null,
    durationMin: input.durationMin ?? DURATION_MIN_DEFAULT,
    endedAt: null,
    participants: [],
  });

  return toRoomListItem(room.toObject());
}

export async function listHostRooms(hostId: string): Promise<RoomListItem[]> {
  const rooms = await RoomModel.find({ hostId: new Types.ObjectId(hostId) })
    .sort({ createdAt: -1 })
    .lean();

  return rooms.map((room) => toRoomListItem(room));
}

export async function getPublicRoom(roomId: string): Promise<RoomPublic> {
  const room = await RoomModel.findOne({ roomId }).lean();

  if (!room) {
    throw new HttpError(404, "room_not_found", "Комната не найдена");
  }

  return toRoomPublic(room);
}

export async function updateScheduledRoom(input: {
  roomId: string;
  hostId: string;
  title?: string | undefined;
  scheduledAt?: Date | undefined;
  durationMin?: number | undefined;
}): Promise<RoomListItem> {
  const room = await RoomModel.findOne({ roomId: input.roomId });

  if (!room) {
    throw new HttpError(404, "room_not_found", "Комната не найдена");
  }

  if (String(room.hostId) !== input.hostId) {
    throw new HttpError(403, "forbidden", "Недостаточно прав");
  }

  if (room.status !== "scheduled") {
    throw new HttpError(409, "room_not_scheduled", "Комнату уже нельзя изменить");
  }

  if (input.title !== undefined) {
    room.title = input.title;
  }

  if (input.scheduledAt !== undefined) {
    room.scheduledAt = input.scheduledAt;
  }

  if (input.durationMin !== undefined) {
    room.durationMin = input.durationMin;
  }

  await room.save();

  return toRoomListItem(room.toObject());
}

export async function endRoomByHost(
  roomId: string,
  hostId: string,
): Promise<RoomListItem> {
  const room = await RoomModel.findOne({ roomId });

  if (!room) {
    throw new HttpError(404, "room_not_found", "Комната не найдена");
  }

  if (String(room.hostId) !== hostId) {
    throw new HttpError(403, "forbidden", "Недостаточно прав");
  }

  room.status = "ended";
  room.endedAt = new Date();
  room.participants = [];
  await room.save();

  return toRoomListItem(room.toObject());
}

export async function loadRecentMessages(
  roomId: string,
): Promise<ChatMessagePublic[]> {
  const rows = await ChatMessageModel.find({ roomId })
    .sort({ createdAt: -1 })
    .limit(CHAT_HISTORY_LIMIT)
    .lean();

  return rows.reverse().map((row) => toChatMessagePublic(row));
}

export async function saveChatMessage(input: {
  roomId: string;
  senderDisplayName: string;
  senderUserId?: string;
  text: string;
}): Promise<ChatMessagePublic> {
  const created = await ChatMessageModel.create({
    roomId: input.roomId,
    senderDisplayName: input.senderDisplayName,
    text: input.text,
    ...(input.senderUserId !== undefined
      ? { senderUserId: new Types.ObjectId(input.senderUserId) }
      : {}),
  });

  return toChatMessagePublic(created.toObject());
}

export async function joinRoom(input: {
  roomId: string;
  displayName: string;
  userId?: string;
  socketId: string;
}): Promise<{
  room: RoomListItem;
  participant: ParticipantPublic;
  participants: ParticipantPublic[];
  replacedSocketId: string | null;
  messages: ChatMessagePublic[];
}> {
  const room = await RoomModel.findOne({ roomId: input.roomId });

  if (!room) {
    throw new HttpError(404, "room_not_found", "Комната не найдена");
  }

  if (room.status === "ended") {
    throw new HttpError(400, "room-ended", "Комната завершена");
  }

  const isHost =
    input.userId !== undefined && String(room.hostId) === input.userId;

  if (room.status === "scheduled") {
    const now = new Date();

    if (room.scheduledAt !== null && now < room.scheduledAt && !isHost) {
      throw new HttpError(403, "room-not-started", "Комната ещё не началась");
    }

    room.status = "live";
  }

  const existingIndex = room.participants.findIndex((participant) =>
    sameIdentity(participant, input.userId, input.displayName),
  );

  if (existingIndex === -1 && room.participants.length >= MAX_ROOM_PARTICIPANTS) {
    throw new HttpError(403, "room-full", "В комнате нет мест");
  }

  const existing =
    existingIndex >= 0 ? room.participants[existingIndex] : undefined;

  const nextParticipant: ParticipantDoc = {
    displayName: input.displayName,
    role: isHost ? "host" : "participant",
    isMuted: existing?.isMuted ?? false,
    isCameraOff: existing?.isCameraOff ?? false,
    isHandRaised: existing?.isHandRaised ?? false,
    socketId: input.socketId,
  };

  if (input.userId !== undefined) {
    nextParticipant.userId = new Types.ObjectId(input.userId);
  }

  let replacedSocketId: string | null = null;

  if (existing !== undefined && existingIndex >= 0) {
    if (
      existing.socketId !== undefined &&
      existing.socketId !== input.socketId
    ) {
      replacedSocketId = existing.socketId;
    }

    nextParticipant.role =
      existing.role === "host" || isHost ? "host" : "participant";
    room.participants[existingIndex] = nextParticipant;
  } else {
    room.participants.push(nextParticipant);
  }

  await room.save();

  const saved = room.toObject();
  const messages = await loadRecentMessages(input.roomId);

  return {
    room: toRoomListItem(saved),
    participant: toParticipantPublic(nextParticipant),
    participants: saved.participants.map((item) => toParticipantPublic(item)),
    replacedSocketId,
    messages,
  };
}

export async function leaveBySocketId(socketId: string): Promise<{
  roomId: string;
  participant: ParticipantPublic;
  roomEnded: boolean;
} | null> {
  const room = await RoomModel.findOne({ "participants.socketId": socketId });

  if (!room) {
    return null;
  }

  const participant = room.participants.find((item) => item.socketId === socketId);

  if (!participant) {
    return null;
  }

  const publicParticipant = toParticipantPublic(participant);

  room.participants = room.participants.filter(
    (item) => item.socketId !== socketId,
  );

  let roomEnded = false;
  const isInstant = room.scheduledAt === null;

  if (isInstant && room.status === "live" && room.participants.length === 0) {
    room.status = "ended";
    room.endedAt = new Date();
    roomEnded = true;
  }

  await room.save();

  return {
    roomId: room.roomId,
    participant: publicParticipant,
    roomEnded,
  };
}

export async function updateParticipantState(
  roomId: string,
  socketId: string,
  patch: {
    isMuted?: boolean;
    isCameraOff?: boolean;
    isHandRaised?: boolean;
  },
): Promise<ParticipantPublic | null> {
  const room = await RoomModel.findOne({ roomId });

  if (!room) {
    return null;
  }

  const participant = room.participants.find((item) => item.socketId === socketId);

  if (!participant) {
    return null;
  }

  if (patch.isMuted !== undefined) {
    participant.isMuted = patch.isMuted;
  }

  if (patch.isCameraOff !== undefined) {
    participant.isCameraOff = patch.isCameraOff;
  }

  if (patch.isHandRaised !== undefined) {
    participant.isHandRaised = patch.isHandRaised;
  }

  await room.save();

  return toParticipantPublic(participant);
}

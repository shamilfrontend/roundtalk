export type RoomStatus = "live" | "ended";

export type ParticipantRole = "host" | "participant";

export interface ParticipantPublic {
  userId?: string;
  displayName: string;
  role: ParticipantRole;
  isMuted: boolean;
  isCameraOff: boolean;
  isHandRaised: boolean;
  socketId?: string;
}

export interface RoomPublic {
  roomId: string;
  title: string;
  status: RoomStatus;
  hostId: string;
}

export interface RoomListItem extends RoomPublic {
  createdAt: string;
  endedAt: string | null;
}

export interface ChatMessagePublic {
  id: string;
  roomId: string;
  senderDisplayName: string;
  senderUserId?: string;
  text: string;
  createdAt: string;
}

export interface RoomStatePayload {
  room: RoomListItem;
  participants: ParticipantPublic[];
  messages: ChatMessagePublic[];
  screenShareSocketId: string | null;
}

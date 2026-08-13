import type { ChatMessagePublic, ParticipantPublic, RoomStatePayload } from "./room.js";

export interface ServerToClientEvents {
  "room-state": (payload: RoomStatePayload) => void;
  "user-joined": (participant: ParticipantPublic) => void;
  "user-left": (participant: ParticipantPublic) => void;
  "user-replaced": () => void;
  "chat-message": (message: ChatMessagePublic) => void;
  reaction: (payload: { socketId: string; emoji: string }) => void;
  "hand-raised": (payload: { socketId: string; raised: boolean }) => void;
  "media-state": (payload: {
    socketId: string;
    isMuted: boolean;
    isCameraOff: boolean;
  }) => void;
  "screen-share": (payload: { socketId: string; active: boolean }) => void;
  "room-ended": () => void;
  error: (payload: { code: string; message: string }) => void;
  "webrtc-offer": (payload: { fromSocketId: string; sdp: string }) => void;
  "webrtc-answer": (payload: { fromSocketId: string; sdp: string }) => void;
  "webrtc-ice": (payload: { fromSocketId: string; candidate: unknown }) => void;
}

export interface ClientToServerEvents {
  "join-room": (payload: { roomId: string; displayName: string }) => void;
  "webrtc-offer": (payload: { toSocketId: string; sdp: string }) => void;
  "webrtc-answer": (payload: { toSocketId: string; sdp: string }) => void;
  "webrtc-ice": (payload: { toSocketId: string; candidate: unknown }) => void;
  "chat-message": (payload: { text: string }) => void;
  reaction: (payload: { emoji: string }) => void;
  "raise-hand": (payload: { raised: boolean }) => void;
  "media-state": (payload: { isMuted: boolean; isCameraOff: boolean }) => void;
  "screen-share": (payload: { active: boolean }) => void;
  "leave-room": () => void;
}

export interface SocketData {
  userId?: string | undefined;
  roomId?: string | undefined;
  displayName?: string | undefined;
}

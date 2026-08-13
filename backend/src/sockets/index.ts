import type { Server as HttpServer } from "node:http";
import type { Socket } from "socket.io";
import {
  joinRoom,
  leaveBySocketId,
  saveChatMessage,
  updateParticipantState,
} from "../services/rooms.js";
import { findUserById } from "../services/users.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../types/socket.js";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  parseCookieHeader,
} from "../utils/cookies.js";
import { HttpError } from "../utils/http-error.js";
import { isRecord } from "../utils/json.js";
import { verifyToken, type JwtTokenType } from "../utils/jwt.js";
import {
  validateChatText,
  validateDisplayName,
  validateEmoji,
  validateRoomId,
} from "../utils/validate.js";
import {
  cleanupSocketMedia,
  consumeReactionSlot,
  createIo,
  getIo,
  getScreenShareSocketId,
  setIo,
  stopScreenShare,
  tryStartScreenShare,
  type IoServer,
} from "./io.js";

type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

const LEAVE_GRACE_MS = 10_000;

interface PendingLeave {
  timer: ReturnType<typeof setTimeout>;
}

const pendingLeaves = new Map<string, PendingLeave>();

function identityKey(
  roomId: string,
  userId: string | undefined,
  displayName: string,
): string {
  if (userId !== undefined) {
    return `${roomId}:u:${userId}`;
  }

  return `${roomId}:g:${displayName}`;
}

function cancelPendingLeave(key: string): void {
  const pending = pendingLeaves.get(key);

  if (pending === undefined) {
    return;
  }

  clearTimeout(pending.timer);
  pendingLeaves.delete(key);
}

function socketIdentityKey(socket: AppSocket): string | null {
  const roomId = socket.data.roomId;
  const displayName = socket.data.displayName;

  if (roomId === undefined || displayName === undefined) {
    return null;
  }

  return identityKey(roomId, socket.data.userId, displayName);
}

function emitError(socket: AppSocket, error: unknown): void {
  if (error instanceof HttpError) {
    socket.emit("error", { code: error.code, message: error.message });
    return;
  }

  socket.emit("error", {
    code: "internal",
    message: "Внутренняя ошибка сервера",
  });
}

function requireRoomId(socket: AppSocket): string {
  const roomId = socket.data.roomId;

  if (roomId === undefined) {
    throw new HttpError(400, "not-in-room", "Сначала войдите в комнату");
  }

  return roomId;
}

function requireDisplayName(socket: AppSocket): string {
  const displayName = socket.data.displayName;

  if (displayName === undefined) {
    throw new HttpError(400, "not-in-room", "Сначала войдите в комнату");
  }

  return displayName;
}

function asBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new HttpError(400, "invalid_payload", `Некорректное поле ${field}`);
  }

  return value;
}

function readHandshakeCookie(socket: AppSocket, name: string): string | undefined {
  return parseCookieHeader(socket.handshake.headers.cookie, name);
}

function readHandshakeAccessToken(socket: AppSocket): string | undefined {
  const auth = socket.handshake.auth;

  if (isRecord(auth) && typeof auth.token === "string" && auth.token.length > 0) {
    return auth.token;
  }

  return readHandshakeCookie(socket, ACCESS_COOKIE);
}

async function userIdFromToken(
  token: string,
  type: JwtTokenType,
): Promise<string | undefined> {
  try {
    const payload = verifyToken(token, type);
    const user = await findUserById(payload.sub);

    return user?.id;
  } catch {
    return undefined;
  }
}

async function authenticateSocket(socket: AppSocket): Promise<void> {
  const access = readHandshakeAccessToken(socket);

  if (access !== undefined) {
    const userId = await userIdFromToken(access, "access");

    if (userId !== undefined) {
      socket.data.userId = userId;
      return;
    }
  }

  const refresh = readHandshakeCookie(socket, REFRESH_COOKIE);

  if (refresh === undefined) {
    return;
  }

  const userId = await userIdFromToken(refresh, "refresh");

  if (userId !== undefined) {
    socket.data.userId = userId;
  }
}

function relayToPeer(
  socket: AppSocket,
  toSocketId: string,
  emit: (target: AppSocket) => void,
): void {
  const roomId = requireRoomId(socket);

  if (toSocketId.length === 0) {
    throw new HttpError(400, "invalid_peer", "Некорректный участник");
  }

  const target = getIo().sockets.sockets.get(toSocketId);

  if (target === undefined || !target.rooms.has(roomId)) {
    throw new HttpError(400, "invalid_peer", "Участник не найден");
  }

  emit(target);
}

function stopShareIfActive(roomId: string | undefined, socketId: string): void {
  if (roomId === undefined) {
    return;
  }

  if (!cleanupSocketMedia(roomId, socketId)) {
    return;
  }

  getIo().to(roomId).emit("screen-share", {
    socketId,
    active: false,
  });
}

async function emitLeft(socketId: string): Promise<void> {
  const left = await leaveBySocketId(socketId);

  if (left === null) {
    return;
  }

  const io = getIo();

  io.to(left.roomId).except(socketId).emit("user-left", left.participant);

  if (left.roomEnded) {
    io.to(left.roomId).emit("room-ended");
  }
}

function scheduleLeave(socket: AppSocket): void {
  const key = socketIdentityKey(socket);

  if (key === null) {
    return;
  }

  cancelPendingLeave(key);

  const socketId = socket.id;
  const timer = setTimeout(() => {
    pendingLeaves.delete(key);
    void emitLeft(socketId).catch((error: unknown) => {
      console.error(error);
    });
  }, LEAVE_GRACE_MS);

  pendingLeaves.set(key, { timer });
}

async function handleLeave(socket: AppSocket): Promise<void> {
  const key = socketIdentityKey(socket);
  const roomId = socket.data.roomId;

  if (key !== null) {
    cancelPendingLeave(key);
  }

  stopShareIfActive(roomId, socket.id);
  await emitLeft(socket.id);

  if (roomId !== undefined) {
    void socket.leave(roomId);
  }

  socket.data.roomId = undefined;
  socket.data.displayName = undefined;
}

function registerHandlers(io: IoServer): void {
  io.use((socket, next) => {
    void authenticateSocket(socket)
      .then(() => {
        next();
      })
      .catch((error: unknown) => {
        if (error instanceof HttpError) {
          next(new Error(error.message));
          return;
        }

        next(new Error("unauthorized"));
      });
  });

  io.on("connection", (socket) => {
    socket.on("join-room", (payload) => {
      void (async () => {
        const roomId = validateRoomId(payload.roomId);
        const displayName = validateDisplayName(payload.displayName);

        cancelPendingLeave(
          identityKey(roomId, socket.data.userId, displayName),
        );

        const joined = await joinRoom({
          roomId,
          displayName,
          socketId: socket.id,
          ...(socket.data.userId !== undefined
            ? { userId: socket.data.userId }
            : {}),
        });

        if (joined.replacedSocketId !== null) {
          const previous = io.sockets.sockets.get(joined.replacedSocketId);

          previous?.emit("user-replaced");
          previous?.disconnect(true);
          socket.to(roomId).emit("user-left", {
            ...joined.participant,
            socketId: joined.replacedSocketId,
          });
        }

        socket.data.roomId = roomId;
        socket.data.displayName = displayName;
        await socket.join(roomId);

        socket.emit("room-state", {
          room: joined.room,
          participants: joined.participants,
          messages: joined.messages,
          screenShareSocketId: getScreenShareSocketId(roomId),
        });
        socket.to(roomId).emit("user-joined", joined.participant);
      })().catch((error: unknown) => {
        emitError(socket, error);
      });
    });

    socket.on("leave-room", () => {
      void handleLeave(socket).catch((error: unknown) => {
        emitError(socket, error);
      });
    });

    socket.on("disconnect", () => {
      stopShareIfActive(socket.data.roomId, socket.id);
      scheduleLeave(socket);
    });

    socket.on("chat-message", (payload) => {
      void (async () => {
        const roomId = requireRoomId(socket);
        const displayName = requireDisplayName(socket);
        const text = validateChatText(payload.text);
        const message = await saveChatMessage({
          roomId,
          senderDisplayName: displayName,
          text,
          ...(socket.data.userId !== undefined
            ? { senderUserId: socket.data.userId }
            : {}),
        });

        io.to(roomId).emit("chat-message", message);
      })().catch((error: unknown) => {
        emitError(socket, error);
      });
    });

    socket.on("reaction", (payload) => {
      try {
        const roomId = requireRoomId(socket);
        const emoji = validateEmoji(payload.emoji);

        if (!consumeReactionSlot(socket.id)) {
          throw new HttpError(429, "rate_limited", "Слишком часто");
        }

        io.to(roomId).emit("reaction", { socketId: socket.id, emoji });
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on("raise-hand", (payload) => {
      void (async () => {
        const roomId = requireRoomId(socket);
        const raised = asBoolean(payload.raised, "raised");
        const participant = await updateParticipantState(roomId, socket.id, {
          isHandRaised: raised,
        });

        if (!participant) {
          throw new HttpError(400, "not-in-room", "Сначала войдите в комнату");
        }

        io.to(roomId).emit("hand-raised", { socketId: socket.id, raised });
      })().catch((error: unknown) => {
        emitError(socket, error);
      });
    });

    socket.on("media-state", (payload) => {
      void (async () => {
        const roomId = requireRoomId(socket);
        const isMuted = asBoolean(payload.isMuted, "isMuted");
        const isCameraOff = asBoolean(payload.isCameraOff, "isCameraOff");
        const participant = await updateParticipantState(roomId, socket.id, {
          isMuted,
          isCameraOff,
        });

        if (!participant) {
          throw new HttpError(400, "not-in-room", "Сначала войдите в комнату");
        }

        io.to(roomId).emit("media-state", {
          socketId: socket.id,
          isMuted,
          isCameraOff,
        });
      })().catch((error: unknown) => {
        emitError(socket, error);
      });
    });

    socket.on("screen-share", (payload) => {
      try {
        const roomId = requireRoomId(socket);
        const active = asBoolean(payload.active, "active");

        if (active) {
          if (!tryStartScreenShare(roomId, socket.id)) {
            throw new HttpError(
              409,
              "share-already-active",
              "Демонстрация экрана уже идёт",
            );
          }
        } else {
          stopScreenShare(roomId, socket.id);
        }

        io.to(roomId).emit("screen-share", { socketId: socket.id, active });
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on("webrtc-offer", (payload) => {
      try {
        if (typeof payload.sdp !== "string") {
          throw new HttpError(400, "invalid_payload", "Некорректный SDP");
        }

        const sdp = payload.sdp;

        relayToPeer(socket, payload.toSocketId, (target) => {
          target.emit("webrtc-offer", { fromSocketId: socket.id, sdp });
        });
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on("webrtc-answer", (payload) => {
      try {
        if (typeof payload.sdp !== "string") {
          throw new HttpError(400, "invalid_payload", "Некорректный SDP");
        }

        const sdp = payload.sdp;

        relayToPeer(socket, payload.toSocketId, (target) => {
          target.emit("webrtc-answer", { fromSocketId: socket.id, sdp });
        });
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on("webrtc-ice", (payload) => {
      try {
        const candidate = payload.candidate;

        relayToPeer(socket, payload.toSocketId, (target) => {
          target.emit("webrtc-ice", { fromSocketId: socket.id, candidate });
        });
      } catch (error) {
        emitError(socket, error);
      }
    });
  });
}

export function attachSockets(httpServer: HttpServer): IoServer {
  const io = createIo(httpServer);

  setIo(io);
  registerHandlers(io);

  return io;
}

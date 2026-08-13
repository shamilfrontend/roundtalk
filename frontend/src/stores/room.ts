import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { io, type Socket } from "socket.io-client";
import { endRoom } from "@/api/rooms";
import { getApiErrorMessage, refreshSession } from "@/api/http";
import type {
  ChatMessagePublic,
  ParticipantPublic,
  RoomListItem,
} from "@/types/room";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/types/socket";

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

type RoomPhase = "idle" | "joining" | "joined";

type NoticeKind = "join" | "leave" | "chat" | "info";

export interface RoomNotice {
  id: number;
  kind: NoticeKind;
  text: string;
}

export interface TileReaction {
  emoji: string;
  token: number;
}

export interface WebrtcHandlers {
  onOffer: (fromSocketId: string, sdp: string) => void;
  onAnswer: (fromSocketId: string, sdp: string) => void;
  onIce: (fromSocketId: string, candidate: unknown) => void;
}

const NOTICE_TTL_MS = 3000;
const REACTION_TTL_MS = 2000;
const CHAT_TOAST_MAX = 80;

let socket: AppSocket | null = null;
let webrtcHandlers: WebrtcHandlers | null = null;
let activeJoin: { roomId: string; displayName: string } | null = null;
let noticeSeq = 0;
const noticeTimers = new Map<number, number>();
const reactionTimers = new Map<string, number>();

function getSocket(): AppSocket {
  if (socket === null) {
    socket = io(import.meta.env.VITE_SOCKET_URL, {
      withCredentials: true,
      autoConnect: false,
    });
  }

  return socket;
}

function upsertParticipant(
  list: ParticipantPublic[],
  participant: ParticipantPublic,
): ParticipantPublic[] {
  const socketId = participant.socketId;
  const next = list.filter((item) => item.socketId !== socketId);

  next.push(participant);

  return next;
}

function truncateChat(text: string): string {
  if (text.length <= CHAT_TOAST_MAX) {
    return text;
  }

  return `${text.slice(0, CHAT_TOAST_MAX - 1)}…`;
}

export const useRoomStore = defineStore("room", () => {
  const phase = ref<RoomPhase>("idle");
  const room = ref<RoomListItem | null>(null);
  const participants = ref<ParticipantPublic[]>([]);
  const messages = ref<ChatMessagePublic[]>([]);
  const selfSocketId = ref<string | null>(null);
  const error = ref<string | null>(null);
  const errorCode = ref<string | null>(null);
  const wasReplaced = ref(false);
  const wasEnded = ref(false);
  const joinedAt = ref<number | null>(null);
  const isEnding = ref(false);
  const isReconnecting = ref(false);
  const screenShareSocketId = ref<string | null>(null);
  const reactions = ref<Record<string, TileReaction>>({});
  const notices = ref<RoomNotice[]>([]);
  let reactionToken = 0;

  const selfParticipant = computed(() => {
    const id = selfSocketId.value;

    if (id === null) {
      return null;
    }

    return participants.value.find((item) => item.socketId === id) ?? null;
  });

  const remoteParticipants = computed(() => {
    const id = selfSocketId.value;

    return participants.value.filter((item) => item.socketId !== id);
  });

  const isHost = computed(() => selfParticipant.value?.role === "host");

  function clearError(): void {
    error.value = null;
    errorCode.value = null;
  }

  function clearNotices(): void {
    for (const timer of noticeTimers.values()) {
      window.clearTimeout(timer);
    }

    noticeTimers.clear();
    notices.value = [];
  }

  function clearReactions(): void {
    for (const timer of reactionTimers.values()) {
      window.clearTimeout(timer);
    }

    reactionTimers.clear();
    reactions.value = {};
  }

  function pushNotice(kind: NoticeKind, text: string): void {
    noticeSeq += 1;
    const id = noticeSeq;
    notices.value = [...notices.value, { id, kind, text }];

    const timer = window.setTimeout(() => {
      notices.value = notices.value.filter((item) => item.id !== id);
      noticeTimers.delete(id);
    }, NOTICE_TTL_MS);

    noticeTimers.set(id, timer);
  }

  function stopJoining(): void {
    activeJoin = null;
    isReconnecting.value = false;
  }

  function resetSession(): void {
    stopJoining();
    phase.value = "idle";
    room.value = null;
    participants.value = [];
    messages.value = [];
    selfSocketId.value = null;
    wasReplaced.value = false;
    wasEnded.value = false;
    joinedAt.value = null;
    isEnding.value = false;
    screenShareSocketId.value = null;
    clearReactions();
    clearNotices();
    clearError();
  }

  function bindSocket(instance: AppSocket): void {
    instance.removeAllListeners();

    instance.on("connect", () => {
      isReconnecting.value = false;

      if (activeJoin !== null) {
        instance.emit("join-room", activeJoin);
      }
    });

    instance.on("disconnect", () => {
      if (activeJoin === null || wasReplaced.value || wasEnded.value) {
        isReconnecting.value = false;
        return;
      }

      isReconnecting.value = true;
      void refreshSession().catch(() => undefined);
    });

    instance.on("room-state", (payload) => {
      room.value = payload.room;
      participants.value = payload.participants;
      messages.value = payload.messages;
      screenShareSocketId.value = payload.screenShareSocketId;
      selfSocketId.value = instance.id ?? null;
      phase.value = "joined";
      isReconnecting.value = false;

      if (joinedAt.value === null) {
        joinedAt.value = Date.now();
      }

      clearError();
    });

    instance.on("user-joined", (participant) => {
      participants.value = upsertParticipant(participants.value, participant);

      if (participant.socketId === selfSocketId.value) {
        return;
      }

      pushNotice("join", `${participant.displayName} присоединился`);
    });

    instance.on("user-left", (participant) => {
      participants.value = participants.value.filter(
        (item) => item.socketId !== participant.socketId,
      );

      if (screenShareSocketId.value === participant.socketId) {
        screenShareSocketId.value = null;
      }

      if (participant.socketId === selfSocketId.value) {
        return;
      }

      pushNotice("leave", `${participant.displayName} вышел`);
    });

    instance.on("user-replaced", () => {
      stopJoining();
      wasReplaced.value = true;
      phase.value = "idle";
    });

    instance.on("chat-message", (message) => {
      messages.value = [...messages.value, message];

      const selfName = selfParticipant.value?.displayName;

      if (selfName !== undefined && message.senderDisplayName === selfName) {
        return;
      }

      pushNotice(
        "chat",
        `${message.senderDisplayName}: ${truncateChat(message.text)}`,
      );
    });

    instance.on("hand-raised", (payload) => {
      participants.value = participants.value.map((item) => {
        if (item.socketId !== payload.socketId) {
          return item;
        }

        return { ...item, isHandRaised: payload.raised };
      });
    });

    instance.on("media-state", (payload) => {
      participants.value = participants.value.map((item) => {
        if (item.socketId !== payload.socketId) {
          return item;
        }

        return {
          ...item,
          isMuted: payload.isMuted,
          isCameraOff: payload.isCameraOff,
        };
      });
    });

    instance.on("screen-share", (payload) => {
      if (payload.active) {
        screenShareSocketId.value = payload.socketId;
        return;
      }

      if (screenShareSocketId.value === payload.socketId) {
        screenShareSocketId.value = null;
      }
    });

    instance.on("reaction", (payload) => {
      reactionToken += 1;
      const socketId = payload.socketId;
      const prevTimer = reactionTimers.get(socketId);

      if (prevTimer !== undefined) {
        window.clearTimeout(prevTimer);
      }

      reactions.value = {
        ...reactions.value,
        [socketId]: {
          emoji: payload.emoji,
          token: reactionToken,
        },
      };

      const timer = window.setTimeout(() => {
        const next = { ...reactions.value };
        delete next[socketId];
        reactions.value = next;
        reactionTimers.delete(socketId);
      }, REACTION_TTL_MS);

      reactionTimers.set(socketId, timer);
    });

    instance.on("room-ended", () => {
      stopJoining();
      wasEnded.value = true;
      phase.value = "idle";
    });

    instance.on("webrtc-offer", (payload) => {
      webrtcHandlers?.onOffer(payload.fromSocketId, payload.sdp);
    });

    instance.on("webrtc-answer", (payload) => {
      webrtcHandlers?.onAnswer(payload.fromSocketId, payload.sdp);
    });

    instance.on("webrtc-ice", (payload) => {
      webrtcHandlers?.onIce(payload.fromSocketId, payload.candidate);
    });

    instance.on("error", (payload) => {
      if (payload.code === "rate_limited" && phase.value === "joined") {
        pushNotice("info", "Слишком часто");
        return;
      }

      error.value = payload.message;
      errorCode.value = payload.code;

      if (payload.code === "room-ended") {
        stopJoining();
        wasEnded.value = true;
        phase.value = "idle";
        return;
      }

      if (phase.value === "joining") {
        phase.value = "idle";
        activeJoin = null;
      }
    });
  }

  function attachWebrtc(handlers: WebrtcHandlers | null): void {
    webrtcHandlers = handlers;
  }

  function sendOffer(toSocketId: string, sdp: string): void {
    getSocket().emit("webrtc-offer", { toSocketId, sdp });
  }

  function sendAnswer(toSocketId: string, sdp: string): void {
    getSocket().emit("webrtc-answer", { toSocketId, sdp });
  }

  function sendIce(toSocketId: string, candidate: RTCIceCandidateInit): void {
    getSocket().emit("webrtc-ice", { toSocketId, candidate });
  }

  function join(roomId: string, displayName: string): void {
    clearError();
    wasReplaced.value = false;
    wasEnded.value = false;
    isReconnecting.value = false;
    phase.value = "joining";
    activeJoin = { roomId, displayName };

    const instance = getSocket();

    bindSocket(instance);

    if (instance.connected) {
      instance.emit("join-room", activeJoin);
      return;
    }

    instance.connect();
  }

  function sendChat(text: string): void {
    getSocket().emit("chat-message", { text });
  }

  function setHandRaised(raised: boolean): void {
    getSocket().emit("raise-hand", { raised });
  }

  function setMediaState(isMuted: boolean, isCameraOff: boolean): void {
    getSocket().emit("media-state", { isMuted, isCameraOff });
  }

  function sendScreenShare(active: boolean): void {
    getSocket().emit("screen-share", { active });
  }

  function sendReaction(emoji: string): void {
    getSocket().emit("reaction", { emoji });
  }

  function leaveOnUnload(): void {
    const instance = getSocket();

    if (instance.connected) {
      instance.emit("leave-room");
    }

    stopJoining();
  }

  function leave(): void {
    const instance = getSocket();

    stopJoining();

    if (instance.connected) {
      instance.emit("leave-room");
      instance.disconnect();
    }

    instance.removeAllListeners();
    webrtcHandlers = null;
    resetSession();
  }

  async function endForEveryone(): Promise<void> {
    const current = room.value;

    if (current === null) {
      return;
    }

    isEnding.value = true;
    error.value = null;

    try {
      await endRoom(current.roomId);
      stopJoining();
      wasEnded.value = true;
      phase.value = "idle";
    } catch (err: unknown) {
      error.value = getApiErrorMessage(err, "Не удалось завершить комнату");
      throw err;
    } finally {
      isEnding.value = false;
    }
  }

  return {
    phase,
    room,
    participants,
    messages,
    selfSocketId,
    selfParticipant,
    remoteParticipants,
    isHost,
    error,
    errorCode,
    wasReplaced,
    wasEnded,
    joinedAt,
    isEnding,
    isReconnecting,
    screenShareSocketId,
    reactions,
    notices,
    join,
    sendChat,
    setHandRaised,
    setMediaState,
    sendScreenShare,
    sendReaction,
    attachWebrtc,
    sendOffer,
    sendAnswer,
    sendIce,
    leave,
    leaveOnUnload,
    endForEveryone,
    resetSession,
    clearError,
  };
});

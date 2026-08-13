import { ref, type Ref } from "vue";
import type { IceServer } from "@/api/turn";

export const ICE_FAILED_MESSAGE =
  "Не удалось установить медиа, проверьте сеть/TURN";

export interface WebrtcSignaling {
  sendOffer: (toSocketId: string, sdp: string) => void;
  sendAnswer: (toSocketId: string, sdp: string) => void;
  sendIce: (toSocketId: string, candidate: RTCIceCandidateInit) => void;
}

interface PeerSlot {
  pc: RTCPeerConnection;
  initiator: boolean;
  iceQueue: RTCIceCandidateInit[];
  remoteSet: boolean;
}

export interface WebrtcState {
  remoteStreams: Ref<Record<string, MediaStream>>;
  iceError: Ref<string | null>;
  setIceServers: (servers: IceServer[]) => void;
  setSignaling: (next: WebrtcSignaling | null) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  syncJoiner: (remoteIds: string[]) => Promise<void>;
  handleOffer: (fromSocketId: string, sdp: string) => Promise<void>;
  handleAnswer: (fromSocketId: string, sdp: string) => Promise<void>;
  handleIce: (fromSocketId: string, candidate: unknown) => Promise<void>;
  replaceLocalTracks: (stream: MediaStream | null) => Promise<void>;
  removePeer: (socketId: string) => void;
  prune: (activeIds: Set<string>) => void;
  stop: () => void;
  clearIceError: () => void;
}

function isIceCandidateInit(value: unknown): value is RTCIceCandidateInit {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if (
    !("candidate" in value) &&
    !("sdpMid" in value) &&
    !("sdpMLineIndex" in value)
  ) {
    return false;
  }

  if (
    "candidate" in value &&
    value.candidate !== undefined &&
    typeof value.candidate !== "string"
  ) {
    return false;
  }

  if (
    "sdpMid" in value &&
    value.sdpMid !== undefined &&
    value.sdpMid !== null &&
    typeof value.sdpMid !== "string"
  ) {
    return false;
  }

  if (
    "sdpMLineIndex" in value &&
    value.sdpMLineIndex !== undefined &&
    value.sdpMLineIndex !== null &&
    typeof value.sdpMLineIndex !== "number"
  ) {
    return false;
  }

  return true;
}

function toRtcIceServers(servers: IceServer[]): RTCIceServer[] {
  return servers.map((server) => {
    const next: RTCIceServer = { urls: server.urls };

    if (server.username !== undefined) {
      next.username = server.username;
    }

    if (server.credential !== undefined) {
      next.credential = server.credential;
    }

    return next;
  });
}

function findSender(
  pc: RTCPeerConnection,
  kind: "audio" | "video",
): RTCRtpSender | undefined {
  const byTrack = pc
    .getSenders()
    .find((item) => item.track?.kind === kind);

  if (byTrack !== undefined) {
    return byTrack;
  }

  const transceiver = pc
    .getTransceivers()
    .find((item) => item.receiver.track.kind === kind);

  return transceiver?.sender;
}

function attachLocalMedia(
  pc: RTCPeerConnection,
  stream: MediaStream | null,
): boolean {
  let needsRenegotiate = false;

  if (pc.getTransceivers().length === 0) {
    pc.addTransceiver("audio", { direction: "sendrecv" });
    pc.addTransceiver("video", { direction: "sendrecv" });
    needsRenegotiate = true;
  }

  if (stream === null) {
    return needsRenegotiate;
  }

  for (const kind of ["audio", "video"] as const) {
    const track =
      kind === "audio"
        ? (stream.getAudioTracks()[0] ?? null)
        : (stream.getVideoTracks()[0] ?? null);
    const sender = findSender(pc, kind);

    if (sender === undefined || track === null) {
      continue;
    }

    const hadTrack = sender.track !== null;
    void sender.replaceTrack(track);

    if (!hadTrack) {
      needsRenegotiate = true;
    }
  }

  return needsRenegotiate;
}

export function useWebrtc(): WebrtcState {
  const remoteStreams = ref<Record<string, MediaStream>>({});
  const iceError = ref<string | null>(null);
  const iceServers = ref<RTCIceServer[]>(
    toRtcIceServers([{ urls: "stun:stun.l.google.com:19302" }]),
  );
  const localStream = ref<MediaStream | null>(null);

  const peers = new Map<string, PeerSlot>();
  const pendingIce = new Map<string, RTCIceCandidateInit[]>();
  let signaling: WebrtcSignaling | null = null;
  let offeredForJoin = false;

  function setIceServers(servers: IceServer[]): void {
    iceServers.value = toRtcIceServers(servers);
  }

  function setSignaling(next: WebrtcSignaling | null): void {
    signaling = next;
  }

  function setLocalStream(stream: MediaStream | null): void {
    localStream.value = stream;
  }

  function clearIceError(): void {
    iceError.value = null;
  }

  function markFailed(): void {
    iceError.value = ICE_FAILED_MESSAGE;
  }

  async function flushIce(slot: PeerSlot, socketId: string): Promise<void> {
    const queued = [...slot.iceQueue, ...(pendingIce.get(socketId) ?? [])];
    slot.iceQueue = [];
    pendingIce.delete(socketId);

    for (const candidate of queued) {
      try {
        await slot.pc.addIceCandidate(candidate);
      } catch {
        continue;
      }
    }
  }

  function bindPeerEvents(socketId: string, pc: RTCPeerConnection): void {
    pc.onicecandidate = (event) => {
      if (event.candidate === null || signaling === null) {
        return;
      }

      signaling.sendIce(socketId, event.candidate.toJSON());
    };

    pc.ontrack = (event) => {
      const inbound =
        event.streams[0] ?? new MediaStream([event.track]);

      remoteStreams.value = {
        ...remoteStreams.value,
        [socketId]: inbound,
      };
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        markFailed();
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        markFailed();
      }
    };
  }

  function createPeer(socketId: string, initiator: boolean): PeerSlot {
    const existing = peers.get(socketId);

    if (existing !== undefined) {
      return existing;
    }

    const pc = new RTCPeerConnection({ iceServers: iceServers.value });
    const slot: PeerSlot = {
      pc,
      initiator,
      iceQueue: [],
      remoteSet: false,
    };

    bindPeerEvents(socketId, pc);

    if (initiator) {
      attachLocalMedia(pc, localStream.value);
    }

    peers.set(socketId, slot);

    return slot;
  }

  async function sendLocalSdp(
    socketId: string,
    kind: "offer" | "answer",
  ): Promise<void> {
    if (signaling === null) {
      return;
    }

    const slot = peers.get(socketId);

    if (slot === undefined) {
      return;
    }

    const sdp = slot.pc.localDescription?.sdp;

    if (sdp === undefined) {
      return;
    }

    if (kind === "offer") {
      signaling.sendOffer(socketId, sdp);
      return;
    }

    signaling.sendAnswer(socketId, sdp);
  }

  async function createAndOffer(socketId: string): Promise<void> {
    const slot = createPeer(socketId, true);

    try {
      const offer = await slot.pc.createOffer();
      await slot.pc.setLocalDescription(offer);
      await sendLocalSdp(socketId, "offer");
    } catch {
      return;
    }
  }

  async function syncJoiner(remoteIds: string[]): Promise<void> {
    if (offeredForJoin) {
      return;
    }

    offeredForJoin = true;

    for (const id of remoteIds) {
      if (id.length === 0) {
        continue;
      }

      await createAndOffer(id);
    }
  }

  async function handleOffer(fromSocketId: string, sdp: string): Promise<void> {
    const slot = createPeer(fromSocketId, false);

    try {
      await slot.pc.setRemoteDescription({ type: "offer", sdp });
      slot.remoteSet = true;
      await flushIce(slot, fromSocketId);
      attachLocalMedia(slot.pc, localStream.value);

      const answer = await slot.pc.createAnswer();
      await slot.pc.setLocalDescription(answer);
      await sendLocalSdp(fromSocketId, "answer");
    } catch {
      return;
    }
  }

  async function handleAnswer(
    fromSocketId: string,
    sdp: string,
  ): Promise<void> {
    const slot = peers.get(fromSocketId);

    if (slot === undefined) {
      return;
    }

    try {
      await slot.pc.setRemoteDescription({ type: "answer", sdp });
      slot.remoteSet = true;
      await flushIce(slot, fromSocketId);
    } catch {
      return;
    }
  }

  async function handleIce(
    fromSocketId: string,
    candidate: unknown,
  ): Promise<void> {
    if (!isIceCandidateInit(candidate)) {
      return;
    }

    const slot = peers.get(fromSocketId);

    if (slot === undefined || !slot.remoteSet) {
      const queued = pendingIce.get(fromSocketId) ?? [];
      queued.push(candidate);
      pendingIce.set(fromSocketId, queued);
      return;
    }

    try {
      await slot.pc.addIceCandidate(candidate);
    } catch {
      return;
    }
  }

  async function renegotiateInitiators(): Promise<void> {
    for (const [socketId, slot] of peers) {
      if (!slot.initiator || slot.pc.signalingState !== "stable") {
        continue;
      }

      try {
        const offer = await slot.pc.createOffer();
        await slot.pc.setLocalDescription(offer);
        await sendLocalSdp(socketId, "offer");
      } catch {
        continue;
      }
    }
  }

  async function replaceLocalTracks(
    stream: MediaStream | null,
  ): Promise<void> {
    localStream.value = stream;
    let needsRenegotiate = false;

    for (const slot of peers.values()) {
      if (attachLocalMedia(slot.pc, stream)) {
        needsRenegotiate = true;
      }
    }

    if (needsRenegotiate) {
      await renegotiateInitiators();
    }
  }

  function removePeer(socketId: string): void {
    const slot = peers.get(socketId);

    if (slot !== undefined) {
      slot.pc.onicecandidate = null;
      slot.pc.ontrack = null;
      slot.pc.close();
      peers.delete(socketId);
    }

    pendingIce.delete(socketId);

    if (remoteStreams.value[socketId] === undefined) {
      return;
    }

    const next = { ...remoteStreams.value };
    delete next[socketId];
    remoteStreams.value = next;
  }

  function prune(activeIds: Set<string>): void {
    for (const socketId of [...peers.keys()]) {
      if (!activeIds.has(socketId)) {
        removePeer(socketId);
      }
    }
  }

  function stop(): void {
    for (const socketId of [...peers.keys()]) {
      removePeer(socketId);
    }

    pendingIce.clear();
    remoteStreams.value = {};
    iceError.value = null;
    offeredForJoin = false;
  }

  return {
    remoteStreams,
    iceError,
    setIceServers,
    setSignaling,
    setLocalStream,
    syncJoiner,
    handleOffer,
    handleAnswer,
    handleIce,
    replaceLocalTracks,
    removePeer,
    prune,
    stop,
    clearIceError,
  };
}

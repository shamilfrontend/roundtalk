<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useRoute, useRouter } from "vue-router";
import { fetchPublicRoom } from "@/api/rooms";
import { fetchIceServers, type IceServer } from "@/api/turn";
import { getApiErrorCode, isNotFoundError } from "@/api/http";
import DeviceSettings from "@/components/device-settings.vue";
import ParticipantTile from "@/components/participant-tile.vue";
import RoomPrejoin from "@/components/room-prejoin.vue";
import RoomSidebar from "@/components/room-sidebar.vue";
import RoomToolbar from "@/components/room-toolbar.vue";
import { formatDateTime, formatElapsed } from "@/composables/format";
import { useLocalMedia } from "@/composables/use-local-media";
import { useScreenShare } from "@/composables/use-screen-share";
import { useWebrtc } from "@/composables/use-webrtc";
import { useAuthStore } from "@/stores/auth";
import { useRoomStore, type RoomNotice } from "@/stores/room";
import type { ParticipantPublic, RoomPublic } from "@/types/room";

const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 40;

type SidebarTab = "chat" | "participants";
type LoadState = "loading" | "ready" | "not-found" | "failed";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const roomStore = useRoomStore();
const {
  stream,
  error: mediaError,
  isMuted,
  isCameraOff,
  audioInputs,
  videoInputs,
  audioOutputs,
  selectedAudioId,
  selectedVideoId,
  selectedOutputId,
  start: startMedia,
  stop: stopMedia,
  setMuted,
  setCameraOff,
  selectAudio,
  selectVideo,
  selectOutput,
} = useLocalMedia();

const {
  displayStream,
  isSharing,
  startShare,
  stopShare,
  getOutboundStream,
  setOnBrowserStop,
} = useScreenShare(stream);

const {
  phase,
  room,
  messages,
  participants,
  remoteParticipants,
  selfParticipant,
  selfSocketId,
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
} = storeToRefs(roomStore);

const webrtc = useWebrtc();
const { remoteStreams, iceError } = webrtc;

const roomId = computed(() => String(route.params.roomId ?? ""));
const publicRoom = ref<RoomPublic | null>(null);
const iceServers = ref<IceServer[]>([]);
const loadState = ref<LoadState>("loading");
const displayName = ref("");
const nameError = ref<string | null>(null);
const sidebar = ref<SidebarTab | null>(null);
const settingsOpen = ref(false);
const reactionsOpen = ref(false);
const copied = ref(false);
const roomToast = ref<string | null>(null);
const now = ref(Date.now());
let clockId = 0;
let copyId = 0;

const isHostUser = computed(() => {
  const userId = auth.user?.id;
  const hostId = publicRoom.value?.hostId ?? room.value?.hostId;

  return userId !== undefined && hostId !== undefined && userId === hostId;
});

const isWaiting = computed(() => {
  const info = publicRoom.value;

  if (info === null || info.status !== "scheduled" || info.scheduledAt === null) {
    return false;
  }

  return now.value < new Date(info.scheduledAt).getTime() && !isHostUser.value;
});

const title = computed(
  () => room.value?.title ?? publicRoom.value?.title ?? "Встреча",
);

const elapsed = computed(() => {
  if (joinedAt.value === null) {
    return "00:00";
  }

  return formatElapsed(joinedAt.value, now.value);
});

const inRoom = computed(
  () => phase.value === "joined" && !wasReplaced.value && !wasEnded.value,
);

const toastText = computed(() => iceError.value ?? roomToast.value);

const visibleNotices = computed(() => {
  if (sidebar.value === "chat") {
    return notices.value.filter((item: RoomNotice) => item.kind !== "chat");
  }

  return notices.value;
});

const sharer = computed(() => {
  const id = screenShareSocketId.value;

  if (id === null) {
    return null;
  }

  return (
    participants.value.find((item: ParticipantPublic) => item.socketId === id) ??
    null
  );
});

const shareMainParticipant = computed(() => {
  if (sharer.value !== null) {
    return sharer.value;
  }

  if (isSharing.value) {
    return selfParticipant.value;
  }

  return null;
});

const isShareLayout = computed(
  () => shareMainParticipant.value !== null,
);

const railParticipants = computed(() => {
  if (isSharing.value) {
    return remoteParticipants.value;
  }

  const id = screenShareSocketId.value;

  return participants.value.filter(
    (item: ParticipantPublic) => item.socketId !== id,
  );
});

const shareDisabled = computed(() => {
  const id = screenShareSocketId.value;

  return (
    id !== null && id !== selfSocketId.value && !isSharing.value
  );
});

setOnBrowserStop(() => {
  roomStore.sendScreenShare(false);

  if (inRoom.value) {
    void webrtc.replaceLocalTracks(stream.value);
  }
});

watch(
  () => auth.user?.name,
  (name) => {
    if (name !== undefined && displayName.value.trim().length === 0) {
      displayName.value = name;
    }
  },
  { immediate: true },
);

watch(
  roomId,
  () => {
    roomStore.leave();
    sidebar.value = null;
    settingsOpen.value = false;
    reactionsOpen.value = false;
    void prepareRoom();
  },
  { immediate: true },
);

watch(
  () => [isMuted.value, isCameraOff.value, phase.value] as const,
  () => {
    if (phase.value === "joined") {
      roomStore.setMediaState(isMuted.value, isCameraOff.value);
    }
  },
);

watch(wasEnded, (ended) => {
  if (ended) {
    stopShare();
    stopMedia();
  }
});

watch(wasReplaced, (replaced) => {
  if (replaced) {
    stopShare();
    stopMedia();
  }
});

watch(
  () => [errorCode.value, inRoom.value] as const,
  () => {
    if (!inRoom.value || errorCode.value !== "share-already-active") {
      return;
    }

    roomToast.value = error.value ?? "Демонстрация экрана уже идёт";
    stopShare();
    void webrtc.replaceLocalTracks(stream.value);
    roomStore.clearError();
  },
);

watch(inRoom, (active) => {
  if (!active) {
    webrtc.stop();
    stopShare();
    reactionsOpen.value = false;
    return;
  }

  bindWebrtc();
  void webrtc.syncJoiner(remoteSocketIds());
});

watch(selfSocketId, (id, prev) => {
  if (!inRoom.value || id === null || prev === null || prev === id) {
    return;
  }

  webrtc.stop();
  bindWebrtc();
  void webrtc.replaceLocalTracks(getOutboundStream());
  void webrtc.syncJoiner(remoteSocketIds());
  roomStore.setMediaState(isMuted.value, isCameraOff.value);

  if (isSharing.value) {
    roomStore.sendScreenShare(true);
  }
});

watch(
  () => remoteSocketIds().join(","),
  (joined) => {
    if (inRoom.value) {
      const ids = joined.length === 0 ? [] : joined.split(",");
      webrtc.prune(new Set(ids));
    }
  },
);

watch(
  () => outboundTrackKey(),
  () => {
    if (inRoom.value) {
      void webrtc.replaceLocalTracks(getOutboundStream());
    }
  },
);

let unloadSent = false;

function onPageHide(): void {
  if (unloadSent) {
    return;
  }

  unloadSent = true;
  roomStore.leaveOnUnload();
}

window.addEventListener("beforeunload", onPageHide);
window.addEventListener("pagehide", onPageHide);

onUnmounted(() => {
  window.removeEventListener("beforeunload", onPageHide);
  window.removeEventListener("pagehide", onPageHide);
  window.clearInterval(clockId);
  window.clearTimeout(copyId);
  stopShare();
  webrtc.stop();
  roomStore.attachWebrtc(null);
  roomStore.leave();
});

clockId = window.setInterval(() => {
  now.value = Date.now();
}, 1000);

function outboundTrackKey(): string {
  const outbound = getOutboundStream();

  if (outbound === null) {
    return "";
  }

  return outbound
    .getTracks()
    .map((track: MediaStreamTrack) => track.id)
    .join(",");
}

function remoteSocketIds(): string[] {
  return remoteParticipants.value.flatMap((item: ParticipantPublic) =>
    item.socketId !== undefined ? [item.socketId] : [],
  );
}

function remoteStreamOf(item: ParticipantPublic): MediaStream | null {
  const id = item.socketId;

  if (id === undefined) {
    return null;
  }

  return remoteStreams.value[id] ?? null;
}

function tileStream(item: ParticipantPublic): MediaStream | null {
  if (item.socketId === selfSocketId.value) {
    return stream.value;
  }

  return remoteStreamOf(item);
}

function reactionOf(item: ParticipantPublic): {
  emoji: string;
  token: number;
} | null {
  const id = item.socketId;

  if (id === undefined) {
    return null;
  }

  return reactions.value[id] ?? null;
}

function mainShareStream(): MediaStream | null {
  if (isSharing.value) {
    return displayStream.value;
  }

  const item = sharer.value;

  if (item === null) {
    return null;
  }

  return remoteStreamOf(item);
}

function bindWebrtc(): void {
  webrtc.setIceServers(iceServers.value);
  webrtc.setLocalStream(getOutboundStream());
  webrtc.setSignaling({
    sendOffer: roomStore.sendOffer,
    sendAnswer: roomStore.sendAnswer,
    sendIce: roomStore.sendIce,
  });
  roomStore.attachWebrtc({
    onOffer: (fromSocketId: string, sdp: string) => {
      void webrtc.handleOffer(fromSocketId, sdp);
    },
    onAnswer: (fromSocketId: string, sdp: string) => {
      void webrtc.handleAnswer(fromSocketId, sdp);
    },
    onIce: (fromSocketId: string, candidate: unknown) => {
      void webrtc.handleIce(fromSocketId, candidate);
    },
  });
}

async function prepareRoom(): Promise<void> {
  loadState.value = "loading";
  publicRoom.value = null;
  nameError.value = null;
  await startMedia();

  const icePromise = fetchIceServers();

  try {
    publicRoom.value = await fetchPublicRoom(roomId.value);
  } catch (err: unknown) {
    iceServers.value = (await icePromise).iceServers;
    webrtc.setIceServers(iceServers.value);

    if (isNotFoundError(err) || getApiErrorCode(err) === "room_not_found") {
      loadState.value = "not-found";
      return;
    }

    loadState.value = "failed";
    return;
  }

  iceServers.value = (await icePromise).iceServers;
  webrtc.setIceServers(iceServers.value);
  loadState.value = "ready";
}

function validateName(): string | null {
  const name = displayName.value.trim();

  if (name.length < DISPLAY_NAME_MIN || name.length > DISPLAY_NAME_MAX) {
    nameError.value = `Имя: ${DISPLAY_NAME_MIN}–${DISPLAY_NAME_MAX} символов`;
    return null;
  }

  nameError.value = null;
  return name;
}

function join(): void {
  const name = validateName();

  if (name === null) {
    return;
  }

  bindWebrtc();
  roomStore.join(roomId.value, name);
}

async function copyLink(): Promise<void> {
  const url = `${window.location.origin}/room/${roomId.value}`;

  try {
    await navigator.clipboard.writeText(url);
    copied.value = true;
    window.clearTimeout(copyId);
    copyId = window.setTimeout(() => {
      copied.value = false;
    }, 1600);
  } catch {
    copied.value = false;
  }
}

function toggleSidebar(tab: SidebarTab): void {
  sidebar.value = sidebar.value === tab ? null : tab;
  settingsOpen.value = false;
  reactionsOpen.value = false;
}

function toggleSettings(): void {
  settingsOpen.value = !settingsOpen.value;
  reactionsOpen.value = false;

  if (settingsOpen.value) {
    sidebar.value = null;
  }
}

function toggleReactions(): void {
  reactionsOpen.value = !reactionsOpen.value;

  if (reactionsOpen.value) {
    settingsOpen.value = false;
  }
}

function sendReaction(emoji: string): void {
  roomStore.sendReaction(emoji);
  reactionsOpen.value = false;
}

function toggleMute(): void {
  setMuted(!isMuted.value);
}

function toggleCamera(): void {
  setCameraOff(!isCameraOff.value);
}

function toggleHand(): void {
  const raised = !(selfParticipant.value?.isHandRaised ?? false);
  roomStore.setHandRaised(raised);
}

async function toggleShare(): Promise<void> {
  reactionsOpen.value = false;

  if (isSharing.value) {
    stopShare();
    roomStore.sendScreenShare(false);

    if (inRoom.value) {
      await webrtc.replaceLocalTracks(stream.value);
    }

    return;
  }

  if (shareDisabled.value) {
    return;
  }

  const started = await startShare();

  if (!started) {
    return;
  }

  roomStore.sendScreenShare(true);

  if (inRoom.value) {
    await webrtc.replaceLocalTracks(getOutboundStream());
  }
}

function clearToast(): void {
  webrtc.clearIceError();
  roomToast.value = null;
}

async function hangup(): Promise<void> {
  if (isHost.value && inRoom.value) {
    try {
      await roomStore.endForEveryone();
    } catch {
      return;
    }

    return;
  }

  await goHome();
}

async function goHome(): Promise<void> {
  stopShare();
  webrtc.stop();
  roomStore.leave();
  stopMedia();
  await router.push({ name: "home" });
}

async function onSelectAudio(deviceId: string): Promise<void> {
  await selectAudio(deviceId);

  if (inRoom.value) {
    await webrtc.replaceLocalTracks(getOutboundStream());
  }
}

async function onSelectVideo(deviceId: string): Promise<void> {
  await selectVideo(deviceId);

  if (inRoom.value && !isSharing.value) {
    await webrtc.replaceLocalTracks(stream.value);
  }
}

function sendChat(text: string): void {
  roomStore.sendChat(text);
}
</script>

<template>
  <main class="room">
    <section v-if="wasReplaced" class="status">
      <h1>Вы вошли с другой вкладки</h1>
      <button class="btn btn-primary" type="button" @click="goHome">
        На главную
      </button>
    </section>

    <section v-else-if="wasEnded" class="status">
      <h1>Встреча завершена</h1>
      <button class="btn btn-primary" type="button" @click="goHome">
        На главную
      </button>
    </section>

    <section v-else-if="loadState === 'loading'" class="status">
      <p>Загрузка комнаты…</p>
    </section>

    <section v-else-if="loadState === 'not-found'" class="status">
      <h1>Комната не найдена</h1>
      <button class="btn btn-primary" type="button" @click="goHome">
        На главную
      </button>
    </section>

    <section v-else-if="loadState === 'failed'" class="status">
      <h1>Не удалось открыть комнату</h1>
      <button class="btn btn-primary" type="button" @click="goHome">
        На главную
      </button>
    </section>

    <section
      v-else-if="publicRoom?.status === 'ended'"
      class="status"
    >
      <h1>Встреча завершена</h1>
      <button class="btn btn-primary" type="button" @click="goHome">
        На главную
      </button>
    </section>

    <section v-else-if="isWaiting" class="status">
      <h1>Комната ещё не началась</h1>
      <p v-if="publicRoom?.scheduledAt">
        Старт: {{ formatDateTime(publicRoom.scheduledAt) }}
      </p>
      <button class="btn btn-ghost" type="button" @click="goHome">
        На главную
      </button>
    </section>

    <section v-else-if="errorCode === 'room-full'" class="status">
      <h1>В комнате нет мест</h1>
      <p>Максимум 6 участников</p>
      <button class="btn btn-primary" type="button" @click="goHome">
        На главную
      </button>
    </section>

    <template v-else-if="inRoom">
      <header class="top">
        <div class="top-info">
          <h1>{{ title }}</h1>
          <span class="timer">{{ elapsed }}</span>
          <span v-if="isReconnecting" class="reconnect">
            Восстанавливаем связь…
          </span>
        </div>
        <button class="link-pill" type="button" @click="copyLink">
          <FontAwesomeIcon icon="link" />
          {{ copied ? "Скопировано" : "Ссылка" }}
        </button>
      </header>

      <div class="toasts">
        <p v-if="toastText" class="toast" role="status">
          <span>{{ toastText }}</span>
          <button class="toast-close" type="button" @click="clearToast">
            <FontAwesomeIcon icon="xmark" />
          </button>
        </p>
        <p
          v-for="item in visibleNotices"
          :key="item.id"
          class="toast notice"
          role="status"
        >
          {{ item.text }}
        </p>
      </div>

      <div class="stage" :class="{ sharing: isShareLayout }">
        <template v-if="isShareLayout && shareMainParticipant">
          <ParticipantTile
            class="share-main"
            :participant="shareMainParticipant"
            :is-self="shareMainParticipant.socketId === selfSocketId"
            :stream="mainShareStream()"
            :audio-output-id="selectedOutputId"
            :is-screen-share="true"
            :reaction="reactionOf(shareMainParticipant)"
          />
          <div class="share-rail">
            <ParticipantTile
              v-for="item in railParticipants"
              :key="item.socketId ?? item.displayName"
              :participant="item"
              :is-self="item.socketId === selfSocketId"
              :stream="tileStream(item)"
              :audio-output-id="selectedOutputId"
              :reaction="reactionOf(item)"
            />
          </div>
        </template>

        <div
          v-else-if="remoteParticipants.length === 0"
          class="empty"
        >
          <h2>Пригласите участников</h2>
          <p>Отправьте ссылку, чтобы начать разговор</p>
          <button class="btn btn-primary" type="button" @click="copyLink">
            <FontAwesomeIcon icon="copy" />
            {{ copied ? "Скопировано" : "Скопировать ссылку" }}
          </button>
        </div>

        <div v-else class="grid">
          <ParticipantTile
            v-for="item in remoteParticipants"
            :key="item.socketId ?? item.displayName"
            :participant="item"
            :is-self="false"
            :stream="remoteStreamOf(item)"
            :audio-output-id="selectedOutputId"
            :reaction="reactionOf(item)"
          />
        </div>

        <div v-if="selfParticipant && !isShareLayout" class="pip">
          <ParticipantTile
            :participant="selfParticipant"
            :is-self="true"
            :stream="stream"
            :reaction="reactionOf(selfParticipant)"
          />
        </div>
      </div>

      <RoomSidebar
        v-if="sidebar !== null"
        class="sidebar"
        :tab="sidebar"
        :messages="messages"
        :participants="participants"
        :self-socket-id="selfSocketId"
        :is-host="isHost"
        :is-ending="isEnding"
        @close="sidebar = null"
        @send="sendChat"
        @end-for-everyone="hangup"
      />

      <DeviceSettings
        v-if="settingsOpen"
        :audio-inputs="audioInputs"
        :video-inputs="videoInputs"
        :audio-outputs="audioOutputs"
        :selected-audio-id="selectedAudioId"
        :selected-video-id="selectedVideoId"
        :selected-output-id="selectedOutputId"
        @close="settingsOpen = false"
        @select-audio="onSelectAudio"
        @select-video="onSelectVideo"
        @select-output="selectOutput"
      />

      <RoomToolbar
        class="bar"
        :is-muted="isMuted"
        :is-camera-off="isCameraOff"
        :is-hand-raised="selfParticipant?.isHandRaised ?? false"
        :is-host="isHost"
        :is-sharing="isSharing"
        :share-disabled="shareDisabled"
        :reactions-open="reactionsOpen"
        :sidebar="sidebar"
        :settings-open="settingsOpen"
        @toggle-chat="toggleSidebar('chat')"
        @toggle-participants="toggleSidebar('participants')"
        @toggle-share="toggleShare"
        @toggle-hand="toggleHand"
        @toggle-reactions="toggleReactions"
        @react="sendReaction"
        @toggle-mute="toggleMute"
        @toggle-camera="toggleCamera"
        @toggle-settings="toggleSettings"
        @hangup="hangup"
      />
    </template>

    <section v-else class="prejoin-wrap">
      <h1>{{ title }}</h1>
      <RoomPrejoin
        v-model:display-name="displayName"
        :name-error="nameError"
        :media-error="mediaError"
        :join-error="error"
        :stream="stream"
        :is-muted="isMuted"
        :is-camera-off="isCameraOff"
        :is-joining="phase === 'joining'"
        @join="join"
        @toggle-mute="toggleMute"
        @toggle-camera="toggleCamera"
      />
    </section>
  </main>
</template>

<style scoped lang="scss">
.room {
  position: relative;
  height: 100%;
  overflow: hidden;
  background: $color-bg;
  --toolbar-space: 96px;
}

.status,
.prejoin-wrap {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px;
  padding-bottom: max(24px, env(safe-area-inset-bottom, 0px));
  text-align: center;
}

h1 {
  margin: 0;
  font-size: 24px;
}

.top {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.top-info {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.timer {
  color: $color-text-secondary;
  font-variant-numeric: tabular-nums;
}

.reconnect {
  color: $color-accent;
  font-size: 13px;
}

.toasts {
  position: absolute;
  top: 72px;
  left: 50%;
  z-index: 6;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(440px, calc(100% - 32px));
  transform: translateX(-50%);
}

.link-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 999px;
  background: $color-surface;
  color: $color-text;
  padding: 8px 14px;
}

.stage {
  height: 100%;
  padding: 72px 16px var(--toolbar-space);
}

.stage.sharing {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  gap: 12px;
}

.share-main {
  min-height: 0;
  height: 100%;
}

.share-rail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow: auto;
}

.share-rail :deep(.tile) {
  min-height: 110px;
  flex: none;
  height: 110px;
}

.empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: $color-text-secondary;
}

.empty h2 {
  margin: 0;
  color: $color-text;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
  height: 100%;
}

.pip {
  position: absolute;
  right: 24px;
  bottom: calc(var(--toolbar-space) + 12px);
  width: 220px;
  height: 140px;
  z-index: 2;
}

.pip :deep(.tile) {
  min-height: 100%;
  height: 100%;
}

.sidebar {
  position: absolute;
  top: 64px;
  right: 16px;
  bottom: var(--toolbar-space);
  z-index: 4;
}

.bar {
  position: absolute;
  left: 50%;
  bottom: 20px;
  transform: translateX(-50%);
  z-index: 5;
}

.toast {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  padding: 12px 12px 12px 16px;
  border-radius: $radius-control;
  background: $color-surface;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.toast.notice {
  padding-right: 16px;
}

.toast-close {
  flex: none;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: $radius-round;
  background: $color-surface-alt;
  color: $color-text;
}

@media (max-width: 720px) {
  .room {
    --toolbar-space: calc(140px + env(safe-area-inset-bottom, 0px));
  }

  .top {
    top: 8px;
    left: 12px;
    right: 12px;
    gap: 8px;
  }

  .top-info {
    min-width: 0;
    gap: 8px;
  }

  .top h1 {
    max-width: 42vw;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 16px;
  }

  .toasts {
    top: 56px;
  }

  .stage {
    padding: 56px 10px var(--toolbar-space);
  }

  .grid {
    grid-template-columns: minmax(140px, 1fr);
    gap: 8px;
  }

  .sidebar {
    top: 0;
    right: 0;
    left: 0;
    bottom: var(--toolbar-space);
    border-radius: 0;
  }

  .pip {
    right: 12px;
    width: 140px;
    height: 96px;
  }

  .bar {
    left: 8px;
    right: 8px;
    bottom: 0;
    width: auto;
    transform: none;
  }

  .stage.sharing {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) 96px;
  }

  .share-rail {
    flex-direction: row;
    overflow: auto;
  }

  .share-rail :deep(.tile) {
    width: 140px;
    height: 96px;
    min-height: 96px;
  }
}

@media (min-width: 721px) and (max-width: 1024px) {
  .room {
    --toolbar-space: calc(88px + env(safe-area-inset-bottom, 0px));
  }

  .top h1 {
    max-width: 46vw;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 20px;
  }

  .stage {
    padding: 72px 16px var(--toolbar-space);
  }

  .grid {
    grid-template-columns: repeat(2, minmax(200px, 1fr));
  }

  .sidebar {
    width: 360px;
    bottom: var(--toolbar-space);
  }

  .pip {
    width: 180px;
    height: 120px;
    right: 16px;
  }

  .bar {
    left: 16px;
    right: 16px;
    bottom: 0;
    width: auto;
    transform: none;
  }
}

@media (min-width: 721px) and (max-width: 1024px) and (orientation: portrait) {
  .stage.sharing {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) 110px;
  }

  .share-rail {
    flex-direction: row;
    overflow: auto;
  }

  .share-rail :deep(.tile) {
    width: 160px;
    height: 110px;
    min-height: 110px;
  }
}
</style>

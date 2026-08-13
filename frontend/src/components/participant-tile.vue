<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { initials } from "@/composables/format";
import type { TileReaction } from "@/stores/room";
import type { ParticipantPublic } from "@/types/room";

const SPEAKING_ON = 12;
const SPEAKING_OFF = 7;
const SILENT_FRAMES = 10;

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

const props = defineProps<{
  participant: ParticipantPublic;
  isSelf: boolean;
  stream: MediaStream | null;
  audioOutputId?: string;
  isScreenShare?: boolean;
  reaction?: TileReaction | null;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const audioRef = ref<HTMLAudioElement | null>(null);
const speaking = ref(false);
const needsUnlock = ref(false);
const liveVideoId = ref("");
const liveAudioId = ref("");

const mirror = computed(() => props.isSelf && props.isScreenShare !== true);
const showVideo = computed(() => liveVideoId.value.length > 0);

let boundStream: MediaStream | null = null;

let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let source: MediaStreamAudioSourceNode | null = null;
let timeData: Uint8Array<ArrayBuffer> | null = null;
let rafId = 0;
let silentFrames = 0;
let meterGen = 0;

function getAudioContextCtor(): typeof AudioContext | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  if (typeof window.AudioContext === "function") {
    return window.AudioContext;
  }

  const webkit = (window as WindowWithWebkitAudio).webkitAudioContext;

  if (typeof webkit === "function") {
    return webkit;
  }

  return undefined;
}

function stopMeter(): void {
  meterGen += 1;
  window.cancelAnimationFrame(rafId);
  rafId = 0;
  silentFrames = 0;
  speaking.value = false;
  source?.disconnect();
  analyser?.disconnect();
  source = null;
  analyser = null;
  timeData = null;

  if (audioContext !== null) {
    void audioContext.close().catch(() => undefined);
    audioContext = null;
  }
}

function tick(): void {
  if (analyser === null || timeData === null) {
    return;
  }

  analyser.getByteTimeDomainData(timeData);

  let sum = 0;

  for (const sample of timeData) {
    const centered = sample - 128;
    sum += centered * centered;
  }

  const rms = Math.sqrt(sum / timeData.length);

  if (rms >= SPEAKING_ON) {
    speaking.value = true;
    silentFrames = 0;
  } else if (rms < SPEAKING_OFF) {
    silentFrames += 1;

    if (silentFrames >= SILENT_FRAMES) {
      speaking.value = false;
    }
  }

  rafId = window.requestAnimationFrame(tick);
}

async function startMeter(stream: MediaStream): Promise<void> {
  stopMeter();

  const track = stream.getAudioTracks().find((item) => item.readyState === "live");

  if (track === undefined) {
    return;
  }

  const Ctor = getAudioContextCtor();

  if (Ctor === undefined) {
    return;
  }

  const gen = meterGen;

  try {
    const ctx = new Ctor();
    const node = ctx.createAnalyser();
    node.fftSize = 512;
    node.smoothingTimeConstant = 0.4;

    const input = ctx.createMediaStreamSource(new MediaStream([track]));
    input.connect(node);

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    if (gen !== meterGen) {
      input.disconnect();
      node.disconnect();
      void ctx.close().catch(() => undefined);
      return;
    }

    audioContext = ctx;
    analyser = node;
    source = input;
    timeData = new Uint8Array(new ArrayBuffer(node.fftSize));
    tick();
  } catch {
    if (gen === meterGen) {
      stopMeter();
    }
  }
}

function syncLiveTracks(stream: MediaStream | null): void {
  const video = stream
    ?.getVideoTracks()
    .find((track) => track.readyState === "live");
  const audio = stream
    ?.getAudioTracks()
    .find((track) => track.readyState === "live");

  liveVideoId.value = video?.id ?? "";
  liveAudioId.value = audio?.id ?? "";
}

function bindStreamEvents(stream: MediaStream | null): void {
  if (boundStream !== null) {
    boundStream.removeEventListener("addtrack", onStreamTracks);
    boundStream.removeEventListener("removetrack", onStreamTracks);
  }

  boundStream = stream;

  if (stream !== null) {
    stream.addEventListener("addtrack", onStreamTracks);
    stream.addEventListener("removetrack", onStreamTracks);
  }

  syncLiveTracks(stream);
}

function onStreamTracks(): void {
  syncLiveTracks(props.stream);
  void bindMedia();
}

async function applySink(
  el: HTMLMediaElement,
  sinkId: string,
): Promise<void> {
  if (sinkId.length === 0) {
    return;
  }

  const media = el as HTMLMediaElement & {
    setSinkId?: (id: string) => Promise<void>;
  };

  if (typeof media.setSinkId !== "function") {
    return;
  }

  try {
    await media.setSinkId(sinkId);
  } catch {
    return;
  }
}

async function playEl(el: HTMLMediaElement | null): Promise<boolean> {
  if (el === null) {
    return true;
  }

  try {
    await el.play();
    return true;
  } catch {
    return false;
  }
}

async function bindMedia(): Promise<void> {
  const video = videoRef.value;
  const audio = audioRef.value;

  if (video !== null && video.srcObject !== props.stream) {
    video.srcObject = props.stream;
  }

  if (audio !== null && audio.srcObject !== props.stream) {
    audio.srcObject = props.stream;
  }

  if (audio !== null) {
    void applySink(audio, props.audioOutputId ?? "");
  }

  const videoOk = await playEl(video);
  const audioOk = props.isSelf ? true : await playEl(audio);

  needsUnlock.value = !videoOk || !audioOk;
}

function unlockPlayback(): void {
  needsUnlock.value = false;
  void bindMedia();
}

watch(
  [() => props.stream, videoRef, audioRef, () => props.audioOutputId],
  () => {
    bindStreamEvents(props.stream);
    void bindMedia();
  },
  { immediate: true },
);

watch(
  [
    () => props.stream,
    liveAudioId,
    () => props.participant.isMuted,
    () => props.isScreenShare,
  ],
  () => {
    if (
      props.stream === null ||
      props.participant.isMuted ||
      props.isScreenShare === true ||
      liveAudioId.value.length === 0
    ) {
      stopMeter();
      return;
    }

    void startMeter(props.stream);
  },
  { immediate: true },
);

onUnmounted(() => {
  bindStreamEvents(null);
  stopMeter();
});
</script>

<template>
  <article
    class="tile"
    :class="{ self: mirror, screen: isScreenShare, speaking }"
    @click="unlockPlayback"
  >
    <div class="tile-clip">
      <video
        ref="videoRef"
        class="tile-video"
        :class="{ hidden: !showVideo }"
        autoplay
        muted
        playsinline
        webkit-playsinline
      />

      <audio
        v-if="!isSelf"
        ref="audioRef"
        class="tile-audio"
        autoplay
      />

      <div v-if="!showVideo" class="avatar">
        {{ initials(participant.displayName) }}
      </div>

      <div v-if="needsUnlock && !isSelf" class="unlock">
        Нажмите, чтобы услышать
      </div>

      <span
        v-if="reaction"
        :key="`${reaction.emoji}-${reaction.token}`"
        class="reaction"
      >
        {{ reaction.emoji }}
      </span>

      <div class="meta">
        <span class="name">
          {{ participant.displayName }}
          <template v-if="isSelf"> (вы)</template>
        </span>
        <span
          v-if="participant.isMuted"
          class="badge"
          data-tooltip="Микрофон выключен"
        >
          <FontAwesomeIcon icon="microphone-slash" />
        </span>
        <span
          v-if="participant.isHandRaised"
          class="badge hand"
          data-tooltip="Рука"
        >
          <FontAwesomeIcon icon="hand" />
        </span>
        <span
          v-if="isScreenShare"
          class="badge share"
          data-tooltip="Демонстрация экрана"
        >
          <FontAwesomeIcon icon="desktop" />
        </span>
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
.tile {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 160px;
  border-radius: $radius-tile;
}

.tile.speaking {
  box-shadow: 0 0 0 3px $color-speaking-ring;
}

.tile-clip {
  position: relative;
  flex: 1;
  overflow: hidden;
  min-height: 0;
  border-radius: $radius-tile;
  background: $color-surface;
}

.tile-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.screen .tile-video {
  object-fit: contain;
  background: #000;
}

.self .tile-video {
  transform: scaleX(-1);
}

.tile-video.hidden {
  opacity: 0;
}

.tile-audio {
  display: none;
}

.unlock {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 14px;
  text-align: center;
}

.avatar {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 32px;
  font-weight: 700;
  color: $color-text-secondary;
}

.reaction {
  position: absolute;
  top: 40%;
  left: 50%;
  z-index: 2;
  font-size: 42px;
  pointer-events: none;
  animation: float-up 2s ease-out forwards;
}

.meta {
  position: absolute;
  left: 10px;
  bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.name {
  background: rgba(0, 0, 0, 0.55);
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 13px;
}

.badge {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: $radius-round;
  background: $color-danger;
  color: #fff;
  font-size: 12px;
}

.badge.hand,
.badge.share {
  background: $color-accent;
}

@keyframes float-up {
  0% {
    opacity: 1;
    transform: translate(-50%, 12px) scale(0.8);
  }

  20% {
    opacity: 1;
    transform: translate(-50%, 0) scale(1.15);
  }

  100% {
    opacity: 0;
    transform: translate(-50%, -40px) scale(1.3);
  }
}

@media (max-width: 720px) {
  .tile {
    min-height: 0;
  }

  .name {
    font-size: 12px;
  }
}

@media (min-width: 721px) and (max-width: 1024px) {
  .tile {
    min-height: 140px;
  }
}
</style>

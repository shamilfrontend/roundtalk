import { onUnmounted, ref, type Ref } from "vue";

export interface LocalMediaState {
  stream: Ref<MediaStream | null>;
  error: Ref<string | null>;
  isMuted: Ref<boolean>;
  isCameraOff: Ref<boolean>;
  audioInputs: Ref<MediaDeviceInfo[]>;
  videoInputs: Ref<MediaDeviceInfo[]>;
  audioOutputs: Ref<MediaDeviceInfo[]>;
  selectedAudioId: Ref<string>;
  selectedVideoId: Ref<string>;
  selectedOutputId: Ref<string>;
  start: () => Promise<void>;
  stop: () => void;
  setMuted: (muted: boolean) => void;
  setCameraOff: (off: boolean) => void;
  selectAudio: (deviceId: string) => Promise<void>;
  selectVideo: (deviceId: string) => Promise<void>;
  selectOutput: (deviceId: string) => void;
}

function stopTracks(stream: MediaStream | null): void {
  if (stream === null) {
    return;
  }

  for (const track of stream.getTracks()) {
    track.stop();
  }
}

async function listDevices(): Promise<MediaDeviceInfo[]> {
  if (typeof navigator === "undefined" || navigator.mediaDevices === undefined) {
    return [];
  }

  return navigator.mediaDevices.enumerateDevices();
}

export function useLocalMedia(): LocalMediaState {
  const stream = ref<MediaStream | null>(null);
  const error = ref<string | null>(null);
  const isMuted = ref(false);
  const isCameraOff = ref(false);
  const audioInputs = ref<MediaDeviceInfo[]>([]);
  const videoInputs = ref<MediaDeviceInfo[]>([]);
  const audioOutputs = ref<MediaDeviceInfo[]>([]);
  const selectedAudioId = ref("");
  const selectedVideoId = ref("");
  const selectedOutputId = ref("");

  async function refreshDevices(): Promise<void> {
    const devices = await listDevices();

    audioInputs.value = devices.filter((item) => item.kind === "audioinput");
    videoInputs.value = devices.filter((item) => item.kind === "videoinput");
    audioOutputs.value = devices.filter((item) => item.kind === "audiooutput");

    const audioTrack = stream.value?.getAudioTracks()[0];
    const videoTrack = stream.value?.getVideoTracks()[0];

    selectedAudioId.value = audioTrack?.getSettings().deviceId ?? "";
    selectedVideoId.value = videoTrack?.getSettings().deviceId ?? "";
  }

  async function getStream(constraints: MediaStreamConstraints): Promise<MediaStream | null> {
    if (typeof navigator === "undefined" || navigator.mediaDevices === undefined) {
      error.value = "Браузер не поддерживает камеру и микрофон";
      return null;
    }

    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      return null;
    }
  }

  async function start(): Promise<void> {
    error.value = null;

    const audio = await getStream({ audio: true, video: false });
    const video = await getStream({ audio: false, video: true });

    if (audio === null && video === null) {
      error.value = "Нет доступа к камере или микрофону. Можно войти без медиа.";
      await refreshDevices();
      return;
    }

    const next = new MediaStream();

    if (audio !== null) {
      for (const track of audio.getAudioTracks()) {
        next.addTrack(track);
      }
    }

    if (video !== null) {
      for (const track of video.getVideoTracks()) {
        next.addTrack(track);
      }
    }

    stopTracks(stream.value);
    stream.value = next;
    applyEnabled();
    await refreshDevices();

    if (next.getAudioTracks().length === 0) {
      error.value = "Нет доступа к микрофону";
    }
  }

  function applyEnabled(): void {
    const current = stream.value;

    if (current === null) {
      return;
    }

    for (const track of current.getAudioTracks()) {
      track.enabled = !isMuted.value;
    }

    for (const track of current.getVideoTracks()) {
      track.enabled = !isCameraOff.value;
    }
  }

  function setMuted(muted: boolean): void {
    isMuted.value = muted;
    applyEnabled();
  }

  function setCameraOff(off: boolean): void {
    isCameraOff.value = off;
    applyEnabled();
  }

  async function replaceTrack(
    kind: "audio" | "video",
    deviceId: string,
  ): Promise<void> {
    const current = stream.value;
    const constraint =
      kind === "audio"
        ? { audio: { deviceId: { ideal: deviceId } }, video: false }
        : { audio: false, video: { deviceId: { ideal: deviceId } } };

    const replacement = await getStream(constraint);

    if (replacement === null) {
      error.value = "Не удалось переключить устройство";
      return;
    }

    const newTrack = kind === "audio"
      ? replacement.getAudioTracks()[0]
      : replacement.getVideoTracks()[0];

    if (newTrack === undefined) {
      stopTracks(replacement);
      error.value = "Не удалось переключить устройство";
      return;
    }

    error.value = null;

    if (current === null) {
      stream.value = replacement;
      applyEnabled();
      await refreshDevices();
      return;
    }

    const oldTracks =
      kind === "audio" ? current.getAudioTracks() : current.getVideoTracks();

    for (const track of oldTracks) {
      current.removeTrack(track);
      track.stop();
    }

    current.addTrack(newTrack);
    applyEnabled();
    await refreshDevices();
  }

  async function selectAudio(deviceId: string): Promise<void> {
    await replaceTrack("audio", deviceId);
  }

  async function selectVideo(deviceId: string): Promise<void> {
    await replaceTrack("video", deviceId);
  }

  function selectOutput(deviceId: string): void {
    selectedOutputId.value = deviceId;
  }

  function stop(): void {
    stopTracks(stream.value);
    stream.value = null;
  }

  onUnmounted(() => {
    stop();
  });

  return {
    stream,
    error,
    isMuted,
    isCameraOff,
    audioInputs,
    videoInputs,
    audioOutputs,
    selectedAudioId,
    selectedVideoId,
    selectedOutputId,
    start,
    stop,
    setMuted,
    setCameraOff,
    selectAudio,
    selectVideo,
    selectOutput,
  };
}

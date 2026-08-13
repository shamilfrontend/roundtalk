import { computed, onUnmounted, ref, type ComputedRef, type Ref } from "vue";

export interface ScreenShareState {
  displayStream: Ref<MediaStream | null>;
  isSharing: ComputedRef<boolean>;
  startShare: () => Promise<boolean>;
  stopShare: () => void;
  getOutboundStream: () => MediaStream | null;
  setOnBrowserStop: (handler: (() => void) | null) => void;
}

function stopTracks(stream: MediaStream | null): void {
  if (stream === null) {
    return;
  }

  for (const track of stream.getTracks()) {
    track.onended = null;
    track.stop();
  }
}

function mixOutbound(
  camera: MediaStream | null,
  display: MediaStream | null,
): MediaStream | null {
  if (display === null) {
    return camera;
  }

  const mixed = new MediaStream();
  const audio = camera?.getAudioTracks()[0];
  const video = display.getVideoTracks()[0];

  if (audio !== undefined) {
    mixed.addTrack(audio);
  }

  if (video !== undefined) {
    mixed.addTrack(video);
  }

  if (mixed.getTracks().length === 0) {
    return display;
  }

  return mixed;
}

export function useScreenShare(
  cameraStream: Ref<MediaStream | null>,
): ScreenShareState {
  const displayStream = ref<MediaStream | null>(null);
  const isSharing = computed(() => displayStream.value !== null);
  let onBrowserStop: (() => void) | null = null;

  function setOnBrowserStop(handler: (() => void) | null): void {
    onBrowserStop = handler;
  }

  function getOutboundStream(): MediaStream | null {
    return mixOutbound(cameraStream.value, displayStream.value);
  }

  function stopShare(): void {
    stopTracks(displayStream.value);
    displayStream.value = null;
  }

  function bindEnded(stream: MediaStream): void {
    const track = stream.getVideoTracks()[0];

    if (track === undefined) {
      return;
    }

    track.onended = () => {
      stopShare();
      onBrowserStop?.();
    };
  }

  async function startShare(): Promise<boolean> {
    if (
      typeof navigator === "undefined" ||
      navigator.mediaDevices === undefined
    ) {
      return false;
    }

    try {
      const next = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      stopShare();
      displayStream.value = next;
      bindEnded(next);
      return true;
    } catch {
      return false;
    }
  }

  onUnmounted(() => {
    stopShare();
  });

  return {
    displayStream,
    isSharing,
    startShare,
    stopShare,
    getOutboundStream,
    setOnBrowserStop,
  };
}

<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  displayName: string;
  nameError: string | null;
  mediaError: string | null;
  joinError: string | null;
  stream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isJoining: boolean;
}>();

const emit = defineEmits<{
  "update:displayName": [value: string];
  join: [];
  toggleMute: [];
  toggleCamera: [];
}>();

const videoRef = ref<HTMLVideoElement | null>(null);

function onNameInput(event: Event): void {
  const target = event.target;

  if (target instanceof HTMLInputElement) {
    emit("update:displayName", target.value);
  }
}

watch(
  [() => props.stream, videoRef],
  () => {
    const el = videoRef.value;

    if (el !== null) {
      el.srcObject = props.stream;
    }
  },
  { immediate: true },
);
</script>

<template>
  <section class="prejoin">
    <div class="preview">
      <div class="preview-media">
        <video
          v-show="stream !== null && !isCameraOff"
          ref="videoRef"
          class="preview-video"
          autoplay
          muted
          playsinline
        />
        <div v-if="stream === null || isCameraOff" class="preview-empty">
          <FontAwesomeIcon icon="video-slash" />
          <span>Камера выключена</span>
        </div>
      </div>

      <div class="preview-controls">
        <button
          class="round"
          type="button"
          data-tooltip="Микрофон"
          :class="{ danger: isMuted }"
          @click="emit('toggleMute')"
        >
          <FontAwesomeIcon :icon="isMuted ? 'microphone-slash' : 'microphone'" />
        </button>
        <button
          class="round"
          type="button"
          data-tooltip="Камера"
          :class="{ danger: isCameraOff }"
          @click="emit('toggleCamera')"
        >
          <FontAwesomeIcon :icon="isCameraOff ? 'video-slash' : 'video'" />
        </button>
      </div>
    </div>

    <label class="label">
      Ваше имя
      <input
        class="field"
        maxlength="40"
        :value="displayName"
        @input="onNameInput"
      />
    </label>

    <p v-if="nameError" class="error">{{ nameError }}</p>
    <p v-if="mediaError" class="muted">{{ mediaError }}</p>
    <p v-if="joinError" class="error">{{ joinError }}</p>

    <button
      class="btn btn-primary btn-join"
      type="button"
      :disabled="isJoining"
      @click="emit('join')"
    >
      Присоединиться
    </button>
  </section>
</template>

<style scoped lang="scss">
.prejoin {
  width: min(420px, calc(100% - 32px));
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 100%;
}

@media (max-width: 720px) {
  .prejoin {
    width: min(420px, calc(100% - 24px));
    gap: 10px;
  }

  .preview-media {
    aspect-ratio: 16 / 11;
  }

  .btn-join {
    height: 48px;
  }
}

@media (min-width: 721px) and (max-width: 1024px) {
  .prejoin {
    width: min(520px, calc(100% - 32px));
  }
}

.preview {
  position: relative;
}

.preview-media {
  position: relative;
  overflow: hidden;
  border-radius: $radius-tile;
  background: $color-surface;
  aspect-ratio: 16 / 10;
}

.preview-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}

.preview-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: $color-text-secondary;
}

.preview-controls {
  position: absolute;
  left: 50%;
  bottom: 12px;
  z-index: 2;
  display: flex;
  gap: 8px;
  transform: translateX(-50%);
}

.round {
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: $radius-round;
  background: $color-surface-alt;
  color: $color-text;
}

.round:hover {
  background: #3a3b3c;
}

.round.danger {
  background: $color-danger;
  color: #fff;
}

.label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: $color-text-secondary;
  font-size: 13px;
}

.error {
  margin: 0;
  color: $color-danger;
}

.muted {
  margin: 0;
  color: $color-text-secondary;
  font-size: 14px;
}

.btn-join {
  height: 48px;
}
</style>

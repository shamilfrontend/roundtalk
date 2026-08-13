<script setup lang="ts">
defineProps<{
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  selectedAudioId: string;
  selectedVideoId: string;
  selectedOutputId: string;
}>();

const emit = defineEmits<{
  close: [];
  selectAudio: [id: string];
  selectVideo: [id: string];
  selectOutput: [id: string];
}>();

function labelOf(device: MediaDeviceInfo, fallback: string, index: number): string {
  return device.label.length > 0 ? device.label : `${fallback} ${index + 1}`;
}

function onSelectAudio(event: Event): void {
  const target = event.target;

  if (target instanceof HTMLSelectElement) {
    emit("selectAudio", target.value);
  }
}

function onSelectVideo(event: Event): void {
  const target = event.target;

  if (target instanceof HTMLSelectElement) {
    emit("selectVideo", target.value);
  }
}

function onSelectOutput(event: Event): void {
  const target = event.target;

  if (target instanceof HTMLSelectElement) {
    emit("selectOutput", target.value);
  }
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <section class="panel">
      <header class="head">
        <h2>Настройки</h2>
        <button class="icon-btn" type="button" @click="emit('close')">
          <FontAwesomeIcon icon="xmark" />
        </button>
      </header>

      <label class="label">
        Микрофон
        <select
          class="field"
          :value="selectedAudioId"
          @change="onSelectAudio"
        >
          <option
            v-for="(device, index) in audioInputs"
            :key="device.deviceId"
            :value="device.deviceId"
          >
            {{ labelOf(device, "Микрофон", index) }}
          </option>
        </select>
      </label>

      <label class="label">
        Камера
        <select
          class="field"
          :value="selectedVideoId"
          @change="onSelectVideo"
        >
          <option
            v-for="(device, index) in videoInputs"
            :key="device.deviceId"
            :value="device.deviceId"
          >
            {{ labelOf(device, "Камера", index) }}
          </option>
        </select>
      </label>

      <label class="label">
        Динамик
        <select
          class="field"
          :value="selectedOutputId"
          @change="onSelectOutput"
        >
          <option
            v-for="(device, index) in audioOutputs"
            :key="device.deviceId"
            :value="device.deviceId"
          >
            {{ labelOf(device, "Динамик", index) }}
          </option>
        </select>
      </label>
    </section>
  </div>
</template>

<style scoped lang="scss">
.overlay {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: grid;
  place-items: end center;
  padding: 0 16px var(--toolbar-space, 96px);
  background: rgba(0, 0, 0, 0.35);
}

.panel {
  width: min(400px, 100%);
  background: $color-surface-alt;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

h2 {
  margin: 0;
  font-size: 18px;
}

.icon-btn {
  border: 0;
  background: transparent;
  color: $color-text-secondary;
}

.label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: $color-text-secondary;
}
</style>

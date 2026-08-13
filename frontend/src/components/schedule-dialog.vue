<script setup lang="ts">
import { computed, ref } from "vue";
import { toDateTimeLocalValue } from "@/composables/format";

const DURATION_OPTIONS: number[] = [15, 30, 45, 60, 90, 120];

interface ScheduleInitial {
  title: string;
  scheduledAt: string;
  durationMin: number;
}

const props = defineProps<{
  initial?: ScheduleInitial;
}>();

const emit = defineEmits<{
  close: [];
  submit: [payload: { title: string; scheduledAt: string; durationMin: number }];
}>();

const isEdit = computed(() => props.initial !== undefined);

const title = ref(props.initial?.title ?? "Встреча");
const durationMin = ref(props.initial?.durationMin ?? 60);
const scheduledAt = ref(
  props.initial !== undefined
    ? toDateTimeLocalValue(new Date(props.initial.scheduledAt))
    : toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)),
);
const error = ref<string | null>(null);

const minValue = computed(() => toDateTimeLocalValue(new Date()));

const durationOptions = computed(() => {
  if (DURATION_OPTIONS.includes(durationMin.value)) {
    return DURATION_OPTIONS;
  }

  return [...DURATION_OPTIONS, durationMin.value].sort((a, b) => a - b);
});

function onSubmit(): void {
  const name = title.value.trim();
  const date = new Date(scheduledAt.value);

  if (Number.isNaN(date.getTime())) {
    error.value = "Укажите дату и время";
    return;
  }

  if (date.getTime() < Date.now()) {
    error.value = "Дата должна быть в будущем";
    return;
  }

  error.value = null;
  emit("submit", {
    title: name.length > 0 ? name : "Встреча",
    scheduledAt: date.toISOString(),
    durationMin: durationMin.value,
  });
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <form class="dialog" @submit.prevent="onSubmit">
      <div class="dialog-head">
        <h2>{{ isEdit ? "Изменить встречу" : "Запланировать встречу" }}</h2>
        <button class="icon-btn" type="button" @click="emit('close')">
          <FontAwesomeIcon icon="xmark" />
        </button>
      </div>

      <label class="label">
        Название
        <input v-model="title" class="field" maxlength="120" />
      </label>

      <label class="label">
        Дата и время
        <input
          v-model="scheduledAt"
          class="field"
          type="datetime-local"
          :min="minValue"
        />
      </label>

      <label class="label">
        Длительность
        <select v-model.number="durationMin" class="field">
          <option
            v-for="item in durationOptions"
            :key="item"
            :value="item"
          >
            {{ item }} мин
          </option>
        </select>
      </label>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="dialog-actions">
        <button class="btn btn-ghost" type="button" @click="emit('close')">
          Отмена
        </button>
        <button class="btn btn-primary" type="submit">
          {{ isEdit ? "Сохранить" : "Создать" }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped lang="scss">
.overlay {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.55);
  padding: 16px;
}

.dialog {
  width: min(440px, 100%);
  background: $color-surface-alt;
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

h2 {
  margin: 0;
  font-size: 20px;
}

.label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: $color-text-secondary;
  font-size: 13px;
}

.icon-btn {
  border: 0;
  background: transparent;
  color: $color-text-secondary;
  width: 32px;
  height: 32px;
}

.error {
  margin: 0;
  color: $color-danger;
  font-size: 14px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>

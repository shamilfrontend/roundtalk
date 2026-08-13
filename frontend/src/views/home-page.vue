<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { parseRoomLink } from "@/api/rooms";
import AppHeader from "@/components/app-header.vue";
import ScheduleDialog from "@/components/schedule-dialog.vue";
import { formatDateTime, ROOM_STATUS_LABEL } from "@/composables/format";
import { useAuthStore } from "@/stores/auth";
import { useMeetingsStore } from "@/stores/meetings";

const FEATURES = [
  {
    icon: "circle-check",
    title: "Без оплаты",
    text: "Встречи бесплатно, без подписки и ограничений по минутам",
  },
  {
    icon: "signal",
    title: "Качество связи",
    text: "Видео и звук через WebRTC, при необходимости через TURN",
  },
  {
    icon: "comments",
    title: "Чат и экран",
    text: "Переписка в комнате и демонстрация экрана одному участнику",
  },
  {
    icon: "unlock",
    title: "Вход гостем",
    text: "По ссылке можно зайти с именем, без аккаунта",
  },
] as const;

const router = useRouter();
const auth = useAuthStore();
const meetings = useMeetingsStore();

const link = ref("");
const joinError = ref<string | null>(null);
const scheduleOpen = ref(false);

const visibleMeetings = computed(() =>
  meetings.items.filter((item) => item.status !== "ended"),
);

watch(
  () => auth.isAuthenticated,
  (ok) => {
    if (ok) {
      void meetings.fetchMine();
    }
  },
  { immediate: true },
);

async function createMeeting(): Promise<void> {
  if (!auth.isAuthenticated) {
    await router.push({ name: "login" });
    return;
  }

  try {
    const room = await meetings.createInstant();
    await router.push({ name: "room", params: { roomId: room.roomId } });
  } catch {
    return;
  }
}

function openSchedule(): void {
  if (!auth.isAuthenticated) {
    void router.push({ name: "login" });
    return;
  }

  scheduleOpen.value = true;
}

async function onSchedule(payload: {
  title: string;
  scheduledAt: string;
  durationMin: number;
}): Promise<void> {
  try {
    await meetings.scheduleMeeting(payload);
    scheduleOpen.value = false;
  } catch {
    return;
  }
}

function joinByLink(): void {
  const roomId = parseRoomLink(link.value);

  if (roomId === null) {
    joinError.value = "Вставьте ссылку или код комнаты";
    return;
  }

  joinError.value = null;
  void router.push({ name: "room", params: { roomId } });
}
</script>

<template>
  <div class="home">
    <AppHeader :is-creating="meetings.isCreating" @create="createMeeting" />

    <section class="hero">
      <div class="hero-copy">
        <h1>Видеовстречи по ссылке</h1>
        <p class="lead">
          Создайте комнату, пригласите участников и подключайтесь из браузера.
          Гости входят без аккаунта.
        </p>

        <div class="cta">
          <button
            class="btn btn-primary btn-wide"
            type="button"
            :disabled="meetings.isCreating"
            @click="createMeeting"
          >
            <FontAwesomeIcon icon="phone" />
            Создать встречу
          </button>
          <button
            v-if="auth.isAuthenticated"
            class="btn btn-ghost"
            type="button"
            @click="openSchedule"
          >
            <FontAwesomeIcon icon="calendar" />
            Запланировать
          </button>
        </div>

        <form class="join" @submit.prevent="joinByLink">
          <input
            v-model="link"
            class="field join-input"
            placeholder="Ссылка на звонок"
          />
          <button class="join-call" type="submit" title="Подключиться">
            <FontAwesomeIcon icon="phone" />
          </button>
        </form>
        <p v-if="joinError" class="error">{{ joinError }}</p>
        <p v-if="meetings.error" class="error">{{ meetings.error }}</p>
      </div>

      <div class="hero-mock" aria-hidden="true">
        <div class="laptop">
          <div class="laptop-screen">
            <div class="fake-tile" />
            <div class="fake-tile" />
            <div class="fake-tile" />
            <div class="fake-tile self" />
          </div>
        </div>
        <div class="phone">
          <div class="phone-screen">
            <div class="fake-tile" />
            <div class="fake-tile self" />
          </div>
        </div>
      </div>
    </section>

    <section class="features">
      <article v-for="item in FEATURES" :key="item.title" class="feature">
        <span class="feature-icon">
          <FontAwesomeIcon :icon="item.icon" />
        </span>
        <h2>{{ item.title }}</h2>
        <p>{{ item.text }}</p>
      </article>
    </section>

    <section v-if="auth.isAuthenticated" class="meetings">
      <h2>Мои встречи</h2>
      <p v-if="meetings.isLoading" class="muted">Загрузка…</p>
      <p v-else-if="visibleMeetings.length === 0" class="muted">
        Пока нет встреч — создайте или запланируйте
      </p>
      <div v-else class="cards">
        <RouterLink
          v-for="item in visibleMeetings"
          :key="item.roomId"
          class="card"
          :to="{ name: 'room', params: { roomId: item.roomId } }"
        >
          <span class="badge" :data-status="item.status">
            {{ ROOM_STATUS_LABEL[item.status] ?? item.status }}
          </span>
          <h3>{{ item.title }}</h3>
          <p>
            {{
              item.scheduledAt
                ? formatDateTime(item.scheduledAt)
                : formatDateTime(item.createdAt)
            }}
          </p>
          <p class="muted">{{ item.durationMin }} мин</p>
        </RouterLink>
      </div>
    </section>

    <ScheduleDialog
      v-if="scheduleOpen"
      @close="scheduleOpen = false"
      @submit="onSchedule"
    />
  </div>
</template>

<style scoped lang="scss">
.home {
  min-height: 100%;
  padding-bottom: 64px;
}

.hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  align-items: center;
  padding: 32px 32px 48px;
  max-width: 1120px;
  margin: 0 auto;
}

.hero-copy h1 {
  margin: 0 0 12px;
  font-size: 48px;
  line-height: 1.1;
}

.lead {
  margin: 0 0 24px;
  color: $color-text-secondary;
  font-size: 18px;
  max-width: 440px;
}

.cta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.btn-wide {
  min-width: 240px;
  height: 52px;
  font-size: 16px;
}

.join {
  display: flex;
  gap: 8px;
  max-width: 420px;
}

.join-input {
  flex: 1;
}

.join-call {
  width: 48px;
  height: 48px;
  border: 0;
  border-radius: $radius-round;
  background: $color-accent;
  color: #fff;
}

.join-call:hover {
  background: $color-accent-hover;
}

.error {
  color: $color-danger;
  margin: 8px 0 0;
}

.hero-mock {
  position: relative;
  min-height: 340px;
}

.laptop {
  width: min(460px, 100%);
  background: $color-surface-alt;
  border-radius: 16px;
  padding: 12px 12px 28px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4);
}

.laptop-screen {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  background: $color-bg;
  border-radius: 12px;
  padding: 10px;
  aspect-ratio: 16 / 10;
}

.fake-tile {
  border-radius: $radius-tile;
  background: $color-surface;
}

.fake-tile.self {
  background: #3a3b3c;
}

.phone {
  position: absolute;
  right: 8px;
  bottom: -16px;
  width: 140px;
  background: $color-surface-alt;
  border-radius: 18px;
  padding: 8px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
}

.phone-screen {
  display: grid;
  gap: 6px;
  background: $color-bg;
  border-radius: 12px;
  padding: 8px;
  height: 220px;
}

.features {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 32px 48px;
}

.feature {
  background: $color-surface;
  border-radius: 16px;
  padding: 20px;
}

.feature-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: $color-surface-alt;
  color: $color-accent;
  margin-bottom: 12px;
}

.feature h2 {
  margin: 0 0 8px;
  font-size: 16px;
}

.feature p,
.muted {
  margin: 0;
  color: $color-text-secondary;
  font-size: 14px;
}

.meetings {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 32px;
}

.meetings h2 {
  margin: 0 0 16px;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.card {
  display: block;
  background: $color-surface;
  border-radius: 16px;
  padding: 16px;
  text-decoration: none;
}

.card h3 {
  margin: 8px 0 4px;
  font-size: 18px;
}

.card p {
  margin: 0;
  color: $color-text-secondary;
  font-size: 14px;
}

.badge {
  display: inline-block;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 12px;
  background: $color-surface-alt;
}

.badge[data-status="live"] {
  color: #8fd19e;
}

.badge[data-status="scheduled"] {
  color: $color-accent;
}

@media (max-width: 900px) {
  .hero,
  .features {
    grid-template-columns: 1fr;
  }

  .hero-copy h1 {
    font-size: 36px;
  }

  .hero-mock {
    display: none;
  }
}
</style>

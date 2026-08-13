<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import type { ChatMessagePublic, ParticipantPublic } from "@/types/room";

const props = defineProps<{
  tab: "chat" | "participants";
  messages: ChatMessagePublic[];
  participants: ParticipantPublic[];
  selfSocketId: string | null;
  isHost: boolean;
  isEnding: boolean;
}>();

const emit = defineEmits<{
  close: [];
  send: [text: string];
  endForEveryone: [];
}>();

const draft = ref("");
const listRef = ref<HTMLElement | null>(null);

watch(
  () => props.messages.length,
  async () => {
    await nextTick();
    const el = listRef.value;

    if (el !== null) {
      el.scrollTop = el.scrollHeight;
    }
  },
);

function onSend(): void {
  const text = draft.value.trim();

  if (text.length === 0) {
    return;
  }

  emit("send", text);
  draft.value = "";
}
</script>

<template>
  <aside class="sidebar">
    <header class="head">
      <h2>{{ tab === "chat" ? "Чат" : "Участники" }}</h2>
      <button class="icon-btn" type="button" @click="emit('close')">
        <FontAwesomeIcon icon="xmark" />
      </button>
    </header>

    <div v-if="tab === 'chat'" class="chat">
      <div ref="listRef" class="messages">
        <p v-if="messages.length === 0" class="empty">Пока нет сообщений</p>
        <article v-for="item in messages" :key="item.id" class="message">
          <strong>{{ item.senderDisplayName }}</strong>
          <p>{{ item.text }}</p>
        </article>
      </div>
      <form class="composer" @submit.prevent="onSend">
        <input
          v-model="draft"
          class="field"
          maxlength="1000"
          placeholder="Сообщение"
        />
        <button
          class="btn btn-primary send"
          type="submit"
          aria-label="Отправить"
        >
          <span class="send-label">Отправить</span>
          <FontAwesomeIcon class="send-icon" icon="paper-plane" />
        </button>
      </form>
    </div>

    <div v-else class="people-wrap">
      <ul class="people">
        <li v-for="item in participants" :key="item.socketId ?? item.displayName">
          <span>
            {{ item.displayName }}
            <template v-if="item.socketId === selfSocketId"> (вы)</template>
            <template v-if="item.role === 'host'"> · хост</template>
          </span>
          <span class="flags">
            <FontAwesomeIcon v-if="item.isMuted" icon="microphone-slash" />
            <FontAwesomeIcon v-if="item.isHandRaised" icon="hand" />
          </span>
        </li>
      </ul>
      <div v-if="isHost" class="host-actions">
        <button
          class="btn btn-danger"
          type="button"
          :disabled="isEnding"
          @click="emit('endForEveryone')"
        >
          Завершить для всех
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped lang="scss">
.sidebar {
  display: flex;
  flex-direction: column;
  width: 360px;
  max-width: 100%;
  background: $color-surface;
  border-radius: $radius-tile;
  overflow: hidden;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

h2 {
  margin: 0;
  font-size: 16px;
}

.icon-btn {
  border: 0;
  background: transparent;
  color: $color-text-secondary;
}

.chat {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.messages {
  flex: 1;
  overflow: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message p {
  margin: 0;
  overflow-wrap: anywhere;
}

.empty,
.people {
  color: $color-text-secondary;
}

.composer {
  display: flex;
  gap: 8px;
  padding: 12px;
  padding-bottom: max(12px, env(safe-area-inset-bottom, 0px));
}

.send-icon {
  display: none;
}

.people {
  list-style: none;
  margin: 0;
  padding: 8px 0;
  overflow: auto;
  flex: 1;
}

.people-wrap {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.host-actions {
  padding: 12px 16px 16px;
}

.host-actions .btn {
  width: 100%;
}

.people li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 16px;
  color: $color-text;
}

.flags {
  display: flex;
  gap: 8px;
  color: $color-text-secondary;
}

@media (max-width: 720px) {
  .sidebar {
    width: 100%;
    height: 100%;
    border-radius: 0;
  }

  .composer {
    padding-bottom: 12px;
  }

  .send {
    width: 48px;
    padding: 0;
    flex: none;
  }

  .send-label {
    display: none;
  }

  .send-icon {
    display: block;
  }
}
</style>

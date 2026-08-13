<script setup lang="ts">
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "👏", "🎉"] as const;

defineProps<{
  isMuted: boolean;
  isCameraOff: boolean;
  isHandRaised: boolean;
  isHost: boolean;
  isSharing: boolean;
  shareDisabled: boolean;
  reactionsOpen: boolean;
  sidebar: "chat" | "participants" | null;
  settingsOpen: boolean;
}>();

const emit = defineEmits<{
  toggleChat: [];
  toggleParticipants: [];
  toggleShare: [];
  toggleHand: [];
  toggleReactions: [];
  react: [emoji: string];
  toggleMute: [];
  toggleCamera: [];
  toggleSettings: [];
  hangup: [];
}>();
</script>

<template>
  <nav class="toolbar" aria-label="Управление звонком">
    <div class="secondary">
      <div class="cluster extra">
      <button
        class="round"
        type="button"
        data-tooltip="Чат"
        :class="{ active: sidebar === 'chat' }"
        @click="emit('toggleChat')"
      >
        <FontAwesomeIcon icon="comment" />
      </button>

      <button
        class="round"
        type="button"
        :data-tooltip="
          shareDisabled
            ? 'Демонстрация уже идёт'
            : isSharing
              ? 'Остановить демонстрацию'
              : 'Демонстрация экрана'
        "
        :class="{ active: isSharing }"
        :disabled="shareDisabled"
        @click="emit('toggleShare')"
      >
        <FontAwesomeIcon icon="desktop" />
      </button>

      <button
        class="round"
        type="button"
        data-tooltip="Поднять руку"
        :class="{ active: isHandRaised }"
        @click="emit('toggleHand')"
      >
        <FontAwesomeIcon icon="hand" />
      </button>

      <div class="react-wrap">
        <button
          class="round"
          type="button"
          data-tooltip="Реакции"
          :class="{ active: reactionsOpen }"
          @click="emit('toggleReactions')"
        >
          <FontAwesomeIcon icon="face-smile" />
        </button>
        <div v-if="reactionsOpen" class="emoji-pop" role="menu">
          <button
            v-for="emoji in REACTION_EMOJIS"
            :key="emoji"
            class="emoji"
            type="button"
            @click.stop="emit('react', emoji)"
          >
            {{ emoji }}
          </button>
        </div>
      </div>
    </div>

    <div class="cluster extra">
      <button
        class="round"
        type="button"
        data-tooltip="Участники"
        :class="{ active: sidebar === 'participants' }"
        @click="emit('toggleParticipants')"
      >
        <FontAwesomeIcon icon="users" />
      </button>

      <button
        class="round"
        type="button"
        data-tooltip="Настройки"
        :class="{ active: settingsOpen }"
        @click="emit('toggleSettings')"
      >
        <FontAwesomeIcon icon="gear" />
      </button>
    </div>
    </div>

    <div class="cluster main">
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

      <button
        class="round hangup"
        type="button"
        :data-tooltip="isHost ? 'Завершить для всех' : 'Выйти'"
        @click="emit('hangup')"
      >
        <FontAwesomeIcon icon="phone-slash" />
      </button>
    </div>
  </nav>
</template>

<style scoped lang="scss">
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 999px;
  background: $color-surface;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.secondary,
.cluster {
  display: contents;
}

.round {
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: $radius-round;
  background: $color-surface-alt;
  color: $color-text;
}

.round:hover:not(:disabled) {
  background: #3a3b3c;
}

.round:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.round.active {
  background: $color-accent;
  color: #fff;
}

.round.danger {
  background: $color-danger;
  color: #fff;
}

.round.hangup {
  background: $color-danger;
  color: #fff;
}

.react-wrap {
  position: relative;
}

.emoji-pop {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 10px);
  z-index: 6;
  display: flex;
  gap: 4px;
  transform: translateX(-50%);
  padding: 6px;
  border-radius: 999px;
  background: $color-surface;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

.emoji {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: $radius-round;
  background: transparent;
  font-size: 20px;
}

.emoji:hover {
  background: $color-surface-alt;
}

@media (max-width: 720px) {
  .toolbar {
    flex-direction: column;
    gap: 8px;
    width: 100%;
    padding: 8px 8px calc(8px + env(safe-area-inset-bottom, 0px));
    border-radius: 20px;
  }

  .secondary,
  .cluster {
    display: flex;
    align-items: center;
    justify-content: space-around;
    width: 100%;
    gap: 4px;
  }

  .cluster.extra {
    width: auto;
    flex: 1;
  }

  .cluster.extra .round {
    width: 44px;
    height: 44px;
  }

  .cluster.main .round {
    width: 52px;
    height: 52px;
  }

  .emoji-pop {
    left: auto;
    right: -8px;
    transform: none;
    flex-wrap: wrap;
    width: 160px;
    justify-content: center;
    border-radius: 16px;
  }

  .emoji {
    width: 36px;
    height: 36px;
    font-size: 20px;
  }
}

@media (max-width: 720px) and (orientation: landscape) {
  .toolbar {
    flex-direction: row;
    gap: 4px;
    padding: 6px 6px calc(6px + env(safe-area-inset-bottom, 0px));
    border-radius: 16px;
  }

  .secondary,
  .cluster {
    display: contents;
  }

  .round,
  .cluster.extra .round,
  .cluster.main .round {
    width: 40px;
    height: 40px;
  }
}

@media (min-width: 721px) and (max-width: 1024px) {
  .toolbar {
    width: 100%;
    gap: 10px;
    justify-content: space-around;
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px));
    border-radius: 20px;
  }

  .round {
    width: 48px;
    height: 48px;
  }
}
</style>

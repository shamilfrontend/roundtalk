<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useMetrika } from "@/composables/use-metrika";

const route = useRoute();
const { consent, accept, decline } = useMetrika();

const inRoom = computed(() => route.name === "room");
</script>

<template>
  <div
    v-if="consent === null"
    class="banner"
    :class="{ 'in-room': inRoom }"
    role="dialog"
    aria-label="Cookies"
  >
    <p>
      Используем cookies и Яндекс.Метрику (карта кликов, Вебвизор), чтобы понять,
      как работает сервис.
      <RouterLink :to="{ name: 'privacy' }">Политика конфиденциальности</RouterLink>
    </p>
    <div class="actions">
      <button class="btn btn-ghost" type="button" @click="decline">
        Отклонить
      </button>
      <button class="btn btn-primary" type="button" @click="accept">
        Принять
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.banner {
  position: fixed;
  right: 16px;
  bottom: max(16px, env(safe-area-inset-bottom, 0px));
  left: 16px;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  max-width: 720px;
  margin: 0 auto;
  padding: 16px 20px;
  border-radius: $radius-tile;
  background: $color-surface-alt;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
}

.banner.in-room {
  top: max(8px, env(safe-area-inset-top, 0px));
  bottom: auto;
}

p {
  margin: 0;
  color: $color-text-secondary;
  font-size: 14px;
  line-height: 1.45;
}

a {
  color: $color-accent;
}

.actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}

@media (max-width: 720px) {
  .banner {
    flex-direction: column;
    align-items: stretch;
  }

  .actions {
    justify-content: flex-end;
  }
}
</style>

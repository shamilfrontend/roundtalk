<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { getAuthApiUrl } from "@/api/auth";

const ERROR_TEXT: Record<string, string> = {
  oauth_denied: "Вы отменили вход",
  email_required: "Разрешите доступ к email",
  oauth_failed: "Не удалось войти. Попробуйте ещё раз",
};

const route = useRoute();
const yandexUrl = getAuthApiUrl("/api/auth/yandex");
const vkUrl = getAuthApiUrl("/api/auth/vk");

const errorText = computed(() => {
  const code = route.query.error;

  if (typeof code !== "string" || code.length === 0) {
    return null;
  }

  return ERROR_TEXT[code] ?? "Не удалось войти";
});
</script>

<template>
  <main class="login">
    <RouterLink class="logo" :to="{ name: 'home' }">Roundtalk</RouterLink>

    <section class="card">
      <h1>Вход</h1>
      <p class="lead">
        Аккаунт создаётся при первом входе через Яндекс или VK
      </p>

      <p v-if="errorText" class="error">{{ errorText }}</p>

      <a class="oauth" :href="yandexUrl">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <rect width="24" height="24" rx="6" fill="#FC3F1D" />
          <path
            d="M13.1 18h-2.2V6.4h3.2c2.1 0 3.4 1.2 3.4 3.1 0 1.5-.8 2.6-2.1 3l2.4 5.5h-2.4l-2.1-5h-.2V18Zm0-6.8h.8c1 0 1.6-.6 1.6-1.5s-.6-1.5-1.6-1.5h-.8v3Z"
            fill="#fff"
          />
        </svg>
        Войти через Яндекс
      </a>

      <a class="oauth" :href="vkUrl">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <rect width="24" height="24" rx="6" fill="#0077FF" />
          <path
            d="M7.2 8.2h2.1c.1 3.7 1.7 5.2 3 5.5V8.2h2.1v3.2c1.3-.2 2.6-1.6 3-3.2H19c-.4 2.2-1.8 3.7-2.9 4.3 1.1.5 2.6 1.8 3.2 3.9h-2.3c-.5-1.6-1.8-2.9-3.1-3.1v3.1h-2.1c-4.3 0-6.8-3.1-6.9-8.1Z"
            fill="#fff"
          />
        </svg>
        Войти через VK
      </a>
    </section>
  </main>
</template>

<style scoped lang="scss">
.login {
  min-height: 100%;
  display: grid;
  place-items: center;
  padding: 24px;
}

.logo {
  position: absolute;
  top: 24px;
  left: 32px;
  font-weight: 700;
  text-decoration: none;
}

.card {
  width: min(400px, 100%);
  background: $color-surface;
  border-radius: 16px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

h1 {
  margin: 0;
  font-size: 28px;
}

.lead {
  margin: 0 0 8px;
  color: $color-text-secondary;
}

.error {
  margin: 0;
  color: $color-danger;
}

.oauth {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 48px;
  border-radius: $radius-control;
  background: $color-surface-alt;
  text-decoration: none;
}

.oauth:hover {
  background: #353637;
}
</style>

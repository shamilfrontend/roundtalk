<script setup lang="ts">
import { RouterLink, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";

defineProps<{
  isCreating?: boolean;
}>();

const emit = defineEmits<{
  create: [];
}>();

const auth = useAuthStore();
const router = useRouter();

async function onLogout(): Promise<void> {
  await auth.logout();
  await router.push({ name: "home" });
}
</script>

<template>
  <header class="header">
    <RouterLink class="logo" :to="{ name: 'home' }">
      <span class="logo-mark">
        <FontAwesomeIcon icon="phone" />
      </span>
      Roundtalk
    </RouterLink>

    <div class="actions">
      <button
        class="btn btn-primary"
        type="button"
        aria-label="Создать встречу"
        :disabled="isCreating"
        @click="emit('create')"
      >
        <FontAwesomeIcon icon="plus" />
        <span class="btn-label">Создать встречу</span>
      </button>

      <template v-if="auth.isAuthenticated">
        <span class="name">{{ auth.user?.name }}</span>
        <button
          class="btn btn-ghost"
          type="button"
          aria-label="Выйти"
          @click="onLogout"
        >
          <FontAwesomeIcon icon="right-from-bracket" />
          <span class="btn-label">Выйти</span>
        </button>
      </template>

      <RouterLink v-else class="btn btn-ghost" :to="{ name: 'login' }">
        Войти
      </RouterLink>
    </div>
  </header>
</template>

<style scoped lang="scss">
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 32px;
}

.logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: $color-text;
  font-weight: 700;
  text-decoration: none;
  font-size: 18px;
}

.logo-mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: $color-accent;
  color: #fff;
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.name {
  color: $color-text-secondary;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .header {
    padding: 12px 16px;
    gap: 8px;
  }

  .actions {
    gap: 8px;
  }

  .actions .btn {
    padding: 10px 12px;
  }

  .btn-label {
    display: none;
  }

  .name {
    display: none;
  }
}
</style>

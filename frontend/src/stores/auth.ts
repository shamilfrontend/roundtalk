import { computed, ref } from "vue";
import { defineStore } from "pinia";
import axios from "axios";
import { fetchCurrentUser, logoutRequest } from "@/api/auth";
import { getApiErrorMessage } from "@/api/http";
import type { AuthUser } from "@/types/auth";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<AuthUser | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const isReady = ref(false);

  const isAuthenticated = computed(() => user.value !== null);

  function reset(): void {
    user.value = null;
    isLoading.value = false;
    error.value = null;
  }

  async function fetchMe(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      user.value = await fetchCurrentUser();
    } catch (err: unknown) {
      user.value = null;

      if (!axios.isAxiosError(err) || err.response?.status !== 401) {
        error.value = getApiErrorMessage(err, "Не удалось загрузить профиль");
      }
    } finally {
      isLoading.value = false;
      isReady.value = true;
    }
  }

  async function logout(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      await logoutRequest();
    } catch (err: unknown) {
      error.value = getApiErrorMessage(err, "Не удалось выйти");
    } finally {
      reset();
      isReady.value = true;
    }
  }

  return {
    user,
    isLoading,
    error,
    isReady,
    isAuthenticated,
    reset,
    fetchMe,
    logout,
  };
});

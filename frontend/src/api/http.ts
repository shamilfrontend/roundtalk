import axios, { type InternalAxiosRequestConfig } from "axios";

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

let refreshPromise: Promise<void> | null = null;

function isRefreshUrl(url: string | undefined): boolean {
  return (url ?? "").includes("/api/auth/refresh");
}

export function refreshSession(): Promise<void> {
  if (refreshPromise === null) {
    refreshPromise = http
      .post("/api/auth/refresh")
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

async function resetAuth(): Promise<void> {
  const { useAuthStore } = await import("@/stores/auth");
  useAuthStore().reset();
}

http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const config = error.config as RetryConfig | undefined;

    if (config === undefined || config._retry || isRefreshUrl(config.url)) {
      await resetAuth();
      return Promise.reject(error);
    }

    config._retry = true;

    try {
      await refreshSession();
      return await http.request(config);
    } catch (refreshError) {
      await resetAuth();
      return Promise.reject(refreshError);
    }
  },
);

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data: unknown = error.response?.data;

    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof data.message === "string"
    ) {
      return data.message;
    }
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallback;
}

export function getApiErrorCode(error: unknown): string | null {
  if (!axios.isAxiosError(error)) {
    return null;
  }

  const data: unknown = error.response?.data;

  if (
    typeof data === "object" &&
    data !== null &&
    "code" in data &&
    typeof data.code === "string"
  ) {
    return data.code;
  }

  return null;
}

export function isNotFoundError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

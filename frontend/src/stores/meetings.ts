import { ref } from "vue";
import { defineStore } from "pinia";
import { createRoom, fetchHostRooms, updateRoom } from "@/api/rooms";
import { getApiErrorMessage } from "@/api/http";
import type { RoomListItem } from "@/types/room";

export const useMeetingsStore = defineStore("meetings", () => {
  const items = ref<RoomListItem[]>([]);
  const isLoading = ref(false);
  const isCreating = ref(false);
  const isUpdating = ref(false);
  const error = ref<string | null>(null);

  async function fetchMine(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      items.value = await fetchHostRooms();
    } catch (err: unknown) {
      error.value = getApiErrorMessage(err, "Не удалось загрузить встречи");
    } finally {
      isLoading.value = false;
    }
  }

  async function createInstant(): Promise<RoomListItem> {
    isCreating.value = true;
    error.value = null;

    try {
      const room = await createRoom();
      items.value = [room, ...items.value];

      return room;
    } catch (err: unknown) {
      error.value = getApiErrorMessage(err, "Не удалось создать встречу");
      throw err;
    } finally {
      isCreating.value = false;
    }
  }

  async function scheduleMeeting(input: {
    title: string;
    scheduledAt: string;
    durationMin: number;
  }): Promise<RoomListItem> {
    isCreating.value = true;
    error.value = null;

    try {
      const room = await createRoom({
        title: input.title,
        scheduledAt: input.scheduledAt,
        durationMin: input.durationMin,
      });
      items.value = [room, ...items.value];

      return room;
    } catch (err: unknown) {
      error.value = getApiErrorMessage(err, "Не удалось запланировать встречу");
      throw err;
    } finally {
      isCreating.value = false;
    }
  }

  async function updateScheduled(
    roomId: string,
    input: {
      title: string;
      scheduledAt: string;
      durationMin: number;
    },
  ): Promise<RoomListItem> {
    isUpdating.value = true;
    error.value = null;

    try {
      const room = await updateRoom(roomId, {
        title: input.title,
        scheduledAt: input.scheduledAt,
        durationMin: input.durationMin,
      });
      items.value = items.value.map((item) =>
        item.roomId === roomId ? room : item,
      );

      return room;
    } catch (err: unknown) {
      error.value = getApiErrorMessage(err, "Не удалось изменить встречу");
      throw err;
    } finally {
      isUpdating.value = false;
    }
  }

  return {
    items,
    isLoading,
    isCreating,
    isUpdating,
    error,
    fetchMine,
    createInstant,
    scheduleMeeting,
    updateScheduled,
  };
});

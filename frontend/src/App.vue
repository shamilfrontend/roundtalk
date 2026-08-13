<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();

void auth.fetchMe();
</script>

<template>
  <router-view v-if="auth.isReady" />
</template>

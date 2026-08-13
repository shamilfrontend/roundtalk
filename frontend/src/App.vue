<script setup lang="ts">
import { useRouter } from "vue-router";
import CookieBanner from "@/components/cookie-banner.vue";
import { hitMetrika, initMetrika } from "@/composables/use-metrika";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const router = useRouter();

void auth.fetchMe();
initMetrika();

router.afterEach((to) => {
  hitMetrika(to.fullPath);
});
</script>

<template>
  <router-view v-if="auth.isReady" />
  <CookieBanner />
</template>

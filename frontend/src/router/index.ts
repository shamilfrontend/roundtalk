import { createRouter, createWebHistory } from "vue-router";
import HomePage from "@/views/home-page.vue";
import LoginPage from "@/views/login-page.vue";
import RoomPage from "@/views/room-page.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomePage,
    },
    {
      path: "/login",
      name: "login",
      component: LoginPage,
    },
    {
      path: "/room/:roomId",
      name: "room",
      component: RoomPage,
    },
  ],
});

import { createPinia } from "pinia";
import { createApp } from "vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import App from "./App.vue";
import { router } from "./router";
import "./icons";
import "./styles/global.scss";

const app = createApp(App);

app.component("FontAwesomeIcon", FontAwesomeIcon);
app.use(createPinia());
app.use(router);
app.mount("#app");

/// <reference types="vite/client" />

export {};

declare module "*.vue" {
  import type { DefineComponent } from "vue";

  const component: DefineComponent<object, object, unknown>;
  export default component;
}

declare module "vue" {
  export interface GlobalComponents {
    FontAwesomeIcon: (typeof import("@fortawesome/vue-fontawesome"))["FontAwesomeIcon"];
  }
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SOCKET_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

import { ref } from "vue";

const COUNTER_ID = 111585227;
const SCRIPT_SRC = `https://mc.yandex.ru/metrika/tag.js?id=${COUNTER_ID}`;
const CONSENT_KEY = "roundtalk-cookie-consent";

export type CookieConsent = "accepted" | "declined";

interface YmInitOptions {
  ssr: boolean;
  webvisor: boolean;
  clickmap: boolean;
  ecommerce: string;
  referrer: string;
  url: string;
  accurateTrackBounce: boolean;
  trackLinks: boolean;
}

interface YmStub {
  (...args: unknown[]): void;
  a?: unknown[][];
  l?: number;
}

declare global {
  interface Window {
    ym?: YmStub;
  }
}

const consent = ref<CookieConsent | null>(readStoredConsent());

let scriptReady = false;

function readStoredConsent(): CookieConsent | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY);

    if (value === "accepted" || value === "declined") {
      return value;
    }
  } catch {
    return null;
  }

  return null;
}

function persistConsent(status: CookieConsent): void {
  try {
    localStorage.setItem(CONSENT_KEY, status);
  } catch {
    return;
  }
}

function createYmStub(): YmStub {
  const stub: YmStub = (...args: unknown[]) => {
    stub.a = stub.a ?? [];
    stub.a.push(args);
  };

  stub.l = Date.now();
  return stub;
}

function injectScript(): void {
  const scripts = document.scripts;

  for (let i = 0; i < scripts.length; i++) {
    if (scripts[i]?.src === SCRIPT_SRC) {
      return;
    }
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = SCRIPT_SRC;

  const first = document.getElementsByTagName("script")[0];

  if (first?.parentNode !== undefined && first.parentNode !== null) {
    first.parentNode.insertBefore(script, first);
    return;
  }

  document.head.appendChild(script);
}

export function initMetrika(): void {
  if (scriptReady || typeof window === "undefined") {
    return;
  }

  if (consent.value !== "accepted") {
    return;
  }

  scriptReady = true;
  window.ym = window.ym ?? createYmStub();
  injectScript();

  const options: YmInitOptions = {
    ssr: true,
    webvisor: true,
    clickmap: true,
    ecommerce: "dataLayer",
    referrer: document.referrer,
    url: location.href,
    accurateTrackBounce: true,
    trackLinks: true,
  };

  window.ym(COUNTER_ID, "init", options);
}

export function hitMetrika(url: string): void {
  if (consent.value !== "accepted" || window.ym === undefined) {
    return;
  }

  window.ym(COUNTER_ID, "hit", url);
}

export function useMetrika() {
  function accept(): void {
    persistConsent("accepted");
    consent.value = "accepted";
    initMetrika();
  }

  function decline(): void {
    persistConsent("declined");
    consent.value = "declined";
  }

  return {
    consent,
    accept,
    decline,
  };
}

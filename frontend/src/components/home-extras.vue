<script setup lang="ts">
import { ref } from "vue";
import { RouterLink } from "vue-router";

interface ShowcaseItem {
  icon: string;
  title: string;
  text: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

const SHOWCASE: ShowcaseItem[] = [
  {
    icon: "calendar",
    title: "Планирование встреч",
    text: "Укажите название, дату, время и длительность — комната откроется по расписанию",
  },
  {
    icon: "desktop",
    title: "Демонстрация экрана",
    text: "Покажите рабочий стол участникам: один шаринг на комнату",
  },
  {
    icon: "comments",
    title: "Чат в комнате",
    text: "Переписка рядом с видео, история хранится, пока встреча жива",
  },
  {
    icon: "hand",
    title: "Реакции и рука",
    text: "Emoji всплывают на плитке, поднятие руки видно всем в комнате",
  },
  {
    icon: "link",
    title: "Ссылка-приглашение",
    text: "Скопируйте ссылку из комнаты и отправьте тем, кого ждёте",
  },
  {
    icon: "video",
    title: "Микрофон и камера",
    text: "Включайте и выключайте свои устройства в любой момент встречи",
  },
];

const CHIPS: { icon: string; label: string }[] = [
  { icon: "users", label: "До 6 участников" },
  { icon: "unlock", label: "Вход гостем" },
  { icon: "signal", label: "TURN при слабой сети" },
  { icon: "phone-slash", label: "Завершение хостом" },
];

const FAQ: FaqItem[] = [
  {
    question: "Roundtalk бесплатный?",
    answer:
      "Да. Встречи без подписки и без оплаты за минуты.",
  },
  {
    question: "Нужен ли аккаунт?",
    answer:
      "Чтобы создать встречу — войдите через Яндекс или VK. Чтобы подключиться, достаточно имени по ссылке, аккаунт не нужен.",
  },
  {
    question: "Сколько участников в комнате?",
    answer: "Максимум 6 человек в одной встрече.",
  },
  {
    question: "Как пригласить участников?",
    answer:
      "В комнате нажмите «Ссылка» и скопируйте её. У кого есть ссылка — тот может войти.",
  },
  {
    question: "Какие браузеры поддерживаются?",
    answer: "Актуальные две мажорные версии Chrome, Firefox и Safari.",
  },
];

const openIndex = ref<number | null>(null);

function toggleFaq(index: number): void {
  openIndex.value = openIndex.value === index ? null : index;
}
</script>

<template>
  <div class="extras">
    <section class="showcase">
      <h2 class="section-title">Всё, что нужно для встречи</h2>
      <div class="showcase-grid">
        <article
          v-for="item in SHOWCASE"
          :key="item.title"
          class="showcase-card"
        >
          <span class="card-icon">
            <FontAwesomeIcon :icon="item.icon" />
          </span>
          <h3>{{ item.title }}</h3>
          <p>{{ item.text }}</p>
        </article>
      </div>
    </section>

    <section class="chips" aria-label="Возможности">
      <span v-for="chip in CHIPS" :key="chip.label" class="chip">
        <FontAwesomeIcon :icon="chip.icon" />
        {{ chip.label }}
      </span>
    </section>

    <section class="faq">
      <h2 class="section-title">Ответы на вопросы</h2>
      <div class="faq-list">
        <article
          v-for="(item, index) in FAQ"
          :key="item.question"
          class="faq-item"
        >
          <button
            class="faq-q"
            type="button"
            :aria-expanded="openIndex === index"
            @click="toggleFaq(index)"
          >
            <span>{{ item.question }}</span>
            <FontAwesomeIcon
              class="faq-chevron"
              :class="{ open: openIndex === index }"
              icon="chevron-down"
            />
          </button>
          <p v-if="openIndex === index" class="faq-a">{{ item.answer }}</p>
        </article>
      </div>
    </section>

    <footer class="footer">
      <span>© 2026 Roundtalk</span>
      <RouterLink :to="{ name: 'privacy' }">
        Политика конфиденциальности
      </RouterLink>
    </footer>
  </div>
</template>

<style scoped lang="scss">
.extras {
  max-width: 1120px;
  margin: 0 auto;
  padding: 16px 32px 0;
}

.section-title {
  margin: 0 0 28px;
  text-align: center;
  font-size: 32px;
  line-height: 1.2;
}

.showcase {
  padding-bottom: 48px;
}

.showcase-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.showcase-card {
  background: $color-surface;
  border-radius: $radius-tile;
  padding: 24px;
}

.card-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: $color-surface-alt;
  color: $color-accent;
  margin-bottom: 14px;
}

.showcase-card h3 {
  margin: 0 0 8px;
  font-size: 18px;
}

.showcase-card p {
  margin: 0;
  color: $color-text-secondary;
  font-size: 14px;
  line-height: 1.45;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  padding-bottom: 56px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  background: $color-surface;
  color: $color-text;
  font-size: 14px;
}

.chip svg {
  color: $color-accent;
}

.faq {
  padding-bottom: 48px;
}

.faq-list {
  max-width: 720px;
  margin: 0 auto;
}

.faq-item {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.faq-q {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  padding: 18px 0;
  border: 0;
  background: transparent;
  color: $color-text;
  font-size: 16px;
  text-align: left;
}

.faq-chevron {
  flex-shrink: 0;
  color: $color-text-secondary;
  transition: transform 0.15s ease;
}

.faq-chevron.open {
  transform: rotate(180deg);
}

.faq-a {
  margin: 0 0 18px;
  color: $color-text-secondary;
  font-size: 14px;
  line-height: 1.5;
}

.footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px 20px;
  padding: 24px 0 32px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: $color-text-secondary;
  font-size: 13px;
  text-align: center;
}

.footer a {
  color: $color-text-secondary;
  text-decoration: underline;
  text-underline-offset: 3px;
}

@media (max-width: 900px) {
  .extras {
    padding: 16px 16px 0;
  }

  .section-title {
    font-size: 24px;
  }

  .showcase-grid {
    grid-template-columns: 1fr;
  }
}
</style>

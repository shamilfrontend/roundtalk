<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <main class="privacy">
    <RouterLink class="logo" :to="{ name: 'home' }">Roundtalk</RouterLink>

    <article class="card">
      <h1>Политика конфиденциальности</h1>
      <p class="muted">Учебный тестовый проект RoundTalk</p>
      <p class="muted">Сайт: https://roundtalk.shamilfrontend.ru</p>

      <h2>1. Оператор</h2>
      <p>
        RoundTalk — учебный тестовый проект. Эта страница описывает, какие данные
        обрабатываются при использовании сервиса видеовстреч.
      </p>

      <h2>2. Какие данные обрабатываются</h2>
      <ul>
        <li>
          Аккаунт: email, имя, идентификатор Яндекс или VK — при входе через
          OAuth.
        </li>
        <li>
          Cookies авторизации: JWT (httpOnly) и служебные cookies OAuth
          (state, PKCE).
        </li>
        <li>
          Комнаты: название, расписание, длительность, display name участников.
        </li>
        <li>
          Чат комнаты: текст сообщений на время жизни встречи.
        </li>
        <li>
          Медиа: видео, звук и демонстрация экрана идут по WebRTC между
          участниками и на сервер не записываются. При плохой сети медиа может
          ретранслироваться через TURN. Для установки соединения используется
          STUN Google.
        </li>
        <li>
          Яндекс.Метрика: cookies, визиты, карта кликов и Вебвизор — только
          после согласия в баннере cookies.
        </li>
      </ul>

      <h2>3. Зачем обрабатываем</h2>
      <p>
        Чтобы создать аккаунт, провести встречу, показать чат и улучшить сервис
        по статистике посещений.
      </p>

      <h2>4. Третьи лица</h2>
      <ul>
        <li>Яндекс — вход (OAuth) и аналитика (Метрика, при согласии).</li>
        <li>VK — вход (OAuth).</li>
        <li>Google — STUN-сервер для WebRTC.</li>
      </ul>

      <h2>5. Срок хранения</h2>
      <p>
        Аккаунт хранится, пока вы им пользуетесь. Данные комнаты и чат — пока
        встреча жива. Cookies авторизации — по сроку JWT. Данные Метрики
        обрабатываются Яндексом по их политике.
      </p>

      <h2>6. Cookies и Метрика</h2>
      <p>
        Необходимые cookies нужны для входа. Аналитические cookies Яндекс.Метрики
        включаются только после кнопки «Принять». Отказ: «Отклонить» в баннере
        или удаление ключа
        <code>roundtalk-cookie-consent</code>
        в localStorage браузера.
      </p>

      <h2>7. Ваши права</h2>
      <p>
        Вы можете не входить в аккаунт и подключаться гостем по ссылке, отклонить
        Метрику, отозвать доступ OAuth в кабинете Яндекс или VK. Камера, микрофон
        и экран запрашиваются браузером и могут быть запрещены в любой момент.
      </p>

      <p class="note">
        Проект учебный, юридическое лицо не зарегистрировано. Текст носит
        ознакомительный характер.
      </p>
    </article>
  </main>
</template>

<style scoped lang="scss">
.privacy {
  min-height: 100%;
  padding: 88px 24px 48px;
  padding-bottom: max(48px, env(safe-area-inset-bottom, 0px));
}

.logo {
  position: absolute;
  top: 24px;
  left: 32px;
  font-weight: 700;
  text-decoration: none;
}

.card {
  width: min(720px, 100%);
  margin: 0 auto;
  background: $color-surface;
  border-radius: 16px;
  padding: 32px;
}

h1 {
  margin: 0 0 8px;
  font-size: 28px;
}

h2 {
  margin: 24px 0 8px;
  font-size: 18px;
}

p,
li {
  margin: 0;
  color: $color-text;
  font-size: 15px;
  line-height: 1.55;
}

p + p,
ul {
  margin-top: 8px;
}

ul {
  padding-left: 20px;
}

li + li {
  margin-top: 8px;
}

.muted,
.note {
  color: $color-text-secondary;
  font-size: 14px;
}

.note {
  margin-top: 24px;
}

code {
  font-size: 13px;
}

@media (max-width: 720px) {
  .privacy {
    padding: 72px 16px 24px;
    padding-bottom: max(24px, env(safe-area-inset-bottom, 0px));
  }

  .logo {
    top: 16px;
    left: 16px;
  }

  .card {
    padding: 20px;
  }

  h1 {
    font-size: 24px;
  }
}
</style>

# roundtalk

Приложение онлайн-видеозвонков и встреч.

## Стек

- Клиент: Vue 3, Vite, TypeScript, SCSS, Vue Router, Pinia, axios
- Сервер: Node.js, Express, Mongoose (MongoDB)
- Реалтайм: Socket.io (сигнализация, чат, роли) — один процесс, без Redis adapter
- Медиа: WebRTC mesh, STUN (Google) + TURN (Coturn)
- Пакетный менеджер: yarn
- Инфраструктура: VPS Ubuntu 26, Docker Compose
  (Caddy, frontend, backend, MongoDB, Coturn); HTTPS — Caddy
  (Let’s Encrypt автоматически)

Репозиторий: папки `frontend` и `backend`. Секреты — только `.env`.

## Функциональные требования

- вход через Яндекс и VK (OAuth 2.0); аккаунт создаётся при первом входе
- создание встречи авторизованным пользователем — сразу вход в живую комнату
- планирование встречи на дату и время (title, scheduledAt, duration)
- список «мои встречи» у автора
- вход по ссылке `https://roundtalk.shamilfrontend.ru/room/:roomId`
  (гость — с display name, без аккаунта)
- приглашение: копирование ссылки из комнаты
- видео/аудио, демонстрация экрана (один шаринг на комнату)
- чат комнаты (история в MongoDB на время жизни комнаты)
- реакции emoji, поднятие руки
- вкл/выкл своего микрофона и камеры
- выход из комнаты; создатель (хост) может завершить комнату для всех

Вебинары (ведущий/слушатели, дать слово) — не в этой версии.

## Нефункциональные требования

- UI на русском
- браузеры: Chrome, Firefox, Safari (актуальные две мажорные версии)
- встреча (mesh): максимум 6 участников
- доступ в комнату — у любого, у кого есть ссылка
- CORS: только origin продакшена и localhost
- лимиты: display name 2–40 символов, сообщение чата до 1000 символов,
  реакции не чаще 1/сек на сокет
- чат как текст (без HTML), валидация всех body/params
- JWT access короткий TTL; refresh в httpOnly cookie
- TURN: временные HMAC-credentials, не статичный логин в клиенте

## Дизайн

Референс визуала и компоновки: [VK Звонки](https://calls.vk.ru/index.php)
(лендинг + комната). Копируем **layout, плотность, тёмную тему и паттерны
кнопок**, не бренд VK: свой логотип/название Roundtalk, без значка VK
и без шрифта VK Sans.

Токены (SCSS-переменные, тёмная тема по умолчанию):

- фон: `#141414`
- поверхность (инпут, карточка, сайдбар): `#222222` / `#2C2D2E`
- текст: `#E1E3E6`, вторичный: `#818C99`
- акцент (CTA): `#0077FF`, hover `#0062D1`
- опасное (сброс звонка, mic/cam off): `#E64646`
- кольцо говорящего на плитке: `#0077FF`
- радиус: кнопки/инпуты `12px`, видеоплитки `16px`,
  круглые кнопки панели `50%`
- шрифт: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
- иконки: Font Awesome, линейные, как на панели VK Звонков

### Лендинг `/`

Как на calls.vk.ru:

- шапка: логотип слева; справа «Создать встречу» и «Войти»
  (если сессия есть — имя и выход);
- hero в две колонки: слева заголовок + короткий текст + CTA,
  справа мокап комнаты (ноутбук + телефон или статичный коллаж);
- основной CTA — широкая синяя «Создать встречу» (иконка плюс/трубка);
  у авторизованного рядом призрачная «Запланировать»;
- под CTA: тёмный инпут «Ссылка на звонок» + кнопка-трубка «Подключиться»;
- ниже ряд из 4 блоков (иконка + заголовок + 1 строка): без оплаты,
  качество связи, чат и экран, вход гостем без аккаунта;
- у авторизованного под hero список «Мои встречи» (карточки, не таблица).

Создание: клик «Создать встречу» → сразу `POST /api/rooms` и комната
(без диалога типа). «Запланировать» — диалог: title, дата/время, duration.

Auth `/login` — та же тёмная оболочка, карточка по центру:
«Войти через Яндекс» и «Войти через VK» (логотипы провайдеров).
Отдельной регистрации нет: первый OAuth создаёт User.

### Комната `/room/:id`

Как веб-клиент VK Звонков (мокап на лендинге):

- на весь экран тёмный фон, без светлой «админки»;
- верх: название, таймер, кнопка-пилюля «Ссылка»;
- один участник — пустое состояние по центру: «Пригласите участников»
  + копирование ссылки;
- сетка скруглённых видеоплиток; имя слева снизу, бейдж mute,
  кольцо говорящего;
- своё видео — PIP, зеркально;
- шаринг: экран по центру, участники столбиком справа (как на мокапе);
- нижняя панель — тёмная «пилюля» по центру: чат, демонстрация, рука,
  микрофон, камера, завершение (красная), участники, настройки;
  mic/cam выкл — красные круги;
- чат и список участников — правый сайдбар поверх сетки (тёмный);
- pre-join: по центру превью камеры, поле имени, «Присоединиться».

## Архитектура

- клиент — Docker (сборка SPA)
- сервер Express + Socket.io — Docker, одна replica
- MongoDB — Docker
- Coturn — Docker, UDP/TCP 3478 и relay-диапазон
- Caddy в Compose (порты 80/443): HTTPS (Let’s Encrypt), отдача SPA,
  `reverse_proxy` `/api` и `/socket.io` на backend (WebSocket)

### Модель `User`

- `email` (unique, lowercase) — из OAuth-провайдера
- `yandexId` — уникальный sparse, id из Яндекс ID
- `vkId` — уникальный sparse, id из VK ID
- `name`
- `createdAt`

Связка аккаунтов: OAuth (Яндекс или VK) с email, который уже есть —
пишем `yandexId` / `vkId` в существующего пользователя, не создаём
второго. Один User может иметь оба провайдера.

### Модель `Room`

- `roomId` — публичный уникальный id (в ссылке)
- `title` — строка, для мгновенной комнаты можно сгенерировать
- `status` — `scheduled` | `live` | `ended`
- `hostId` — `User._id` создателя
- `scheduledAt` — дата старта или `null` (мгновенная)
- `durationMin` — длительность, по умолчанию 60
- `endedAt`
- `createdAt`
- `participants[]`:
  `{ userId?: ObjectId, displayName, role: 'host' | 'participant',
     isMuted: boolean, isCameraOff: boolean, isHandRaised: boolean,
     socketId?: string }`

Правила статуса:

- мгновенная комната: `live` сразу; когда вышел последний участник → `ended`
- запланированная: `scheduled` до старта; вход до `scheduledAt` —
  экран «комната ещё не началась» (хост может открыть раньше → `live`);
  пустая запланированная **не** удаляется и **не** переводится в `ended`
- `ended` по кнопке хоста «завершить для всех» или по выходу последнего
  из мгновенной `live`

### Модель `ChatMessage`

- `roomId`, `senderDisplayName`, `senderUserId?`, `text`, `createdAt`
- история отдаётся при `join-room` и пишется в MongoDB
- после `ended` сообщения можно чистить джобом (не в первой версии)

## REST API

Auth:

- `GET /api/auth/yandex` — редирект на `https://oauth.yandex.ru/authorize`
  (`response_type=code`, scope `login:email login:info`, `state` в сессии/cookie)
- `GET /api/auth/yandex/callback` — обмен `code` на токен
  (`https://oauth.yandex.ru/token`), профиль
  (`https://login.yandex.ru/info`), find-or-create User, JWT-cookie,
  редирект на `CLIENT_URL`. Если Яндекс не отдал email — ошибка
  («разрешите доступ к email»). `state` обязателен, несовпадение → 403.
- `GET /api/auth/vk` — редирект на VK ID `https://id.vk.ru/authorize`
  (`response_type=code`, scope `email`, `state`, PKCE S256)
- `GET /api/auth/vk/callback` — обмен `code` на токен
  (`POST https://id.vk.ru/oauth2/auth`), профиль
  (`POST https://id.vk.ru/oauth2/user_info`), find-or-create User,
  JWT-cookie, редирект на `CLIENT_URL`. Без email — ошибка
  («разрешите доступ к email»). `state` / PKCE verifier — 403 при несовпадении.
- `POST /api/auth/logout`
- `GET /api/auth/me` — текущий пользователь (JWT)

Секреты OAuth (`YANDEX_CLIENT_SECRET`, `VK_CLIENT_SECRET`) на клиент
не попадают. Токены провайдеров не логировать и в Mongo не хранить.

Комнаты (создание/список/завершение — только авторизованный, `hostId` из токена):

- `POST /api/rooms` — `{ title?, scheduledAt?, durationMin? }`
  без `scheduledAt` → сразу `live` и редирект в комнату
- `GET /api/rooms` — комнаты текущего пользователя (`hostId`)
- `GET /api/rooms/:roomId` — публично: `{ roomId, title, status,
  scheduledAt, hostId }` или 404
- `PATCH /api/rooms/:roomId` — хост: title / scheduledAt / durationMin,
  пока `scheduled`
- `POST /api/rooms/:roomId/end` — хост: `status = ended` (для всех)

## Socket.io

Handshake: гость — `{ roomId, displayName }`; авторизованный —
`{ roomId, token }`. Один сокет на пару пользователь/вкладка в комнате:
повторный вход в ту же комнату отключает предыдущий сокет.

События клиента → сервер:

| Событие | Payload |
|---|---|
| `join-room` | `{ roomId, displayName }` |
| `webrtc-offer` / `webrtc-answer` | `{ toSocketId, sdp }` |
| `webrtc-ice` | `{ toSocketId, candidate }` |
| `chat-message` | `{ text }` |
| `reaction` | `{ emoji }` |
| `raise-hand` | `{ raised: boolean }` |
| `media-state` | `{ isMuted, isCameraOff }` |
| `screen-share` | `{ active: boolean }` |
| `leave-room` | — |

События сервер → клиент:

| Событие | Payload |
|---|---|
| `room-state` | комната + participants + последние сообщения чата |
| `user-joined` / `user-left` | participant |
| `user-replaced` | старый сокет отключён из-за повторного входа |
| `chat-message` | сообщение |
| `reaction` | `{ socketId, emoji }` |
| `hand-raised` | `{ socketId, raised }` |
| `media-state` | `{ socketId, isMuted, isCameraOff }` |
| `screen-share` | `{ socketId, active }` |
| `room-ended` | — |
| `error` | `{ code, message }` |

WebRTC-сигналы сервер проксирует как есть (`fromSocketId`).

## Медиа

- все участники с камерой/микрофоном, mesh, лимит 6
- `host` = создатель комнаты (может завершить для всех)
- шаринг экрана: любой участник; второй `getDisplayMedia` отклоняется,
  пока первый активен
- замена видео-трека в существующих `PeerConnection` + `screen-share`

## План разработки

### Этап 1: Проектирование и подготовка

1. Схемы БД и контракты API/сокетов (этот документ).
2. Окружение: yarn, `.env`, Google STUN + Coturn.

`.env` (backend): `PORT`, `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`,
`CORS_ORIGIN`, `TURN_SECRET`, `TURN_URLS`, `CLIENT_URL`,
`YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`, `YANDEX_REDIRECT_URI`,
`VK_CLIENT_ID`, `VK_CLIENT_SECRET`, `VK_REDIRECT_URI`
(prod callback: `https://roundtalk.shamilfrontend.ru/api/auth/yandex/callback`
и `.../api/auth/vk/callback`).

`.env` (frontend): `VITE_API_URL`, `VITE_SOCKET_URL`.

TURN-секреты на клиент не попадают — backend отдаёт временные
credentials (например `GET /api/turn`).

### Этап 2: Серверная часть (Node.js + Express + Mongoose)

3. HTTP-сервер: Express, CORS по `CORS_ORIGIN`, JSON, morgan
   (без токенов в логах), `GET /health`.
4. MongoDB: модели `User`, `Room`, `ChatMessage`.
5. Auth API: OAuth Яндекс и VK ID (authorize + callback, find-or-create).
6. Rooms API (см. выше).
7. Socket.io на том же HTTP-сервере, комнаты socket.io = `roomId`,
   события из таблицы.

### Этап 3: Клиентская часть (Vue 3 + Vite + TypeScript + SCSS)

8. Vite + Vue 3: TypeScript, глобальный SCSS, Vue Router, Pinia
   (setup stores, для async — `isLoading` / `error`), axios-инстанс
   с интерцепторами (JWT, 401).
9. Страница `/login`: «Войти через Яндекс» → `GET /api/auth/yandex`,
   «Войти через VK» → `GET /api/auth/vk`. Страниц `/register`,
   `/forgot-password`, `/reset-password` нет.
10. Главная — вёрстка по разделу «Дизайн» (как [VK Звонки](https://calls.vk.ru/index.php)):
    - гость: инпут ссылки + «Подключиться»; «Создать встречу» → логин;
    - пользователь: «Создать встречу», «Запланировать», ссылка,
      «мои встречи»;
    - создание: `POST /api/rooms` → `/room/:id`;
    - планирование: диалог title / дата / duration → `scheduled`.
11. Pre-join `/room/:id`:
    - если 404 / `ended` — отдельные экраны;
    - если `scheduled` и сейчас < `scheduledAt` и не хост —
      «комната ещё не началась»;
    - обязательный display name (из профиля подставляется, гость вводит);
    - превью камеры/мика по возможности, ошибки getUserMedia не блокируют
      вход без медиа.
12. Страница комнаты `/room/:id` — по разделу «Дизайн»:
    - таймер, «Ссылка», пустое состояние, сетка / layout шаринга;
    - нижняя пилюля (хост «завершить для всех», остальные — выход);
    - правый сайдбар: чат и участники (звук, рука);
    - настройки: выбор mic/cam/динамика;
    - адаптив: на узком экране сайдбар на весь экран, панель снизу.

### Этап 4: Ядро видеозвонков (WebRTC)

13. `getUserMedia`, локальное превью, ошибки «нет камеры / нет разрешения».
14. `PeerConnection` на каждого участника; SDP и ICE через Socket.io.
15. Mesh: новый участник делает offer уже находящимся в комнате.
16. `ontrack`; закрытие PC при `user-left` / выходе.
17. ICE failed — тост «не удалось установить медиа, проверьте сеть/TURN».

### Этап 5: Дополнительные функции

18. Демонстрация экрана: `getDisplayMedia`, замена трека, сигнал
    `screen-share`.
19. Чат: composable, `chat-message`, сайдбар, история из `room-state`.
20. Реакции emoji (не только лайк) и рука — всплытие на плитке участника.
21. `media-state`; хост в списке участников может завершить комнату.

### Этап 6: Завершение и оптимизация

22. Краевые случаи:
    - обрыв Socket.io и переподключение с тем же display name / token;
    - закрытие вкладки → `leave-room` + `beforeunload`;
    - повторный вход в комнату → старый сокет отключается (`user-replaced`);
    - ICE failed;
    - второй шаринг экрана — отказ;
    - лимит участников — `error` с кодом `room-full`.
23. UI/UX: тултипы, тосты вход/выход/сообщения, зеркало своего видео.
24. Проверка: несколько окон браузера; два клиента через интернет (TURN).
25. Деплой `roundtalk.shamilfrontend.ru`:
    - Docker Compose: Caddy, frontend, backend, MongoDB, Coturn;
    - Caddyfile: авто-HTTPS, SPA, прокси `/api` и `/socket.io`;
    - UDP-порты Coturn опубликованы на хост.

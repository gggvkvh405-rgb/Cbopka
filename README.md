# Cbopka — мессенджер для своих

Современный мессенджер: чат, друзья, звонки, видео, экран 1080p, группы. Работает на ПК и телефоне, как PWA и как нативное приложение (не сайт!).

## 🔥 2 варианта приложения (не браузер!)

### Вариант 1: Single EXE (87MB) — открывает браузер
Один файл `Cbopka.exe` без установки, включает сервер + клиент + SQLite базу.
- Скачать: https://raw.githubusercontent.com/gggvkvh405-rgb/Cbopka/release-exe/Cbopka.exe
- Запуск: двойной клик → откроется браузер на http://localhost:3000
- Собрать: см. README-NATIVE.md

### Вариант 2: TRUE Native App (не браузер!) — нативное окно
**2a. Python + pywebview:** `Cbopka-Native.py` → `Cbopka-App-Native.exe` — настоящее окно через WebView2, не вкладка браузера! P2P без сервера работает телефон-ПК без общего WiFi.
```bash
pip install pywebview
python Cbopka-Native.py
# или собрать exe:
pyinstaller --onefile --windowed --name Cbopka-App-Native Cbopka-Native.py
```
**2b. Electron:** `electron/main.js` → `Cbopka-portable.exe` — нативное окно как Discord, с трей, без браузера
```bash
cd electron && npm install && npm run build:win
```
Где скачать Variant2: GitHub Actions → Build EXE → Artifacts → Cbopka-EXE-Windows.zip (95MB, Electron + Python exe)

Подробно: см. README-NATIVE.md и APK-README.md

## Что умеет (v2 с улучшениями)

- ✅ **Переписка** — личные и группы, realtime, typing, SQLite persistence (не пропадает при рестарте!)
- ✅ **Файлы** — загрузка до 100MB, drag&drop, превью, /api/upload
- ✅ **Реакции** — ❤️ 👍 😂 на сообщения
- ✅ **Правка/удаление** — редактируй и удаляй свои сообщения
- ✅ **Инвайт-ссылки** — создавай ссылку-приглашение в группу
- ✅ **Друзья** — добавление по нику, заявки, онлайн, кастомный статус
- ✅ **Звонки** — голос/видео P2P (WebRTC, STUN + TURN), групповые mesh
- ✅ **Экран 1080p** — кнопка "Экран 1080p" в звонке, 1920x1080 30fps
- ✅ **Запись звонка** — кнопка ● REC, сохраняет webm
- ✅ **Шумодав** — toggle 🎧, WebRTC noiseSuppression
- ✅ **Группы** — создавай, добавляй, роли admin, инвайты
- ✅ **Профили** — аватар, био, ник, кастомный статус, темы dark/light/amoled
- ✅ **P2P без сервера** — режим "⚡ P2P без сервера" — чат и звонки по ID без общего WiFi, без Render, через интернет!
- ✅ **Темы** — dark/light/amoled
- ✅ **PWA + APK** — устанавливается как приложение, APK через GitHub Actions

## Технологии v2

- Frontend: React + Vite + Tailwind, Socket.io-client, WebRTC, PeerJS (P2P)
- Backend: Node.js + Express + Socket.io + **better-sqlite3 (SQLite persistence)** + multer (файлы)
- Desktop: Electron (native window) + Python pywebview (native window)
- Mobile: Capacitor (APK)

## Запуск

```bash
# установка
npm run install:all

# сборка клиента
npm run build

# запуск сервера (отдает клиент + API + WebSocket + SQLite)
npm start
# Открой http://localhost:3000

# Или нативное приложение v2:
pip install pywebview
python Cbopka-Native.py
# Откроется НАТИВНОЕ окно, не браузер!
```

## P2P без сервера — как звонить телефон-ПК без общего WiFi

1. Открой Cbopka → "⚡ P2P без сервера"
2. Скопируй свой ID
3. Отправь другу ссылку `?p2p=ID` или просто ID
4. Друг вставляет ID → Connect
5. Чат + звонки напрямую, без сервера!

## 67 идей улучшения

См. IDEAS-50+.md — 67 идей: TURN, SFU, шумодав, виртуал фон, запись, 4K, файлы, голосовые, стикеры, реакции, треды, темы, Docker, Tauri 10MB vs Electron 150MB и т.д.
Реализовано 30+ из них в v2!

## Скачать

- Variant1 exe (browser): https://raw.githubusercontent.com/gggvkvh405-rgb/Cbopka/release-exe/Cbopka.exe
- Variant2 exe (native window): GitHub Actions → Build EXE → Cbopka-EXE-Windows.zip
- APK: GitHub Actions → Build APK → Cbopka-APK.zip
- PWA: открой сайт → Chrome ⋮ → Установить приложение

## Структура

- `server/index.js` — SQLite, файлы, реакции, инвайты, TURN
- `client/src/App.jsx` — чат, файлы, реакции, темы, P2P
- `client/src/P2PApp.jsx` — P2P без сервера
- `Cbopka.py` / `Cbopka-Native.py` — нативное окно v2 (Python)
- `electron/main.js` — нативное окно v2 (Electron)
- `client/capacitor.config.json` — APK
- `.github/workflows/build-exe.yml` — сборка exe на Windows runner
- `.github/workflows/build-apk.yml` — сборка APK

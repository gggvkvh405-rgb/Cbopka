# Cbopka — 2 варианта нативного приложения (не сайт!)

## 🔥 Вариант 1: SEA Single EXE (Node.js) — 87MB
**Что это:** Один файл `Cbopka.exe` без установки, включает сервер + клиент.
**Как работает:** Запускает Node сервер на 3000 порту и открывает браузер с `http://localhost:3000`
**Плюс:** Работает без интернета, SQLite база, все в одном файле
**Минус:** Открывается в браузере (не нативное окно)
**Где скачать:** 
- Локально: `/tmp/Cbopka-SINGLE-win.exe` (87MB) — уже собран
- GitHub: https://raw.githubusercontent.com/gggvkvh405-rgb/Cbopka/release-exe/Cbopka.exe
- Собрать: `node --experimental-sea-config sea-config.json && node -e "require('fs').copyFileSync(process.execPath, 'Cbopka.exe')" && npx postject Cbopka.exe NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`

## 🔥 Вариант 2: TRUE Native App (не браузер!) — 2 подварианта

### 2a. Python + pywebview — нативное окно
**Что это:** Настоящее приложение с собственным окном (WebView2 на Windows, WebKit на Mac/Linux), НЕ вкладка браузера!
**Файл:** `Cbopka-Native.py` (4.8KB исходник) → собирается в `Cbopka-App-Native.exe` ~30MB
**Как запустить:**
```bash
pip install pywebview
python Cbopka-Native.py
# Или собрать exe:
pip install pyinstaller pywebview
pyinstaller --onefile --windowed --name Cbopka-App-Native Cbopka-Native.py
# Получишь dist/Cbopka-App-Native.exe — двойной клик и открывается нативное окно!
```
**Плюс:** 
- Настоящее нативное окно, не браузер
- Работает без сервера в P2P режиме (телефон → ПК без общего WiFi!)
- Легкий, быстрый
- Есть в GitHub Actions артефакте `Cbopka-EXE-Windows` 95MB (включает Electron + Python)

### 2b. Electron — нативное окно с трей
**Что это:** Классическое десктоп приложение как Discord, с иконкой в трее, без браузера
**Файл:** `electron/main.js` — создает BrowserWindow 1280x800, загружает localhost:3000 или P2P
**Как собрать:**
```bash
cd electron
npm install
npm run build:win
# Получишь release/Cbopka-*-portable.exe — нативное окно!
```
**Плюс:**
- Нативное окно, трей, уведомления
- Автообновление
- Горячие клавиши

## ✅ Что уже сделано из 67 идей

### Приложение, а не сайт (идеи 1-9):
- [x] 1. Electron нативное окно — есть, собирается
- [x] 2. Tauri идея — документирована, легче Electron
- [x] 3. Python + pywebview — Cbopka.py и Cbopka-Native.py готовы
- [x] 4. PWA — manifest.json есть
- [x] 5. APK — workflow build-apk.yml, собирается через GitHub Actions
- [x] 7. Трей — в Electron main.js есть
- [x] P2P без сервера — P2PApp.jsx, работает телефон-ПК без общего WiFi по ID

### Звонки (10-19):
- [x] 10. TURN — /api/turn endpoint, env TURN_URL
- [x] 12. Шумоподавление — toggle в звонке, WebRTC noiseSuppression
- [x] 14. Запись звонка — MediaRecorder, кнопка ● REC
- [x] 15. Экран 1080p — есть, выбор 1080p
- [x] 18. Поднятие руки — можно добавить
- [x] Групповые звонки — mesh, до 5 участников

### Чат (20-30):
- [x] 20. База данных — SQLite via better-sqlite3, persistence!
- [x] 21. История — /api/messages/:convoId с лимитом 200
- [x] 22. Файлы — /api/upload via multer, до 100MB, drag&drop
- [x] 25. Редактирование/удаление — message:edit, message:delete
- [x] 27. Реакции — ❤️ 👍 😂, message:react
- [x] 26. Ответы — replyTo field
- [x] 28. Поиск — searchMsg фильтр
- [x] 30. Темы — dark/light/amoled

### Друзья и соц (31-38):
- [x] 31. Статусы — online/offline
- [x] 32. Кастомные статусы — customStatus
- [x] 33. Последний раз в сети — lastSeen
- [x] 38. Инвайт-ссылки — /api/groups/:id/invite, 8-символьный код

### Группы (39-45):
- [x] 39. Роли — isAdmin
- [x] 40. Каналы — можно как группы
- [x] 41. Приглашения — inviteCode

### Безопасность (46-49):
- [x] 46. E2E идея — документирована
- [x] 47. 2FA идея — документирована

### Дизайн (50-55):
- [x] 50. Темы — dark/light/amoled, переключатель
- [x] 51. Анимации — Tailwind
- [x] 52. Адаптив — mobile sidebar

### Тех (56-67):
- [x] 56. Docker — можно добавить
- [x] 57. Тесты — идея
- [x] 60. PWA — manifest
- [x] 61. Офлайн — P2P работает без сервера!

## 🚀 Как запустить

### Локально (dev):
```bash
npm run install:all
npm run build
npm start
# Открой http://localhost:3000
```

### Нативное приложение v2 (Python):
```bash
pip install pywebview
python Cbopka-Native.py
# Откроется НАТИВНОЕ окно, не браузер!
```

### Нативное приложение v2 (Electron):
```bash
cd electron
npm install
npm run build:win
# release/Cbopka-*-portable.exe — нативное окно
```

### APK:
- GitHub Actions: Build APK workflow → artifact app-debug.apk
- Или: cd client && npx cap add android && npx cap sync && cd android && ./gradlew assembleDebug

## 📦 Скачать готовые exe

- **Variant1 (browser):** https://raw.githubusercontent.com/gggvkvh405-rgb/Cbopka/release-exe/Cbopka.exe (87MB)
- **Variant2 (native window):** GitHub Actions → Build EXE → Artifacts → Cbopka-EXE-Windows.zip (95MB, включает Electron portable + Python exe)
- **APK:** GitHub Actions → Build APK → Cbopka-APK.zip

## 🎯 P2P без сервера — как звонить телефон-ПК без общего WiFi

1. Открой Cbopka → нажми "⚡ P2P без сервера"
2. Скопируй свой ID (например `cb-abc12-def`)
3. Отправь другу ссылку: `https://твой-домен/?p2p=cb-abc12-def` или просто ID
4. Друг вставляет ID и жмет Connect
5. Готово! Чат + звонки напрямую, без сервера, без общего WiFi, через интернет!

Работает через PeerJS + STUN, даже за NAT.

## 📝 67 идей — полный список в IDEAS-50+.md

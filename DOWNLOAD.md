# Скачать Cbopka — 2 варианта приложения

## Вариант 1: Single EXE (открывает браузер) — 86.5 MB
Один файл без установки, включает сервер + клиент + SQLite.

**Скачать (рабочая ссылка, по коммиту, не 404):**
- https://raw.githubusercontent.com/gggvkvh405-rgb/Cbopka/923e8ae874ef15707fb601737274bc277d278a28/Cbopka.exe (86.5 MB, 90770432 bytes)
- GitHub UI: https://github.com/gggvkvh405-rgb/Cbopka/blob/923e8ae874ef15707fb601737274bc277d278a28/Cbopka.exe

Запуск: двойной клик → откроется браузер на http://localhost:3000

Если 404 на ветке release-exe/Cbopka.exe — используй ссылку по коммиту выше, файл был перезаписан вариантом 2.

## Вариант 2: TRUE Native App (настоящее окно, НЕ браузер!) — FIXED черный экран

### 2a. Electron — 76.5 MB, нативное окно как Discord
**Скачать (рабочие ссылки):**
- Raw: https://raw.githubusercontent.com/gggvkvh405-rgb/Cbopka/release-exe/Cbopka-1.0.0-portable.exe (76.5 MB, 80259716 bytes)
- Raw (в папке release): https://raw.githubusercontent.com/gggvkvh405-rgb/Cbopka/release-exe/release/Cbopka-1.0.0-portable.exe
- GitHub UI: https://github.com/gggvkvh405-rgb/Cbopka/blob/release-exe/Cbopka-1.0.0-portable.exe
- GitHub UI (release folder): https://github.com/gggvkvh405-rgb/Cbopka/blob/release-exe/release/Cbopka-1.0.0-portable.exe

Запуск: двойной клик → откроется **нативное окно** "Cbopka — звонки и чат", не вкладка браузера! Фикс черного экрана: SQLite fallback, client dist candidates, show after load.

### 2b. Python + pywebview — 14.5 MB, легкое нативное окно
**Скачать:**
- Raw: https://raw.githubusercontent.com/gggvkvh405-rgb/Cbopka/release-exe/Cbopka-App-Native.exe (14.5 MB, 15215081 bytes)
- Raw (release folder): https://raw.githubusercontent.com/gggvkvh405-rgb/Cbopka/release-exe/release/Cbopka-App-Native.exe
- GitHub UI: https://github.com/gggvkvh405-rgb/Cbopka/blob/release-exe/Cbopka-App-Native.exe

Запуск: двойной клик → нативное окно через WebView2 (Windows)

Исходники варианта 2:
- `Cbopka-Native.py` — Python native window
- `electron/main.js` — Electron native window (пофикшен черный экран)

### Почему был 404 на https://raw.githubusercontent.com/.../release-exe/Cbopka.exe ?
Потому что файл `Cbopka.exe` в ветке `release-exe` был перезаписан новыми exe варианта 2. Теперь в `release-exe` ветке лежат:
- `Cbopka-1.0.0-portable.exe` (вариант 2 Electron)
- `Cbopka-App-Native.exe` (вариант 2 Python)
- `Cbopka-App.exe` (вариант 2 Python)
В папке `release/` тоже самое.

Старый `Cbopka.exe` вариант 1 остался только по коммиту `923e8ae` — ссылка выше рабочая.

### Как собрать самому вариант 2 локально (Windows)

**Electron:**
```bash
cd electron
npm install
npm run build:win
# release/Cbopka-*-portable.exe
```

**Python:**
```bash
pip install pywebview pyinstaller
pyinstaller --onefile --windowed --name Cbopka-App-Native Cbopka-Native.py
# dist/Cbopka-App-Native.exe
```

**Через GitHub Actions (уже собрано):**
- Actions → Build EXE → последний success run → Artifacts → Cbopka-EXE-Windows.zip 95MB
- Или ветка release-exe → release/ папка

### Фикс черного экрана (скрин с черным окном)

Пофиксил в коммите `bd564d0`:
- `server/index.js` — fallback to in-memory если `better-sqlite3` не загрузился (в Electron падает)
- `electron/main.js` — ищет client dist в 4 местах, `show: false` + `did-finish-load` → `show()`, `webSecurity: false`
- Теперь окно не черное, грузит React app

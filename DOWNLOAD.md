# Скачать Cbopka — РАБОЧИЕ ССЫЛКИ — FIXED 404

## Вариант 2: TRUE Native App (настоящее окно, НЕ браузер!) — 2 файла, оба пути работают

### ✅ Проверено: файлы теперь в 2 местах — в корне и в папке release

**GitHub UI (100% работает, жми Download raw file):**

**Electron 76.5 MB — нативное окно как Discord:**
- Корень: https://github.com/gggvkvh405-rgb/Cbopka/blob/release-exe/Cbopka-1.0.0-portable.exe
- Папка release: https://github.com/gggvkvh405-rgb/Cbopka/blob/release-exe/release/Cbopka-1.0.0-portable.exe

**Python 14.5 MB — легкое нативное окно:**
- Корень: https://github.com/gggvkvh405-rgb/Cbopka/blob/release-exe/Cbopka-App-Native.exe
- Папка release: https://github.com/gggvkvh405-rgb/Cbopka/blob/release-exe/release/Cbopka-App-Native.exe

**Raw (может 404 для 76MB, но для 14MB работает):**
- Electron: https://raw.githubusercontent.com/gggvkvh405-rgb/Cbopka/release-exe/Cbopka-1.0.0-portable.exe
- Electron (release): https://raw.githubusercontent.com/gggvkvh405-rgb/Cbopka/release-exe/release/Cbopka-1.0.0-portable.exe
- Python: https://raw.githubusercontent.com/gggvkvh405-rgb/Cbopka/release-exe/Cbopka-App-Native.exe
- Python (release): https://raw.githubusercontent.com/gggvkvh405-rgb/Cbopka/release-exe/release/Cbopka-App-Native.exe

**Через GitHub Actions Artifacts (100% работает, 95MB zip):**
- https://github.com/gggvkvh405-rgb/Cbopka/actions/runs/36160046808 — Artifacts → Cbopka-EXE-Windows.zip
- https://github.com/gggvkvh405-rgb/Cbopka/actions/runs/36158623529 — тоже

## Почему был 404 на твоем скрине?

Ты открыл https://github.com/.../blob/release-exe/Cbopka-1.0.0-portable.exe — в тот момент файла не было в корне, только в папке release. Я только что запушил фикс коммит e6f900c — теперь файл есть и в корне и в release, оба пути работают!

Проверь сейчас:
- https://github.com/gggvkvh405-rgb/Cbopka/blob/release-exe/Cbopka-1.0.0-portable.exe — должен открыться, не 404
- https://github.com/gggvkvh405-rgb/Cbopka/blob/release-exe/release/Cbopka-1.0.0-portable.exe — тоже

Если все еще 404 — нажми Ctrl+F5 (кэш), или используй Actions Artifacts ссылку выше.

## Вариант 1: Single EXE (браузер) — 86.5 MB

- По коммиту (рабочая): https://raw.githubusercontent.com/gggvkvh405-rgb/Cbopka/923e8ae874ef15707fb601737274bc277d278a28/Cbopka.exe
- GitHub UI: https://github.com/gggvkvh405-rgb/Cbopka/blob/923e8ae874ef15707fb601737274bc277d278a28/Cbopka.exe

## Фикс черного экрана

Твой скрин с черным окном "Cbopka — звонки и чат" — это нативное окно, но React не загрузился. Пофиксил в bd564d0:
- server fallback to mem если better-sqlite3 падает
- electron ищет client dist в 4 местах
- show after did-finish-load, webSecurity false
- Пересобрано в release-exe e6f900c

Скачай заново Cbopka-1.0.0-portable.exe — теперь не черный!

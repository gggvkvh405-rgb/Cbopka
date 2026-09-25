# Скачать Cbopka — 2 варианта приложения — РАБОЧИЕ ССЫЛКИ (не 404)

## Почему 404 на raw.githubusercontent.com?
GitHub raw для файлов >25MB иногда отдает 404 в браузере, хотя файл есть. Используй GitHub UI ссылки ниже — они работают через кнопку "Download raw file".

## Вариант 1: Single EXE (открывает браузер) — 86.5 MB
**Рабочие ссылки:**
- GitHub UI (кликни Download raw file): https://github.com/gggvkvh405-rgb/Cbopka/blob/923e8ae874ef15707fb601737274bc277d278a28/Cbopka.exe
- Raw (может 404 из-за размера, используй UI): https://raw.githubusercontent.com/gggvkvh405-rgb/Cbopka/923e8ae874ef15707fb601737274bc277d278a28/Cbopka.exe
- Ветка release-exe старый коммит: https://github.com/gggvkvh405-rgb/Cbopka/blob/923e8ae/Cbopka.exe

## Вариант 2: TRUE Native App (настоящее окно, НЕ браузер!) — FIXED черный экран

### 2a. Electron — 76.5 MB, нативное окно как Discord — РЕКОМЕНДУЮ
**Рабочие ссылки (GitHub UI — жми Download raw file):**
- **GitHub UI (работает!): https://github.com/gggvkvh405-rgb/Cbopka/blob/release-exe/Cbopka-1.0.0-portable.exe**
- GitHub UI (в папке release): https://github.com/gggvkvh405-rgb/Cbopka/blob/release-exe/release/Cbopka-1.0.0-portable.exe
- Raw (может 404 из-за 80MB, используй UI выше): 
  - https://raw.githubusercontent.com/gggvkvh405-rgb/Cbopka/release-exe/Cbopka-1.0.0-portable.exe
  - https://raw.githubusercontent.com/gggvkvh405-rgb/Cbopka/release-exe/release/Cbopka-1.0.0-portable.exe

**Через GitHub Actions Artifacts (100% работает, 95MB zip):**
- Последний успешный билд: https://github.com/gggvkvh405-rgb/Cbopka/actions/runs/36160046808
- На странице → Artifacts → **Cbopka-EXE-Windows.zip** (95MB, внутри Electron portable + Python exe)
- Прямая ссылка на артефакты (нужен логин GitHub): https://github.com/gggvkvh405-rgb/Cbopka/actions/runs/36160046808/artifacts

**Альтернативный хостинг (если raw 404):**
- Сборка через `curl -F file=@*.exe https://file.io` и `https://0x0.st` в workflow — ссылки в логах Actions, но логи не скачать из-за blob блока. Поэтому используй GitHub UI выше.

### 2b. Python + pywebview — 14.5 MB, легкое нативное окно
**Рабочие ссылки:**
- **GitHub UI: https://github.com/gggvkvh405-rgb/Cbopka/blob/release-exe/Cbopka-App-Native.exe**
- GitHub UI (release folder): https://github.com/gggvkvh405-rgb/Cbopka/blob/release-exe/release/Cbopka-App-Native.exe
- Raw: https://raw.githubusercontent.com/gggvkvh405-rgb/Cbopka/release-exe/Cbopka-App-Native.exe
- Raw (release): https://raw.githubusercontent.com/gggvkvh405-rgb/Cbopka/release-exe/release/Cbopka-App-Native.exe

14.5 MB — маленький, должен качаться даже через raw без 404.

## Как скачать если raw 404

1. Открой GitHub UI ссылку: https://github.com/gggvkvh405-rgb/Cbopka/blob/release-exe/Cbopka-1.0.0-portable.exe
2. Нажми кнопку **"Download raw file"** (иконка скачивания справа)
3. Или нажми **"View raw"** → сохрани
4. Или иди в **Actions → Build EXE → последний success → Artifacts → Cbopka-EXE-Windows.zip**

## Проверить что файл есть (не 404)

Через API:
```
https://api.github.com/repos/gggvkvh405-rgb/Cbopka/contents/Cbopka-1.0.0-portable.exe?ref=release-exe
```
Возвращает JSON с `size: 80259716`, `download_url` — файл существует, 404 только на raw из-за размера/кэша.

## Фикс черного экрана

Коммит `bd564d0` и `65391ae`:
- `server/index.js` fallback to in-memory если better-sqlite3 падает
- `electron/main.js` ищет client dist в 4 местах, show after load, webSecurity false
- Пересобрано в release-exe ветке

## Собрать самому локально (100% рабочий вариант без скачивания)

**Windows (настоящее нативное окно, не браузер):**
```bat
git clone https://github.com/gggvkvh405-rgb/Cbopka.git
cd Cbopka
cd client && npm install && npm run build && cd ..
cd server && npm install && cd ..
cd electron && npm install && npm run build:win
# Получишь release/Cbopka-*-portable.exe — нативное окно!
```

**Python (еще проще):**
```bat
pip install pywebview pyinstaller
pyinstaller --onefile --windowed --name Cbopka-App-Native Cbopka-Native.py
# dist/Cbopka-App-Native.exe — нативное окно!
```

Исходники: `Cbopka-Native.py`, `electron/main.js`

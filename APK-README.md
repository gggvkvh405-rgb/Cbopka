# Cbopka APK

## Быстрый способ без сборки APK — PWA (работает как APK):

1. Открой на телефоне: https://твой-сайт.com или http://ТВОЙ_IP:3000
2. В Chrome: меню ⋮ → "Установить приложение" / "Добавить на главный экран"
3. Теперь Cbopka как нативное приложение, с иконкой, без браузера!
4. Звонки работают!

## Собрать настоящий APK:

### Вариант 1 — GitHub Actions (автоматически):
- Я уже добавил workflow `.github/workflows/build-apk.yml`
- При пуше в ветку `arena/01a0c9e9-cbopka` GitHub сам соберет APK
- Скачать: https://github.com/gggvkvh405-rgb/Cbopka/actions → выбери последний Build APK → артефакт Cbopka-APK

### Вариант 2 — Локально на ПК:
```bash
cd client
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init Cbopka com.cbopka.app --web-dir=dist
npx cap add android
npx cap sync
# Открой Android Studio:
npx cap open android
# В Android Studio: Build → Build APK → app-debug.apk
```

APK будет в `client/android/app/build/outputs/apk/debug/app-debug.apk`

### Вариант 3 — PWABuilder:
1. Зайди на https://www.pwabuilder.com
2. Вставь URL твоего Cbopka (например https://cbopka.onrender.com)
3. Нажми Build → Android → Скачай APK

---

## Как позвонить с телефона на ПК:

1. На ПК запусти Cbopka.exe → http://localhost:3000
2. На телефоне открой P2P режим (кнопка "P2P без сервера")
3. На ПК тоже P2P режим, скопируй ID с ПК
4. На телефоне вставь ID ПК → Подкл
5. Звони! Видео, аудио, экран 1080p работают между телефоном и ПК.

P2P использует STUN, работает через мобильный интернет и WiFi.


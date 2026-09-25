#!/usr/bin/env python3
"""
Cbopka Native App v2 - TRUE native desktop app, NOT browser
- Opens in its own window via pywebview (native WebView2 on Windows, WebKit on Mac, WebKitGTK on Linux)
- No browser tab, no address bar, real app window
- P2P mode works without server, direct phone-to-PC
- Server mode uses local SQLite DB

Variant 2: True native app, not site
"""
import os
import sys
import time
import threading
import subprocess
import webbrowser
from pathlib import Path

try:
    import webview
    HAS_WEBVIEW = True
except ImportError:
    HAS_WEBVIEW = False
    print("pywebview не установлен. Установи: pip install pywebview")
    print("Будет открыт браузер как fallback")

def get_base():
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).parent
    return Path(__file__).parent

def find_node():
    for candidate in ["node", "nodejs", "node.exe", "/usr/local/bin/node", "/usr/bin/node"]:
        try:
            subprocess.run([candidate, "--version"], capture_output=True, timeout=2)
            return candidate
        except:
            continue
    return None

def start_server():
    base = get_base()
    node = find_node()
    if not node:
        print("Node.js не найден, запускаю P2P режим без сервера")
        return None

    # Try bundled server
    candidates = [
        base / "server" / "sea-single-bundled.cjs",
        base / "electron" / "sea-bundled.cjs",
        Path("/tmp/sea-single-bundled.cjs"),
        base / "server" / "index.js",
    ]
    server_file = None
    for c in candidates:
        if c.exists():
            server_file = c
            break

    if not server_file:
        print(f"Сервер не найден в {base}")
        return None

    client_dist = base / "client" / "dist"
    if not client_dist.exists():
        client_dist = base / "client-dist"
    if not client_dist.exists():
        client_dist = base / "dist"

    env = os.environ.copy()
    env["PORT"] = "3000"
    env["CLIENT_DIST_PATH"] = str(client_dist)
    env["NODE_ENV"] = "production"

    print(f"🚀 Запускаю сервер: {node} {server_file}")
    try:
        proc = subprocess.Popen([node, str(server_file)], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        # Wait a bit for server to start
        time.sleep(2)
        if proc.poll() is None:
            print("✅ Сервер запущен на http://localhost:3000")
            return proc
        else:
            out, err = proc.communicate(timeout=1)
            print(f"❌ Сервер упал: {err.decode()[:500]}")
            return None
    except Exception as e:
        print(f"❌ Ошибка запуска сервера: {e}")
        return None

class Api:
    def __init__(self):
        self.server_proc = None

    def close_app(self):
        if self.server_proc:
            try:
                self.server_proc.terminate()
            except:
                pass
        # Close window
        for w in webview.windows:
            w.destroy()

    def minimize(self):
        for w in webview.windows:
            w.minimize()

def main():
    print("""
  ██████╗██████╗  ██████╗ ██████╗ ██╗  ██╗ █████╗ 
 ██╔════╝██╔══██╗██╔═══██╗██╔══██╗██║ ██╔╝██╔══██╗
 ██║     ██████╔╝██║   ██║██████╔╝█████╔╝ ███████║
 ██║     ██╔══██╗██║   ██║██╔═══╝ ██╔═██╗ ██╔══██║
 ╚██████╗██████╔╝╚██████╔╝██║     ██║  ██╗██║  ██║
  ╚═════╝╚═════╝  ╚═════╝ ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝

  Cbopka Native v2 — настоящее приложение, не сайт!
  Вариант 2: нативное окно, а не вкладка браузера
    """)

    api = Api()
    server_proc = start_server()
    api.server_proc = server_proc

    # URL to open - try localhost first, fallback to P2P online
    if server_proc:
        url = "http://localhost:3000"
    else:
        # P2P mode without server - works even without internet via local file if exists
        base = get_base()
        local_index = base / "client" / "dist" / "index.html"
        if local_index.exists():
            # Load local P2P file with ?p2p param
            url = f"file://{local_index}?p2p"
            print(f"📂 Открываю локальный P2P: {local_index}")
        else:
            url = "https://cbopka.vercel.app/?p2p"
            print(f"🌐 Сервер не запущен, открываю P2P онлайн: {url}")

    if HAS_WEBVIEW:
        print(f"🖥️ Открываю НАТИВНОЕ окно Cbopka v2: {url}")
        print("   Это НЕ браузер, это отдельное приложение с собственным окном!")
        
        window = webview.create_window(
            "Cbopka — мессенджер (Native App v2)",
            url,
            width=1280,
            height=800,
            min_size=(900, 600),
            background_color="#0f0f12",
            text_select=True,
            confirm_close=True,
            js_api=api
        )
        
        # Start webview - this is native window, not browser tab
        webview.start(debug=False, http_server=False)
        
        # Cleanup
        if server_proc:
            try:
                server_proc.terminate()
                server_proc.wait(timeout=2)
            except:
                try:
                    server_proc.kill()
                except:
                    pass
        print("👋 Cbopka закрыта")
    else:
        print(f"🌐 pywebview не установлен, открываю браузер: {url}")
        print("   Для настоящего нативного приложения установи: pip install pywebview")
        webbrowser.open(url)
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            if server_proc:
                server_proc.terminate()

if __name__ == "__main__":
    main()

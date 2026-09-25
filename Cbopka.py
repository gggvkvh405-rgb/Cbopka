#!/usr/bin/env python3
"""
Cbopka Desktop App - нативное окно, а не сайт в браузере
Запускает сервер и открывает нативное окно с Cbopka
"""
import os
import sys
import time
import threading
import subprocess
import webbrowser
from pathlib import Path

# Try to import webview, if not available fallback to browser
try:
    import webview
    HAS_WEBVIEW = True
except ImportError:
    HAS_WEBVIEW = False
    print("pywebview не установлен, будет открыт браузер. Установи: pip install pywebview")

def get_base_dir():
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).parent
    return Path(__file__).parent

def start_server():
    """Запускает Node сервер"""
    base = get_base_dir()
    # Try to find Node binary and server file
    # 1. Try bundled single file (SEA)
    single_exe = base / "Cbopka-SINGLE-linux"
    single_win = base / "Cbopka.exe"
    
    # 2. Try Node + server/index.js
    server_js = base / "server" / "index.js"
    client_dist = base / "client" / "dist"
    
    # If we are running as single exe with embedded client, server is already inside
    # For Python app, we need to start Node server separately
    
    # Check if node is available
    node_bin = None
    for candidate in ["node", "nodejs", "/usr/local/bin/node", "/usr/bin/node"]:
        try:
            subprocess.run([candidate, "--version"], capture_output=True, timeout=2)
            node_bin = candidate
            break
        except:
            continue
    
    if not node_bin:
        print("Node.js не найден! Скачай с https://nodejs.org")
        return None
    
    # Try to start server from bundled JS
    bundled_js = base / "server" / "sea-single-bundled.cjs"
    if not bundled_js.exists():
        bundled_js = Path("/tmp/sea-single-bundled.cjs")
    if not bundled_js.exists():
        # Fallback to server/index.js
        if server_js.exists():
            env = os.environ.copy()
            env["CLIENT_DIST_PATH"] = str(client_dist) if client_dist.exists() else str(base / "client-dist")
            env["PORT"] = "3000"
            print(f"Запускаю сервер: {node_bin} {server_js}")
            proc = subprocess.Popen([node_bin, str(server_js)], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            return proc
        else:
            print("Сервер не найден!")
            return None
    else:
        env = os.environ.copy()
        env["PORT"] = "3000"
        print(f"Запускаю bundled сервер: {node_bin} {bundled_js}")
        proc = subprocess.Popen([node_bin, str(bundled_js)], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return proc

def main():
    print("""
  ██████╗██████╗  ██████╗ ██████╗ ██╗  ██╗ █████╗ 
 ██╔════╝██╔══██╗██╔═══██╗██╔══██╗██║ ██╔╝██╔══██╗
 ██║     ██████╔╝██║   ██║██████╔╝█████╔╝ ███████║
 ██║     ██╔══██╗██║   ██║██╔═══╝ ██╔═██╗ ██╔══██║
 ╚██████╗██████╔╝╚██████╔╝██║     ██║  ██╗██║  ██║
  ╚═════╝╚═════╝  ╚═════╝ ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝

  Cbopka Desktop App - нативное приложение
    """)
    
    # Start server in background
    server_proc = start_server()
    if server_proc:
        time.sleep(2)
        print("✅ Сервер запущен на http://localhost:3000")
    else:
        print("⚠️ Сервер не запущен, пробую открыть P2P режим по ссылке")
    
    url = "http://localhost:3000"
    
    if HAS_WEBVIEW:
        print("🖥️ Открываю нативное окно Cbopka...")
        # Create native window
        window = webview.create_window(
            "Cbopka — мессенджер",
            url,
            width=1280,
            height=800,
            min_size=(900, 600),
            background_color="#0f0f12",
            text_select=True
        )
        webview.start()
    else:
        print(f"🌐 Открываю браузер: {url}")
        webbrowser.open(url)
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("Закрываю...")
            if server_proc:
                server_proc.terminate()

if __name__ == "__main__":
    main()

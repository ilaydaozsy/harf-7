import sys
import threading
import time
import webbrowser
import urllib.request
import urllib.error

import uvicorn

from main import app


HOST = "127.0.0.1"
PORT = 8000
URL = f"http://{HOST}:{PORT}"


def server_is_running():
    try:
        urllib.request.urlopen(
            f"{URL}/health",
            timeout=1
        )
        return True
    except (urllib.error.URLError, TimeoutError):
        return False


def open_browser():
    time.sleep(2)
    webbrowser.open(URL)


if __name__ == "__main__":

    if sys.stdout is None:
        sys.stdout = open("NUL", "w", encoding="utf-8")

    if sys.stderr is None:
        sys.stderr = open("NUL", "w", encoding="utf-8")

    # HARF 7 zaten çalışıyorsa yeni bir sunucu başlatma.
    # Sadece tarayıcıyı tekrar aç.
    if server_is_running():
        webbrowser.open(URL)
        sys.exit(0)

    threading.Thread(
        target=open_browser,
        daemon=True
    ).start()

    uvicorn.run(
        app,
        host=HOST,
        port=PORT,
        log_config=None,
    )
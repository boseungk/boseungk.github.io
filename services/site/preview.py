"""Loopback-only preview with the staged production security headers and local API allowance."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).with_name('dist')
HEADERS = {}
for line in (ROOT / '_headers').read_text().splitlines():
    if line.startswith('  ') and ':' in line:
        key, value = line.strip().split(':', 1)
        HEADERS[key] = value.strip()
# Only this loopback server adds this source. Production prepare.py never permits local APIs.
HEADERS['Content-Security-Policy'] = HEADERS['Content-Security-Policy'].replace(
    "connect-src 'self'", "connect-src 'self' http://127.0.0.1:8789")


class Preview(SimpleHTTPRequestHandler):
    def end_headers(self):
        for key, value in HEADERS.items():
            self.send_header(key, value)
        super().end_headers()


if __name__ == '__main__':
    print('Security preview: http://127.0.0.1:8765', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8765), partial(Preview, directory=str(ROOT))).serve_forever()

# 本地预览服务：提供网页文件，并允许“布局编辑”把 layout.json 保存回项目文件夹（只监听本机）。
import http.server, json, os, shutil, time
ROOT = os.path.dirname(os.path.abspath(__file__))
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache'); super().end_headers()
    def log_message(self, *a): pass
    def do_POST(self):
        if self.path != '/save-layout': self.send_error(404); return
        n = int(self.headers.get('Content-Length', 0))
        if n <= 0 or n > 5_000_000: self.send_error(400); return
        try:
            data = json.loads(self.rfile.read(n).decode('utf-8'))
            assert isinstance(data, dict) and data.get('version') == 1
        except Exception: self.send_error(400, 'bad layout'); return
        p = os.path.join(ROOT, 'layout.json')
        if os.path.exists(p):
            os.makedirs(os.path.join(ROOT, '_布局历史'), exist_ok=True)
            shutil.copy2(p, os.path.join(ROOT, '_布局历史', time.strftime('layout-%Y%m%d-%H%M%S.json')))
        tmp = p + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f: json.dump(data, f, ensure_ascii=False, indent=1)
        os.replace(tmp, p)
        body = b'{"ok":true}'
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
print('云上花园预览：http://localhost:8765 （关闭此窗口即停止）')
http.server.ThreadingHTTPServer(('127.0.0.1', 8765), H).serve_forever()

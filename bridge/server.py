import json
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler

KIRO = 'kiro-cli'
TIMEOUT = 60

PROMPT_PREFIX = '''You are a quiz-answering AI.
RULES: Respond ONLY with the number(s) of the correct answer(s).
Multiple answers: separate with commas. Example: "2" or "1,3".
NO explanation. NO extra text. ONLY numbers.

'''

import re

def parse(raw):
    lines = [l for l in raw.strip().split('\n') if l.strip()]
    last = lines[-1] if lines else ''
    nums = re.findall(r'\d+', last)
    if nums:
        return ','.join(nums)
    letters = re.findall(r'[A-Da-d]', last)
    if letters:
        return ','.join(str(ord(l.upper()) - 64) for l in letters)
    return last.strip()


def ask(text):
    prompt = PROMPT_PREFIX + text + '\n\nAnswer:'
    r = subprocess.run(
        [KIRO, 'chat', '--no-interactive', prompt],
        capture_output=True, text=True, timeout=TIMEOUT
    )
    if r.returncode != 0:
        raise Exception(r.stderr or f'exit code {r.returncode}')
    return parse(r.stdout)


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == '/health':
            self._json(200, {'ok': True})

    def do_POST(self):
        if self.path != '/ask':
            return self._json(404, {'error': 'not found'})
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        text = body.get('text', '')
        if not text:
            return self._json(400, {'error': 'missing text'})
        try:
            answer = ask(text)
            self._json(200, {'answer': answer})
        except Exception as e:
            self._json(500, {'error': str(e)})

    def _json(self, code, data):
        self.send_response(code)
        self._cors()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def log_message(self, fmt, *args):
        print(f'[{self.log_date_time_string()}] {fmt % args}')


if __name__ == '__main__':
    s = HTTPServer(('127.0.0.1', 3847), Handler)
    print('Bridge ready \u2192 http://127.0.0.1:3847')
    s.serve_forever()

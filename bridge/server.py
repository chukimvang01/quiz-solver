import json
import subprocess
import re
from http.server import HTTPServer, BaseHTTPRequestHandler

KIRO = 'kiro-cli'
TIMEOUT = 60

PROMPT = '''You are an expert quiz-solving AI. Below is raw text copied from a quiz screen. It contains a QUESTION followed by ANSWER OPTIONS.

YOUR TASK:
1. Identify the question and all answer options from the text.
2. Answer options may be labeled (A/B/C/D or 1/2/3/4) or unlabeled (just separate lines).
3. If there are exactly 4 options → it is likely a SINGLE-answer question → respond with ONE number.
4. If there are more than 4 options or the question says "select all" / "chọn nhiều" → respond with MULTIPLE numbers separated by commas.
5. Number the options in order starting from 1 (first option = 1, second = 2, etc.).

RESPOND WITH ONLY THE ANSWER NUMBER(S). Nothing else.
Examples: "2" or "1,3" or "4"

---
{content}
---

Answer:'''


def extract_answer(raw):
    """Lấy chỉ số/chữ đáp án, bỏ text giải thích."""
    lines = [l.strip() for l in raw.strip().split('\n') if l.strip()]
    # Tìm dòng chỉ chứa số + phẩy
    for line in reversed(lines):
        c = line.strip(' .')
        if re.fullmatch(r'[\d,\s]+', c):
            return c.replace(' ', '')
    # Tìm dòng chỉ chứa A-D
    for line in reversed(lines):
        c = line.strip(' .')
        if re.fullmatch(r'[A-Da-d][,\s]*(?:[A-Da-d][,\s]*)*', c):
            return c.replace(' ', '')
    # Fallback: lấy dòng cuối
    return lines[-1].strip() if lines else '?'


def ask(text):
    prompt = PROMPT.format(content=text)

    print(f'\n--- RAW INPUT ---')
    print(text)
    print(f'--- END INPUT ---\n')

    r = subprocess.run(
        [KIRO, 'chat', '--no-interactive', prompt],
        capture_output=True, text=True, timeout=TIMEOUT
    )

    print(f'--- KIRO RAW OUTPUT ---')
    print(r.stdout)
    print(f'--- END OUTPUT ---\n')

    if r.returncode != 0:
        raise Exception(r.stderr or f'exit code {r.returncode}')

    answer = extract_answer(r.stdout)
    print(f'>>> ANSWER: {answer}')
    return answer


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

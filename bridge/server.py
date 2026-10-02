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

RE_NUMBERED = re.compile(r'^\s*(?:[1-9]\d?|[A-Da-d])\s*[.):\]\-]\s*\S')
RE_BULLET = re.compile(r'^\s*[•●○◦▪▸►–—\-\*]\s*')


def prepare(text):
    lines = [l for l in text.split('\n') if l.strip()]
    if not lines:
        return text

    numbered_count = sum(1 for l in lines if RE_NUMBERED.match(l))
    if numbered_count >= 2:
        return text

    q_end = 0
    for i, l in enumerate(lines):
        s = l.strip()
        if s.endswith('?') or s.endswith(':'):
            q_end = i + 1
            break
    if q_end == 0:
        q_end = 1

    question = '\n'.join(lines[:q_end])
    options = lines[q_end:]

    if not options:
        return text

    numbered = []
    for idx, opt in enumerate(options, 1):
        clean = RE_BULLET.sub('', opt).strip()
        clean = re.sub(r'^\s*(?:[1-9]\d?|[A-Da-d])\s*[.):\]\-]?\s*', '', clean).strip() or clean
        numbered.append(f'{idx}. {clean}')

    return question + '\n' + '\n'.join(numbered)


def extract_answer(raw):
    """Lọc chỉ lấy số đáp án từ output Kiro CLI, bỏ mọi text giải thích."""
    lines = [l.strip() for l in raw.strip().split('\n') if l.strip()]

    # Tìm dòng CHỈ chứa số và dấu phẩy (ví dụ: "2" hoặc "1, 3")
    for line in reversed(lines):
        clean = line.strip(' .')
        if re.fullmatch(r'[\d,\s]+', clean):
            return clean.replace(' ', '')

    # Tìm dòng CHỈ chứa chữ cái đáp án (ví dụ: "B" hoặc "A, C")
    for line in reversed(lines):
        clean = line.strip(' .')
        if re.fullmatch(r'[A-Da-d][,\s]*(?:[A-Da-d][,\s]*)*', clean):
            return clean.replace(' ', '')

    # Fallback: lấy dòng cuối, chỉ giữ số và phẩy
    for line in reversed(lines):
        nums = re.findall(r'\b([1-9])\b', line)
        if nums:
            return ','.join(nums)

    return '?'


def ask(text):
    content = prepare(text)
    prompt = PROMPT.format(content=content)

    print(f'\n--- PREPARED CONTENT ---')
    print(content)
    print(f'--- END CONTENT ---\n')

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

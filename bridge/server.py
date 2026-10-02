import json
import subprocess
import re
from http.server import HTTPServer, BaseHTTPRequestHandler

KIRO = 'kiro-cli'
TIMEOUT = 60

PROMPT = '''You are a quiz-answering AI.
The question and NUMBERED answer options are below.
RULES: Respond ONLY with the number(s) of the correct answer(s).
Multiple answers: separate with commas. Example: "2" or "1,3".
NO explanation. NO extra text. ONLY numbers.

{content}

Answer:'''

# Regex: dòng đã có đánh số/chữ cái đầu (1. / A. / a) / 1) / A) ...)
RE_NUMBERED = re.compile(r'^\s*(?:[1-9]\d?|[A-Da-d])\s*[.):\]\-]\s*\S')
# Regex: ký tự bullet/separator đầu dòng
RE_BULLET = re.compile(r'^\s*[•●○◦▪▸►–—\-\*]\s*')


def prepare(text):
    """
    Tự đánh số đáp án nếu chưa có.
    Tách câu hỏi (phần đầu) và đáp án (các dòng còn lại).
    """
    lines = [l for l in text.split('\n') if l.strip()]
    if not lines:
        return text

    # Kiểm tra đã có đánh số chưa
    numbered_count = sum(1 for l in lines if RE_NUMBERED.match(l))
    if numbered_count >= 2:
        # Đã có đánh số → giữ nguyên
        return text

    # Tìm dòng câu hỏi (thường là dòng dài nhất hoặc dòng kết thúc bằng ?)
    q_end = 0
    for i, l in enumerate(lines):
        s = l.strip()
        if s.endswith('?') or s.endswith(':'):
            q_end = i + 1
            break
    # Nếu không tìm thấy dấu ? hay : → dòng đầu là câu hỏi
    if q_end == 0:
        q_end = 1

    question = '\n'.join(lines[:q_end])
    options = lines[q_end:]

    if not options:
        return text

    # Đánh số các đáp án
    numbered = []
    for idx, opt in enumerate(options, 1):
        clean = RE_BULLET.sub('', opt).strip()
        # Bỏ số/chữ cái đầu nếu có nhưng không đủ pattern
        clean = re.sub(r'^\s*(?:[1-9]\d?|[A-Da-d])\s*[.):\]\-]?\s*', '', clean).strip() or clean
        numbered.append(f'{idx}. {clean}')

    return question + '\n' + '\n'.join(numbered)


def parse(raw):
    """Trích xuất số đáp án từ output Kiro CLI."""
    text = raw.strip()
    lines = [l.strip() for l in text.split('\n') if l.strip()]

    # 1. Tìm dòng CHỈ chứa số và dấu phẩy (ví dụ: "2" hoặc "1,3")
    for line in reversed(lines):
        clean = line.strip(' .')
        if re.fullmatch(r'[\d,\s]+', clean):
            nums = re.findall(r'\d+', clean)
            valid = [n for n in nums if 1 <= int(n) <= 20]
            if valid:
                return ','.join(valid)

    # 2. Tìm dòng CHỈ chứa chữ cái đáp án (ví dụ: "B" hoặc "A, C")
    for line in reversed(lines):
        clean = line.strip(' .')
        if re.fullmatch(r'[A-Da-d,\s]+', clean):
            letters = re.findall(r'[A-Da-d]', clean)
            if letters:
                return ','.join(str(ord(l.upper()) - 64) for l in letters)

    # 3. Fallback: tìm số trong khoảng 1-20 ở dòng cuối
    for line in reversed(lines):
        nums = re.findall(r'\b(\d{1,2})\b', line)
        valid = [n for n in nums if 1 <= int(n) <= 20]
        if valid:
            return ','.join(valid)

    return lines[-1] if lines else '?'


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
    if r.stderr:
        print(f'--- KIRO STDERR ---')
        print(r.stderr)
    print(f'--- END OUTPUT ---\n')

    if r.returncode != 0:
        raise Exception(r.stderr or f'exit code {r.returncode}')

    answer = parse(r.stdout)
    print(f'>>> PARSED ANSWER: {answer}')
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

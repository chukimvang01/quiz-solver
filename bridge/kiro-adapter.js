import { execFile } from 'child_process';

const KIRO = process.env.KIRO_PATH || 'kiro-cli';
const TIMEOUT = 60_000;

const PROMPT_PREFIX = `You are a quiz-answering AI.
RULES: Respond ONLY with the number(s) of the correct answer(s).
Multiple answers: separate with commas. Example: "2" or "1,3".
NO explanation. NO extra text. ONLY numbers.

`;

/**
 * Gọi Kiro CLI trả lời câu hỏi trắc nghiệm.
 * @param {string} text - Câu hỏi + đáp án đã select
 * @returns {Promise<string>} - Đáp án (ví dụ "2" hoặc "1,3")
 */
export function ask(text) {
  const prompt = PROMPT_PREFIX + text + '\n\nAnswer:';

  return new Promise((resolve, reject) => {
    execFile(KIRO, ['chat', '--no-interactive', prompt], {
      timeout: TIMEOUT,
      maxBuffer: 512 * 1024,
    }, (err, stdout) => {
      if (err) return reject(err);
      resolve(parse(stdout));
    });
  });
}

/** Trích xuất số đáp án từ output Kiro CLI */
function parse(raw) {
  const lines = raw.trim().split('\n');
  const last = lines[lines.length - 1] || '';

  // Tìm số
  const nums = last.match(/\d+/g);
  if (nums) return nums.join(',');

  // Tìm chữ cái A-D → chuyển thành số
  const letters = last.match(/[A-Da-d]/g);
  if (letters) return letters.map(l => l.toUpperCase().charCodeAt(0) - 64).join(',');

  return last.trim();
}

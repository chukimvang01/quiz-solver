// Service Worker

const BRIDGE = 'http://127.0.0.1:3847';

console.log('[QS] Service worker loaded');

// Lưu selection mới nhất từ content scripts
let savedText = '';

// Content script báo có selection mới
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.action === 'selection') {
    if (msg.text && msg.text.length > savedText.length) {
      savedText = msg.text;
    }
    return;
  }
});

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'solve') return;
  console.log('[QS] Ctrl+Q, saved selection:', savedText.length);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const text = savedText;
  savedText = ''; // Reset

  if (!text || text.length < 3) {
    console.warn('[QS] No selection');
    return;
  }

  console.log('[QS] Text preview:', text.substring(0, 80));

  // Hiện loading
  chrome.tabs.sendMessage(tab.id, { action: 'show-loading' }).catch(() => {});

  // Gọi bridge
  try {
    const r = await fetch(`${BRIDGE}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(65000),
    });
    const data = await r.json();
    console.log('[QS] Answer:', data);

    chrome.tabs.sendMessage(tab.id, {
      action: 'show-answer',
      answer: r.ok ? data.answer : null,
      error: r.ok ? null : data.error,
    }).catch(() => {});
  } catch (e) {
    console.error('[QS] Error:', e.message);
    chrome.tabs.sendMessage(tab.id, {
      action: 'show-answer', error: '!!!',
    }).catch(() => {});
  }
});

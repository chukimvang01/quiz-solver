// Service Worker — lấy selection trực tiếp từ tất cả frames

const BRIDGE = 'http://127.0.0.1:3847';

console.log('[QS] Service worker loaded');

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'solve') return;
  console.log('[QS] Ctrl+Q pressed');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  // Lấy selection từ TẤT CẢ frames trong tab
  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => window.getSelection().toString().trim(),
    });
  } catch (e) {
    console.error('[QS] Cannot access tab:', e.message);
    return;
  }

  // Tìm frame có selection dài nhất
  const text = results
    .map(r => r.result || '')
    .filter(s => s.length > 0)
    .sort((a, b) => b.length - a.length)[0];

  console.log('[QS] Selection found:', text?.length || 0, 'chars');

  if (!text || text.length < 3) {
    console.warn('[QS] No selection found in any frame');
    chrome.tabs.sendMessage(tab.id, { action: 'show-error' }).catch(() => {});
    return;
  }

  // Hiện loading
  chrome.tabs.sendMessage(tab.id, { action: 'show-loading' }).catch(() => {});

  // Gọi bridge
  try {
    console.log('[QS] Calling bridge...');
    const r = await fetch(`${BRIDGE}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(65000),
    });
    const data = await r.json();
    console.log('[QS] Bridge response:', data);

    chrome.tabs.sendMessage(tab.id, {
      action: 'show-answer',
      answer: r.ok ? data.answer : null,
      error: r.ok ? null : (data.error || 'Error'),
    }).catch(() => {});
  } catch (e) {
    console.error('[QS] Bridge error:', e.message);
    chrome.tabs.sendMessage(tab.id, {
      action: 'show-answer',
      error: e.name === 'TimeoutError' ? 'Timeout' : 'No connection',
    }).catch(() => {});
  }
});

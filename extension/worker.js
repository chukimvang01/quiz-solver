// Service Worker

const BRIDGE = 'http://127.0.0.1:3847';

console.log('[QS] Service worker loaded');

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'solve') return;
  console.log('[QS] Ctrl+Q pressed');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  let text = '';

  try {
    // Đọc selection đã lưu sẵn trong window.__qsSel
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => window.__qsSel || window.getSelection().toString().trim() || '',
    });
    console.log('[QS] Selection from frames:', results.map(r => r.result?.length || 0));
    text = results
      .map(r => r.result || '')
      .filter(s => s.length > 0)
      .sort((a, b) => b.length - a.length)[0] || '';
  } catch (e) {
    console.error('[QS] executeScript failed:', e.message);
  }

  console.log('[QS] Selection:', text.length, 'chars');

  if (!text || text.length < 3) {
    console.warn('[QS] No selection');
    return;
  }

  // Clear selection đã lưu
  chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: () => { window.__qsSel = ''; },
  }).catch(() => {});

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
      error: '!!!',
    }).catch(() => {});
  }
});

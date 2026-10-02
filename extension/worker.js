// Service Worker

const BRIDGE = 'http://127.0.0.1:3847';

console.log('[QS] Service worker loaded');

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'solve') return;
  console.log('[QS] Ctrl+Q pressed');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  console.log('[QS] Tab:', tab?.id, tab?.url?.substring(0, 50));
  if (!tab?.id) {
    console.error('[QS] No active tab');
    return;
  }

  let text = '';

  // Phương án 1: executeScript lấy selection trực tiếp
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => window.getSelection().toString().trim(),
    });
    console.log('[QS] executeScript results:', results.map(r => r.result?.length || 0));
    text = results
      .map(r => r.result || '')
      .filter(s => s.length > 0)
      .sort((a, b) => b.length - a.length)[0] || '';
  } catch (e) {
    console.warn('[QS] executeScript failed:', e.message);
    // Phương án 2: hỏi content script
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { action: 'get-selection' });
      text = res?.text || '';
      console.log('[QS] Content script selection:', text.length);
    } catch (e2) {
      console.error('[QS] Both methods failed:', e2.message);
    }
  }

  console.log('[QS] Final selection:', text.length, 'chars');
  if (text.length > 0) {
    console.log('[QS] Preview:', text.substring(0, 100));
  }

  if (!text || text.length < 3) {
    console.warn('[QS] No selection');
    return; // Không hiện gì cả nếu chưa select
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
      error: '!!!',
    }).catch(() => {});
  }
});

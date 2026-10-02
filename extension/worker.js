// Service Worker — chuyển tiếp giữa phím tắt và content script

const BRIDGE = 'http://127.0.0.1:3847';

console.log('[QS] Service worker loaded');

chrome.commands.onCommand.addListener(async (cmd) => {
  console.log('[QS] Command received:', cmd);
  if (cmd !== 'solve') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  console.log('[QS] Active tab:', tab?.id, tab?.url);
  if (tab?.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'solve' });
      console.log('[QS] Message sent to content script');
    } catch (e) {
      console.error('[QS] Failed to send to content script:', e.message);
    }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.action !== 'ask') return;
  console.log('[QS] Received ask from content, text length:', msg.text?.length);
  (async () => {
    try {
      console.log('[QS] Fetching bridge:', `${BRIDGE}/ask`);
      const r = await fetch(`${BRIDGE}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg.text }),
        signal: AbortSignal.timeout(65000),
      });
      const data = await r.json();
      console.log('[QS] Bridge response:', r.status, data);
      reply(r.ok ? { answer: data.answer } : { error: data.error });
    } catch (e) {
      console.error('[QS] Bridge error:', e.name, e.message);
      reply({ error: e.name === 'TimeoutError' ? 'Timeout' : 'No connection' });
    }
  })();
  return true;
});

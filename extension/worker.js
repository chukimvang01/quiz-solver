// Service Worker

const BRIDGE = 'http://127.0.0.1:3847';

console.log('[QS] Service worker loaded');

chrome.commands.onCommand.addListener(async (cmd) => {
  console.log('[QS] Command received:', cmd);
  if (cmd !== 'solve') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    // Gửi trigger tới TẤT CẢ frames trong tab
    chrome.tabs.sendMessage(tab.id, { action: 'solve' }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.action === 'ask') {
    console.log('[QS] Ask from frame, text length:', msg.text?.length);
    (async () => {
      try {
        const r = await fetch(`${BRIDGE}/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: msg.text }),
          signal: AbortSignal.timeout(65000),
        });
        const data = await r.json();
        console.log('[QS] Bridge response:', data);

        // Gửi đáp án tới top frame để hiển thị
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'show-answer',
            answer: r.ok ? data.answer : null,
            error: r.ok ? null : data.error,
          }).catch(() => {});
        }
        reply({ ok: true });
      } catch (e) {
        console.error('[QS] Bridge error:', e.message);
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'show-answer',
            error: e.name === 'TimeoutError' ? 'Timeout' : 'No connection',
          }).catch(() => {});
        }
        reply({ ok: false });
      }
    })();
    return true;
  }
});

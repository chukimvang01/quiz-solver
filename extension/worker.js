// Service Worker — chuyển tiếp giữa phím tắt và content script

const BRIDGE = 'http://127.0.0.1:3847';

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'solve') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    await chrome.tabs.sendMessage(tab.id, { action: 'solve' });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.action !== 'ask') return;
  (async () => {
    try {
      const r = await fetch(`${BRIDGE}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg.text }),
        signal: AbortSignal.timeout(65000),
      });
      const data = await r.json();
      reply(r.ok ? { answer: data.answer } : { error: data.error });
    } catch (e) {
      reply({ error: e.name === 'TimeoutError' ? 'Timeout' : 'No connection' });
    }
  })();
  return true;
});

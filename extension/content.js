(() => {
  'use strict';
  if (window.__qs) return;
  window.__qs = true;

  const isTop = (window === window.top);

  let el = null;
  let timer = null;
  let lastSelection = '';

  // Lưu selection liên tục (mọi frame)
  document.addEventListener('mouseup', saveSelection);
  document.addEventListener('selectionchange', saveSelection);

  function saveSelection() {
    const s = window.getSelection().toString().trim();
    if (s.length > 0) lastSelection = s;
  }

  // === OVERLAY (chỉ top frame) ===
  function getEl() {
    if (el) return el;
    if (!isTop) return null;
    el = document.createElement('div');
    el.id = '__qs';
    el.className = 'hd';
    document.documentElement.appendChild(el);
    el.addEventListener('click', hide);
    return el;
  }

  function show(text, cls) {
    if (!isTop) return;
    const o = getEl();
    if (!o) return;
    o.textContent = text;
    o.className = cls || '';
    clearTimeout(timer);
    if (cls !== 'ld') timer = setTimeout(hide, cls === 'er' ? 3000 : 5000);
    console.log('[QS] Display:', text);
  }

  function hide() {
    if (el) el.className = 'hd';
    clearTimeout(timer);
  }

  // === MESSAGE HANDLER ===
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Worker hỏi lấy selection (fallback)
    if (msg.action === 'get-selection') {
      const text = window.getSelection().toString().trim() || lastSelection;
      sendResponse({ text });
      return;
    }
    // Hiển thị
    if (msg.action === 'show-loading') show('···', 'ld');
    if (msg.action === 'show-answer') {
      if (msg.error) {
        show('!!!', 'er');
      } else if (msg.answer) {
        show(msg.answer);
      }
    }
  });
})();

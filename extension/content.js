(() => {
  'use strict';
  if (window.__qs) return;
  window.__qs = true;

  // Chỉ top frame mới hiển thị overlay
  if (window !== window.top) return;

  let el = null;
  let timer = null;

  function getEl() {
    if (el) return el;
    el = document.createElement('div');
    el.id = '__qs';
    el.className = 'hd';
    document.documentElement.appendChild(el);
    el.addEventListener('click', hide);
    return el;
  }

  function show(text, cls) {
    const o = getEl();
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

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'show-loading') show('···', 'ld');
    if (msg.action === 'show-error') show('!!!', 'er');
    if (msg.action === 'show-answer') {
      if (msg.error) {
        show('!!!', 'er');
      } else if (msg.answer) {
        show(msg.answer);
      }
    }
  });
})();

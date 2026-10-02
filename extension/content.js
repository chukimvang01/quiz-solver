(() => {
  'use strict';
  if (window.__qs) return;
  window.__qs = true;

  const isTop = (window === window.top);
  console.log('[QS] Content loaded, isTop:', isTop, location.href.substring(0, 80));

  let el = null;
  let timer = null;
  let lastSelection = '';

  document.addEventListener('mouseup', saveSelection);
  document.addEventListener('selectionchange', saveSelection);

  function saveSelection() {
    const s = window.getSelection().toString().trim();
    if (s.length > 0) {
      lastSelection = s;
    }
  }

  function getEl() {
    if (el) return el;
    if (!isTop) return null;
    el = document.createElement('div');
    el.id = '__qs';
    el.className = 'hd';
    document.documentElement.appendChild(el);
    el.addEventListener('click', hide);
    console.log('[QS] Overlay created');
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
    console.log('[QS] Show:', text);
  }

  function hide() {
    if (el) el.className = 'hd';
    clearTimeout(timer);
  }

  async function solve() {
    let text = window.getSelection().toString().trim();
    console.log('[QS] Solve, current selection:', text.length);
    if (text.length < 5) {
      text = lastSelection;
      console.log('[QS] Using saved selection:', text.length);
    }
    if (text.length < 5) {
      console.warn('[QS] Too short, skip');
      return;
    }

    if (isTop) {
      show('···', 'ld');
    } else {
      chrome.runtime.sendMessage({ action: 'show-loading' });
    }

    chrome.runtime.sendMessage({ action: 'ask', text });
    lastSelection = '';
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'solve') {
      solve();
    }
    if (isTop && msg.action === 'show-answer') {
      if (msg.error) {
        show('!!!', 'er');
      } else if (msg.answer) {
        show(msg.answer);
      }
    }
    if (isTop && msg.action === 'show-loading') {
      show('···', 'ld');
    }
  });
})();

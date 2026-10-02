(() => {
  'use strict';
  if (window.__qs) return;
  window.__qs = true;

  console.log('[QS] Content script loaded on:', location.href);

  let el = null;
  let timer = null;

  function getEl() {
    if (el) return el;
    el = document.createElement('div');
    el.id = '__qs';
    document.documentElement.appendChild(el);
    el.addEventListener('click', hide);
    console.log('[QS] Overlay element created');
    return el;
  }

  function show(text, cls) {
    const o = getEl();
    o.textContent = text;
    o.className = cls || '';
    clearTimeout(timer);
    if (cls !== 'ld') timer = setTimeout(hide, cls === 'er' ? 3000 : 5000);
    console.log('[QS] Show:', text, 'class:', cls || 'answer');
  }

  function hide() {
    if (el) el.className = 'hd';
    clearTimeout(timer);
  }

  async function solve() {
    const text = window.getSelection().toString().trim();
    console.log('[QS] Solve triggered, selection length:', text.length);
    if (text.length > 0) {
      console.log('[QS] Selected text preview:', text.substring(0, 100) + '...');
    }
    if (text.length < 15) {
      console.warn('[QS] Selection too short (< 15 chars), skipping');
      return;
    }

    show('···', 'ld');

    try {
      console.log('[QS] Sending to service worker...');
      const res = await new Promise((ok, no) => {
        chrome.runtime.sendMessage({ action: 'ask', text }, (r) => {
          if (chrome.runtime.lastError) {
            console.error('[QS] Runtime error:', chrome.runtime.lastError.message);
            no(new Error(chrome.runtime.lastError.message));
          } else if (r?.error) {
            console.error('[QS] Response error:', r.error);
            no(new Error(r.error));
          } else {
            console.log('[QS] Got answer:', r?.answer);
            ok(r);
          }
        });
      });
      show(res.answer);
    } catch (e) {
      console.error('[QS] Solve failed:', e.message);
      show('!!!', 'er');
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    console.log('[QS] Message from worker:', msg);
    if (msg.action === 'solve') solve();
  });
})();

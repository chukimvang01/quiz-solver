(() => {
  'use strict';
  if (window.__qs) return;
  window.__qs = true;

  let el = null;
  let timer = null;

  function getEl() {
    if (el) return el;
    el = document.createElement('div');
    el.id = '__qs';
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
  }

  function hide() {
    if (el) el.className = 'hd';
    clearTimeout(timer);
  }

  async function solve() {
    const text = window.getSelection().toString().trim();
    if (text.length < 15) return;

    show('···', 'ld');

    try {
      const res = await new Promise((ok, no) => {
        chrome.runtime.sendMessage({ action: 'ask', text }, (r) => {
          if (chrome.runtime.lastError) no(new Error(chrome.runtime.lastError.message));
          else if (r?.error) no(new Error(r.error));
          else ok(r);
        });
      });
      show(res.answer);
    } catch {
      show('!!!', 'er');
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'solve') solve();
  });
})();

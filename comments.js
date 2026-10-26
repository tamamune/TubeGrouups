// 再生画面：動画の右側／左側にコメントを下から上へ自動スクロールで表示
//   設定 cmt: { side: 'right'|'left'|'off', speed: 1..3, width: 'narrow'|'normal'|'wide', sort: 'top'|'new', end: 'hide'|'loop'|'stay' }
//   設定はすべての動画で共通（chrome.storage に保存。Drive同期の「その他の設定」にも含まれる）
const TGComments = (() => {
  const SPEED = { 1: 18, 2: 36, 3: 70 };          // 1秒あたりのスクロール量(px)
  const WIDTH = { narrow: 22, normal: 30, wide: 40 }; // 動画の幅に対する割合(%)
  const esc = TG.esc;
  let cfg = { side: 'right', speed: 2, width: 'normal', sort: 'top', end: 'hide' };
  let vid = null, token = null, loading = false, ctl = null, raf = 0, last = 0, hover = false, userUntil = 0, ended = false, acc = 0;
  let panel = null, list = null, btn = null, menu = null;

  chrome.storage.local.get('cmt').then(({ cmt }) => { cfg = { ...cfg, ...(cmt || {}) }; sync(); });
  chrome.storage.onChanged.addListener(ch => {
    if (!ch.cmt) return;
    const old = cfg;
    cfg = { ...cfg, ...(ch.cmt.newValue || {}) };
    if (old.sort !== cfg.sort) vid = null; // 並び順が変わったら取り直す
    if (old.end !== cfg.end) panel?.classList.remove('tg-c-done');
    sync();
  });
  const save = patch => chrome.storage.local.set({ cmt: { ...cfg, ...patch } });

  const player = () => document.querySelector('#movie_player');
  const curVid = () => (location.pathname === '/watch' ? new URLSearchParams(location.search).get('v') : null);
  const video = () => player()?.querySelector('video');

  // ---------- 表示の準備 ----------
  function sync() {
    const p = player();
    const v = curVid();
    if (!p || !v) { teardown(); return; }
    ensureButton(p);
    btn?.classList.toggle('tg-c-off', cfg.side === 'off');
    if (cfg.side === 'off') { removePanel(); return; }
    ensurePanel(p);
    panel.classList.toggle('tg-c-left', cfg.side === 'left');
    panel.style.setProperty('--tg-cw', WIDTH[cfg.width] + '%');
    if (v !== vid) load(v);
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function teardown() {
    removePanel();
    btn?.remove(); btn = null;
    menu?.remove(); menu = null;
    vid = null;
  }

  function removePanel() {
    ctl?.abort();
    cancelAnimationFrame(raf); raf = 0;
    panel?.remove(); panel = null; list = null;
    vid = null;
  }

  // 💬ボタンは動画下の操作バー（字幕・設定ボタンの並び）に入れる。見つからなければ右上に置く
  function ensureButton(p) {
    const bar = p.querySelector('.ytp-right-controls');
    if (btn && p.contains(btn) && (!bar || bar.contains(btn))) return;
    btn?.remove();
    btn = document.createElement('button');
    btn.className = bar ? 'ytp-button tg-c-btn tg-c-inbar' : 'tg-c-btn tg-c-float';
    btn.title = 'コメントの表示設定';
    btn.setAttribute('aria-label', 'コメントの表示設定');
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12zM7 9h10v2H7zm0-3h10v2H7zm0 6h7v2H7z"/></svg>';
    stopEvents(btn);
    btn.addEventListener('click', e => { e.stopPropagation(); toggleMenu(); });
    if (bar) bar.insertBefore(btn, bar.firstChild);
    else p.appendChild(btn);
    btn.classList.toggle('tg-c-off', cfg.side === 'off');
  }

  function ensurePanel(p) {
    if (panel && p.contains(panel)) return;
    panel = document.createElement('div');
    panel.className = 'tg-c-panel';
    panel.innerHTML = '<div class="tg-c-list"><div class="tg-c-pad"></div></div>';
    list = panel.firstElementChild;
    stopEvents(panel);
    panel.addEventListener('mouseenter', () => { hover = true; });
    panel.addEventListener('mouseleave', () => { hover = false; });
    list.addEventListener('wheel', () => { userUntil = performance.now() + 2500; }, { passive: true });
    list.addEventListener('scroll', () => maybeMore(), { passive: true });
    // 一番上の余白を表示エリアと同じ高さにして、コメントが下から出てくるようにする
    new ResizeObserver(() => {
      const pad = list?.querySelector('.tg-c-pad');
      if (pad) pad.style.height = list.clientHeight + 'px';
    }).observe(panel);
    p.appendChild(panel);
  }

  // 動画の再生／一時停止にクリックが伝わらないようにする
  function stopEvents(el) {
    ['click', 'dblclick', 'mousedown', 'mouseup', 'keydown'].forEach(t => el.addEventListener(t, e => e.stopPropagation()));
  }

  // ---------- 設定メニュー ----------
  function toggleMenu() {
    if (menu) { menu.remove(); menu = null; return; }
    menu = document.createElement('div');
    menu.className = 'tg-c-menu';
    stopEvents(menu);
    const row = (label, key, opts) => `<div class="tg-c-row"><span>${label}</span><div>${opts.map(([v, t]) =>
      `<button data-k="${key}" data-v="${v}" class="${String(cfg[key]) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div></div>`;
    menu.innerHTML = row('表示', 'side', [['right', '右側'], ['left', '左側'], ['off', 'オフ']]) +
      row('速さ', 'speed', [[1, '遅い'], [2, '普通'], [3, '速い']]) +
      row('幅', 'width', [['narrow', '狭い'], ['normal', '普通'], ['wide', '広い']]) +
      row('並び', 'sort', [['top', '評価順'], ['new', '新しい順']]) +
      row('最後まで流れたら', 'end', [['hide', '隠す'], ['loop', 'ループ'], ['stay', 'そのまま']]) +
      '<div class="tg-c-hint">設定はほかの動画でも共通で、次に開いたときも同じです</div>';
    menu.addEventListener('click', async e => {
      const b = e.target.closest('button[data-k]');
      if (!b) return;
      const v = b.dataset.k === 'speed' ? +b.dataset.v : b.dataset.v;
      await save({ [b.dataset.k]: v });
      menu?.remove(); menu = null;
    });
    player()?.appendChild(menu);
  }
  document.addEventListener('click', e => { if (menu && !menu.contains(e.target) && e.target !== btn) { menu.remove(); menu = null; } });

  // ---------- 読み込み ----------
  async function load(v) {
    vid = v;
    ctl?.abort();
    ctl = new AbortController();
    token = null; ended = false; loading = true; endAt = 0;
    panel?.classList.remove('tg-c-done');
    list.innerHTML = '<div class="tg-c-pad"></div><div class="tg-c-note">コメントを読み込み中…</div>';
    list.scrollTop = 0;
    try {
      const r = await YTAPI.comments(v, ctl.signal, cfg.sort);
      if (v !== vid) return;
      list.querySelector('.tg-c-note')?.remove();
      if (r.disabled || !r.items.length) {
        list.insertAdjacentHTML('beforeend', `<div class="tg-c-note">${r.disabled ? 'コメントはオフになっています' : 'コメントはまだありません'}</div>`);
        ended = true;
        return;
      }
      append(r.items);
      const pad = list.querySelector('.tg-c-pad');
      if (pad) pad.style.height = list.clientHeight + 'px';
      token = r.token;
      if (!token) markEnded();
    } catch (e) {
      if (!ctl.signal.aborted && v === vid) {
        list.querySelector('.tg-c-note')?.remove();
        list.insertAdjacentHTML('beforeend', '<div class="tg-c-note">コメントを読み込めませんでした</div>');
      }
    } finally {
      loading = false;
    }
  }

  function append(items) {
    list.insertAdjacentHTML('beforeend', items.map(c => `<div class="tg-c-item">
      <div class="tg-c-meta"><span class="tg-c-author">${esc(c.author)}</span>${c.likes && c.likes !== '0' ? `<span class="tg-c-like">♥ ${esc(c.likes)}</span>` : ''}${c.time ? `<span class="tg-c-time">${esc(c.time)}</span>` : ''}</div>
      <div class="tg-c-text">${esc(c.text)}</div></div>`).join(''));
  }

  // 全部読み込んだら、最後のコメントが上へ流れきるよう下にも余白を入れる
  function markEnded() {
    ended = true;
    if (list && list.querySelector('.tg-c-item') && !list.querySelector('.tg-c-tail')) {
      list.insertAdjacentHTML('beforeend', `<div class="tg-c-pad tg-c-tail" style="height:${list.clientHeight}px"></div>`);
    }
  }
  // 最後まで流れたとき：隠す／先頭からループ／そのまま
  let endAt = 0;
  function onEnd(t) {
    if (!ended || loading || !list.querySelector('.tg-c-tail')) return;
    if (!endAt) { endAt = t; return; }
    if (t - endAt < 1200) return;
    endAt = 0;
    if (cfg.end === 'loop') { list.scrollTop = 0; acc = 0; }
    else if (cfg.end === 'hide') panel.classList.add('tg-c-done');
  }

  async function maybeMore() {
    if (!list || loading || !token) return;
    if (list.scrollHeight - list.scrollTop - list.clientHeight > 800) return;
    loading = true;
    const v = vid;
    try {
      const r = await YTAPI.commentsMore(token, ctl.signal);
      if (v !== vid) return;
      append(r.items);
      token = r.token;
      if (!token) markEnded();
    } catch { token = null; markEnded(); } finally { loading = false; }
  }

  // ---------- 自動スクロール ----------
  // 止まっている間は毎フレーム動かさず、0.5秒ごとに再開を確認するだけにする
  let idleT = null;
  function idle() {
    cancelAnimationFrame(raf); raf = 0; last = 0;
    if (idleT) return;
    idleT = setTimeout(() => { idleT = null; if (list && !raf) raf = requestAnimationFrame(tick); }, 500);
  }
  function tick(t) {
    raf = requestAnimationFrame(tick);
    const dt = last ? Math.min(100, t - last) : 16;
    last = t;
    if (!list || document.hidden) return;
    const v = video();
    const playing = v && !v.paused && !v.ended;
    if (!playing || hover || t < userUntil) { idle(); return; }
    if (list.scrollTop + list.clientHeight >= list.scrollHeight - 1) { if (!loading) maybeMore(); onEnd(t); return; }
    endAt = 0;
    acc += (SPEED[cfg.speed] || 36) * dt / 1000;
    if (acc >= 1) { const n = Math.floor(acc); acc -= n; list.scrollTop += n; }
  }

  // ページの切り替え・プレーヤーの作り直しに追従
  document.addEventListener('yt-navigate-finish', () => setTimeout(sync, 500));
  // プレーヤーの作り直しは、再生ページにいる間だけ1.5秒ごとに確認（画面全体の監視はしない）
  setInterval(() => {
    if (document.hidden) return;
    const p = player();
    if (curVid() && p) {
      if ((cfg.side !== 'off' && !p.contains(panel)) || !p.contains(btn) || (btn && !btn.isConnected)) sync();
      else if (cfg.side !== 'off' && curVid() !== vid) sync();
    } else if (!curVid() && (panel || btn)) teardown();
  }, 1500);

  return { sync };
})();

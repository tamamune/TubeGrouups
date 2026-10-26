// YouTubeページへの組み込み：サイドバー・登録チャンネル画面・追加ボタン
(() => {
  let S = { channels: {}, folders: [], meta: {}, activeGroup: null, feedType: 'video', cols: 4 };
  let tick = null, feedSig = '';
  const esc = TG.esc;

  const isSubsFeed = () => location.pathname === '/feed/subscriptions';
  const isChannelPage = () => /^\/(@[^/]+|channel\/|c\/|user\/)/.test(location.pathname);
  const isWatchPage = () => location.pathname === '/watch';
  const isShortsPage = () => /^\/shorts\/[\w-]{11}/.test(location.pathname);

  const P = d => `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`;
  const IC = {
    video: P('M18 4H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zm1 13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1zM10 8.5v7l5.5-3.5z'),
    live: P('M7.76 16.24C6.67 15.16 6 13.66 6 12s.67-3.16 1.76-4.24l1.42 1.42C8.45 9.9 8 10.9 8 12c0 1.1.45 2.1 1.17 2.83l-1.41 1.41zm8.48 0C17.33 15.16 18 13.66 18 12s-.67-3.16-1.76-4.24l-1.42 1.42C15.55 9.9 16 10.9 16 12c0 1.1-.45 2.1-1.17 2.83l1.41 1.41zM12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm8 2c0 2.21-.9 4.21-2.35 5.65l1.42 1.42C20.88 17.26 22 14.76 22 12s-1.12-5.26-2.93-7.07l-1.42 1.42C19.1 7.79 20 9.79 20 12zM6.35 6.35L4.93 4.93C3.12 6.74 2 9.24 2 12s1.12 5.26 2.93 7.07l1.42-1.42C4.9 16.21 4 14.21 4 12s.9-4.21 2.35-5.65z'),
    short: P('M16 2H8a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3zm1 17a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1zM10 8.5v7l5-3.5z'),
    folder: P('M9.17 6l2 2H20v10H4V6h5.17M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z'),
    gear: P('M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z'),
    caret: P('M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z'),
    stats: P('M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z'),
    new: P('M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM8.5 15H7.3l-2.55-3.5V15H3.5V9h1.25l2.5 3.5V9H8.5v6zm5-4.74H11v1.12h2.5v1.26H11v1.11h2.5V15h-4V9h4v1.26zm7 3.74c0 .55-.45 1-1 1h-4c-.55 0-1-.45-1-1V9h1.25v4.51h1.13V9.99h1.25v3.51h1.12V9h1.25v5z'),
    later: P('M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z'),
    rec: P('M12 10.9c-.61 0-1.1.49-1.1 1.1s.49 1.1 1.1 1.1c.61 0 1.1-.49 1.1-1.1s-.49-1.1-1.1-1.1zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19z'),
    grid: P('M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8-2h8v8h-8v-8zm2 2v4h4v-4h-4z')
  };

  // 新着件数・後で見るの本数
  let NC = new Map(), laterN = 0;
  // 件数が変わったときだけ描き直す。呼び出しは1.5秒まとめる
  let countsT = null, countsSig = '';
  function refreshCounts() {
    clearTimeout(countsT);
    countsT = setTimeout(doRefreshCounts, 1500);
  }
  async function doRefreshCounts() {
    const { recent = [], folderSeen = {}, watched = {}, later = [] } = await chrome.storage.local.get(['recent', 'folderSeen', 'watched', 'later']);
    NC = TGX.newCounts(S, recent, watched, folderSeen);
    laterN = later.length;
    setLaterSet(later);
    const sig = JSON.stringify([...NC]) + laterN;
    if (sig === countsSig) return;
    countsSig = sig;
    renderGuide(true);
    const bar = document.getElementById('tg-bar');
    if (bar && isSubsFeed()) { buildBar(bar); layoutBar(); }
  }
  const badge = n => (n ? `<span class="tg-new" title="未視聴の新着 ${n} 本">${n > 99 ? '99+' : n}</span>` : '');

  // YouTubeのテーマ（視聴記録・動作ログ画面の「自動」で使う）
  function saveYtTheme() {
    const dark = document.documentElement.hasAttribute('dark');
    chrome.storage.local.get('ytDark').then(r => { if (r.ytDark !== dark) chrome.storage.local.set({ ytDark: dark }); });
  }
  setTimeout(saveYtTheme, 3000);
  new MutationObserver(saveYtTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['dark'] });

  async function reload() {
    S = await TG.load();
    if (S.activeGroup && S.activeGroup !== '__unsorted' && !S.folders.some(f => f.id === S.activeGroup)) S.activeGroup = null;
    buildFavSet();
    applyHomeCols();
    renderGuide(true);
    renderSubsPage(true);
    renderFab();
    markVideos();
    countsSig = '';
    refreshCounts();
  }

  // ---------- サイドバー ----------
  function renderGuide(force) {
    const sections = document.querySelector('ytd-guide-renderer #sections');
    if (!sections) return;
    const secs = [...sections.children].filter(s => s.matches('ytd-guide-section-renderer'));
    const subs =
      secs.find(s => s.querySelector('a[href^="/@"], a[href^="/channel/"]')) ||
      secs.find(s => s.querySelector('a[href="/feed/channels"]')) ||
      secs[1] || null;

    let sec = document.getElementById('tg-guide');
    if (!sec) {
      sec = document.createElement('div');
      sec.id = 'tg-guide';
      sec.addEventListener('click', onGuideClick);
    }
    if (sec.parentElement !== sections || sec.nextElementSibling !== subs) sections.insertBefore(sec, subs);

    const onSubs = isSubsFeed();
    const sig = JSON.stringify([onSubs, S.activeGroup, S.feedType, S.folders.map(f => [f.id, f.name, f.color, f.parent, f.collapsed]), [...NC], laterN]);
    if (!force && sec.dataset.sig === sig) return;
    sec.dataset.sig = sig;

    const item = (attrs, icon, name, on, extra = '', pad = 12) =>
      `<a class="tg-g-item ${on ? 'tg-on' : ''}" ${attrs} style="padding-left:${pad}px">${icon}<span class="tg-g-name">${esc(name)}</span>${extra}</a>`;

    let h = '<div class="tg-g-block">';
    for (const [t, def] of Object.entries(TGFeed.TYPES)) h += item(`data-type="${t}"`, IC[t], def.label, onSubs && S.feedType === t, t === 'later' && laterN ? `<span class="tg-g-num">${laterN}</span>` : t === 'new' ? badge(NC.get('__all')) : '');
    h += item('data-act="stats"', IC.stats, '視聴記録', false);
    h += '</div><div class="tg-g-block"><div class="tg-g-title">フォルダ</div>';
    for (const { f, depth, hidden } of TG.tree(S.folders)) {
      if (hidden) continue;
      const kids = TG.hasChildren(S.folders, f.id);
      const caret = kids ? `<span class="tg-g-caret ${f.collapsed ? '' : 'open'}" data-caret="${esc(f.id)}">${IC.caret}</span>` : '';
      h += item(`data-f="${esc(f.id)}" title="${esc(TG.pathName(S.folders, f))}"`,
        `<span class="tg-g-ic" style="color:${esc(f.color)}">${IC.folder}</span>`, f.name,
        onSubs && S.activeGroup === f.id, badge(NC.get(f.id)) + caret, 12 + depth * 16);
    }
    h += item('data-f="__unsorted"', `<span class="tg-g-ic">${IC.folder}</span>`, '未分類', onSubs && S.activeGroup === '__unsorted', badge(NC.get('__unsorted')));
    h += item('data-act="manage"', IC.gear, 'フォルダ設定', false);
    h += '</div>';
    sec.innerHTML = h;
  }

  async function onGuideClick(e) {
    const caret = e.target.closest('[data-caret]');
    if (caret) {
      e.preventDefault();
      e.stopPropagation();
      await TG.update(d => {
        const f = d.folders.find(x => x.id === caret.dataset.caret);
        if (!f) return false;
        f.collapsed = !f.collapsed;
      });
      return;
    }
    const a = e.target.closest('.tg-g-item');
    if (!a) return;
    e.preventDefault();
    if (a.dataset.act === 'manage') return TGManager.open();
    if (a.dataset.act === 'stats') return chrome.runtime.sendMessage({ type: 'openStats' });
    if (a.dataset.type) {
      S.feedType = a.dataset.type;
      await chrome.storage.local.set({ feedType: S.feedType });
    } else if (a.dataset.f) {
      const wasRec = S.feedType === 'rec' || S.feedType === 'later' || S.feedType === 'new';
      if (wasRec) { S.feedType = 'video'; await chrome.storage.local.set({ feedType: 'video' }); } // おすすめ画面ではフォルダが効かないので動画に戻す
      S.activeGroup = isSubsFeed() && !wasRec && S.activeGroup === a.dataset.f ? null : a.dataset.f;
      await TG.setActive(S.activeGroup);
    }
    goSubs();
  }

  function goSubs() {
    if (isSubsFeed()) {
      renderGuide(true);
      renderSubsPage(true);
      window.scrollTo({ top: 0 });
      return;
    }
    const link = document.querySelector('ytd-guide-renderer a[href="/feed/subscriptions"], ytd-mini-guide-renderer a[href="/feed/subscriptions"]');
    if (link) link.click();
    else location.assign('/feed/subscriptions');
  }

  // ---------- 登録チャンネル画面（独自一覧に置き換え） ----------
  function renderSubsPage(rebuild) {
    if (!isSubsFeed()) return;
    const browse = document.querySelector('ytd-browse[page-subtype="subscriptions"]');
    const primary = browse?.querySelector('#primary');
    if (!primary) return;
    browse.classList.add('tg-takeover');

    let bar = document.getElementById('tg-bar');
    let spacer = document.getElementById('tg-bar-spacer');
    let feed = document.getElementById('tg-feed');
    if (!bar) { bar = document.createElement('div'); bar.id = 'tg-bar'; bar.addEventListener('click', onBarClick); rebuild = true; }
    if (!spacer) { spacer = document.createElement('div'); spacer.id = 'tg-bar-spacer'; }
    if (!feed) { feed = document.createElement('div'); feed.id = 'tg-feed'; rebuild = true; }
    if (bar.parentElement !== primary || primary.firstElementChild !== bar) primary.prepend(bar);
    if (bar.nextElementSibling !== spacer) bar.after(spacer);
    if (spacer.nextElementSibling !== feed) spacer.after(feed);
    TGFeed.mount(feed);
    TGFeed.setHideWatched(S.hideWatched);
    watchBar(primary, bar);
    if (!rebuild) { layoutBar(); return; }

    buildBar(bar);
    layoutBar();
    if (S.feedType === 'new') TGX.markSeen(S, null);
    else if (S.feedType !== 'rec' && S.feedType !== 'later') TGX.markSeen(S, S.activeGroup);
    const sig = TGFeed.signature(S);
    if (sig !== feedSig || !feed.dataset.painted) {
      feedSig = sig;
      feed.dataset.painted = '1';
      TGFeed.refresh(S);
    } else {
      TGFeed.setCols(S.cols);
    }
  }

  // 上部バーは画面上端（ヘッダーの下）に固定し、同じ高さの空白を置いて動画と重ならないようにする
  let barRO = null;
  function watchBar(primary, bar) {
    if (barRO?.target === primary) return;
    barRO?.disconnect();
    barRO = new ResizeObserver(layoutBar);
    barRO.target = primary;
    barRO.observe(primary);
    barRO.observe(bar);
  }
  function layoutBar() {
    const bar = document.getElementById('tg-bar');
    const spacer = document.getElementById('tg-bar-spacer');
    if (!bar || !spacer || !isSubsFeed()) return;
    const r = bar.parentElement.getBoundingClientRect();
    if (!r.width) return;
    const top = document.querySelector('#masthead-container, ytd-masthead')?.getBoundingClientRect().bottom || 56;
    bar.style.top = Math.max(0, top) + 'px';
    bar.style.left = r.left + 'px';
    bar.style.width = r.width + 'px';
    // フォルダの段をたたんでいる間は、下の余白を縮めない（動画の位置がずれないように）
    if (bar.classList.contains('tg-folded')) return;
    const h = bar.offsetHeight + 'px';
    if (spacer.style.height !== h) spacer.style.height = h;
  }
  window.addEventListener('resize', layoutBar);

  // ---------- フォルダの段の自動たたみ（下へスクロールで隠す／上へで出す／つまみで切り替え） ----------
  let folded = false, lastY = 0, scrollRaf = 0, manualUntil = 0;
  function setFolded(v) {
    const bar = document.getElementById('tg-bar');
    if (!bar || !bar.classList.contains('tg-bar-full')) return;
    folded = v;
    bar.classList.toggle('tg-folded', v);
    const tab = bar.querySelector('.tg-index');
    if (tab) tab.setAttribute('aria-expanded', String(!v));
    if (!v) setTimeout(layoutBar, 260); // 開き終わってから余白を合わせる
  }
  window.addEventListener('scroll', () => {
    if (scrollRaf || !isSubsFeed()) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      const y = scrollY, dy = y - lastY;
      lastY = y;
      if (performance.now() < manualUntil) return;
      if (y < 60) { if (folded) setFolded(false); return; }
      if (dy > 6 && !folded) setFolded(true);
      else if (dy < -10 && folded) setFolded(false);
    });
  }, { passive: true });

  function buildBar(bar) {
    const chip = (attrs, label, on, n, color) =>
      `<button class="tg-chip ${on ? 'tg-active' : ''}" ${attrs}>${color ? `<i class="tg-cdot" style="background:${esc(color)}"></i>` : ''}<span class="tg-clabel">${esc(label)}</span>${badge(n)}</button>`;
    const tops = S.folders.filter(f => !f.parent || !S.folders.some(x => x.id === f.parent));
    const root = S.activeGroup && S.activeGroup !== '__unsorted' ? TG.rootOf(S.folders, S.activeGroup) : null;

    // 1段目：表示の種類・列数・操作
    const seg = (attr, val, label, on) => `<button class="tg-seg-btn ${on ? 'tg-active' : ''}" ${attr}="${val}">${label}</button>`;
    const types = Object.entries(TGFeed.TYPES).map(([t, d]) => seg('data-type', t, d.short || d.label, S.feedType === t)).join('');
    const cols = [3, 4, 5, 6, 7].map(n => seg('data-cols', n, n, S.cols === n)).join('');
    const play = S.feedType === 'video' || S.feedType === 'live' || S.feedType === 'later' || S.feedType === 'new'
      ? '<button class="tg-chip tg-play" data-play="1" title="表示中の未視聴の動画を、新しい順に続けて再生">▶ 連続再生</button>' : '';
    const hidew = `<button class="tg-chip tg-ghost ${S.hideWatched ? 'tg-active' : ''}" data-hidew="1" title="90%以上見た動画を一覧から隠す">${S.hideWatched ? '視聴済みを表示' : '視聴済みを隠す'}</button>`;
    const tools = `<div class="tg-seg">${types}</div><div class="tg-seg" title="列の数"><span class="tg-seg-lb">列</span>${cols}</div>`;

    // 2段目：フォルダ（横幅いっぱいに折り返し）
    let folders = chip('data-g=""', 'すべて', !S.activeGroup, NC.get('__all'));
    folders += chip('data-g="__unsorted"', '未分類', S.activeGroup === '__unsorted', NC.get('__unsorted'));
    folders += '<span class="tg-sep"></span>';
    tops.forEach(f => { folders += chip(`data-g="${esc(f.id)}"`, f.name, root?.id === f.id, NC.get(f.id), f.color); });

    // 3段目：選択中のフォルダの中のフォルダ
    let sub = '';
    if (root && TG.hasChildren(S.folders, root.id)) {
      const tree = TG.tree(S.folders);
      const base = tree.find(x => x.f.id === root.id)?.depth || 0;
      const inRoot = TG.subtreeIds(S.folders, root.id);
      sub += chip(`data-g="${esc(root.id)}"`, `${root.name}（すべて）`, S.activeGroup === root.id, NC.get(root.id), root.color);
      tree.forEach(({ f, depth }) => {
        if (f.id !== root.id && inRoot.has(f.id)) sub += chip(`data-g="${esc(f.id)}"`, `${'› '.repeat(Math.max(1, depth - base))}${f.name}`, S.activeGroup === f.id, NC.get(f.id), f.color);
      });
    }

    let cur = S.activeGroup === '__unsorted' ? { name: '未分類' } : S.folders.find(f => f.id === S.activeGroup);
    let curName = cur ? (cur.id ? TG.pathName(S.folders, cur) : cur.name) : 'すべて';
    let totalNew = cur ? NC.get(cur.id || '__unsorted') : NC.get('__all');
    let row2 = `<div class="tg-chips tg-folders">${folders}</div>
        ${sub ? `<div class="tg-chips tg-sub"><span class="tg-sub-lb">${esc(root.name)} の中</span>${sub}</div>` : ''}`;
    // おすすめ・後で見る：1段目は動画と同じ並び、2段目にその画面の操作
    if (S.feedType === 'rec') {
      row2 = `<div class="tg-chips tg-folders"><span class="tg-bar-title">${IC.rec}おすすめ<small>（未登録チャンネルのみ）</small></span>
        <div class="tg-seg" title="おすすめの種類">${seg('data-reckind', 'video', '動画', S.recKind !== 'short')}${seg('data-reckind', 'short', 'ショート', S.recKind === 'short')}</div>
        <button class="tg-chip tg-ghost" data-reload="1">更新</button></div>`;
      cur = null; curName = 'おすすめ'; totalNew = 0;
    } else if (S.feedType === 'new') {
      const off = new Set(S.newOff);
      const cat = (id, name, color, n) => `<button class="tg-chip tg-cat ${off.has(id) ? '' : 'tg-active'}" data-ncat="${esc(id)}" title="${off.has(id) ? '押すと表示' : '押すと隠す'}">${color ? `<i class="tg-cdot" style="background:${esc(color)}"></i>` : ''}<span class="tg-clabel">${esc(name)}</span>${badge(n)}</button>`;
      row2 = `<div class="tg-chips tg-folders"><span class="tg-bar-title">${IC.new}新着動画<small>カテゴリを押してオン／オフ</small></span>
        <button class="tg-chip tg-ghost" data-ncatall="1">${off.size ? 'すべてオン' : 'すべてオフ'}</button>
        ${tops.map(f => cat(f.id, f.name, f.color, NC.get(f.id))).join('')}${cat('__unsorted', '未分類', '', NC.get('__unsorted'))}
        <button class="tg-chip tg-ghost" data-reload="1" title="今すぐ新着を確認">更新</button></div>`;
      cur = null; curName = '新着動画'; totalNew = NC.get('__all');
    } else if (S.feedType === 'later') {
      row2 = `<div class="tg-chips tg-folders"><span class="tg-bar-title">${IC.later}後で見る<small>上：🕒で追加した動画／下：YouTubeの「後で見る」</small></span>
        <button class="tg-chip tg-ghost" data-reload="1" title="YouTubeの「後で見る」を読み込み直す">更新</button></div>`;
      cur = null; curName = '後で見る'; totalNew = 0;
    }
    bar.className = 'tg-bar-full' + (folded ? ' tg-folded' : '');
    bar.innerHTML = `<div class="tg-bar-tools">${tools}<span class="tg-grow"></span>${play}${hidew}
        <button class="tg-chip tg-ghost" data-manage="1">${IC.gear}フォルダ設定</button></div>
      <div class="tg-fold"><div class="tg-fold-in">
        ${row2}
      </div></div>
      <button class="tg-index" data-fold="1" aria-expanded="${!folded}" title="フォルダの表示／非表示">
        ${cur?.color ? `<i class="tg-cdot" style="background:${esc(cur.color)}"></i>` : '📁'}<span>${esc(curName)}</span>${badge(totalNew)}<b class="tg-caret">▾</b></button>`;
  }

  // 連続再生：表示中の未視聴＋（フォルダ表示なら）そのフォルダの直近の新着、新しい順
  async function playNow(btn) {
    let list = TGFeed.playable();
    let title = S.feedType === 'new' ? '新着動画' : '後で見る';
    if (S.feedType !== 'later' && S.feedType !== 'new') {
      const f = S.folders.find(x => x.id === S.activeGroup);
      title = f ? TG.pathName(S.folders, f) : S.activeGroup === '__unsorted' ? '未分類' : 'すべて';
      if (S.feedType === 'video') {
        const { recent = [], watched = {} } = await chrome.storage.local.get(['recent', 'watched']);
        let set = null;
        if (f) set = TG.matchSet(S.channels, [...TG.folderKeys(S.folders, f.id)]);
        if (S.activeGroup === '__unsorted') {
          const inAny = TG.matchSet(S.channels, [...new Set(S.folders.flatMap(x => x.keys))]);
          set = TG.matchSet(S.channels, Object.keys(S.channels).filter(k => !inAny.has(k)));
        }
        const extra = recent.filter(x => !x.live && Math.max(x.w || 0, watched[x.v]?.p || 0) < 90 && (!set || set.has(x.k) || (x.id && set.has('channel/' + x.id))));
        const seen = new Set(list.map(x => x.v));
        list = list.concat(extra.filter(x => !seen.has(x.v))).sort((a, b) => (b.p || 0) - (a.p || 0));
      }
    }
    list = list.slice(0, 100);
    if (!list.length) {
      btn.textContent = '未視聴の動画がありません';
      setTimeout(() => { btn.textContent = '▶ 連続再生'; }, 2500);
      return;
    }
    TGX.startQueue(list, title);
  }

  async function onBarClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.manage) return TGManager.open();
    if (b.dataset.fold) { manualUntil = performance.now() + 700; setFolded(!folded); return; }
    if (b.dataset.reload) return TGFeed.refresh(S, { force: true });
    if (b.dataset.ncat || b.dataset.ncatall) {
      const tops = S.folders.filter(f => !f.parent || !S.folders.some(x => x.id === f.parent)).map(f => f.id).concat('__unsorted');
      let off = new Set(S.newOff);
      if (b.dataset.ncatall) off = off.size ? new Set() : new Set(tops);
      else off.has(b.dataset.ncat) ? off.delete(b.dataset.ncat) : off.add(b.dataset.ncat);
      S.newOff = [...off];
      await chrome.storage.local.set({ newOff: S.newOff });
      buildBar(document.getElementById('tg-bar'));
      layoutBar();
      return TGFeed.refresh(S);
    }
    if (b.dataset.reckind) {
      if (S.recKind === b.dataset.reckind) return;
      S.recKind = b.dataset.reckind;
      await chrome.storage.local.set({ recKind: S.recKind });
      buildBar(document.getElementById('tg-bar'));
      layoutBar();
      window.scrollTo({ top: 0 });
      return TGFeed.refresh(S);
    }
    if (b.dataset.play) return playNow(b);
    if (b.dataset.hidew) {
      S.hideWatched = !S.hideWatched;
      await chrome.storage.local.set({ hideWatched: S.hideWatched });
      TGFeed.setHideWatched(S.hideWatched);
      buildBar(document.getElementById('tg-bar'));
      layoutBar();
      return;
    }
    if (b.dataset.type) {
      S.feedType = b.dataset.type;
      await chrome.storage.local.set({ feedType: S.feedType });
    } else if (b.dataset.cols) {
      S.cols = +b.dataset.cols;
      await chrome.storage.local.set({ cols: S.cols });
      return;
    } else if ('g' in b.dataset) {
      if (S.feedType === 'rec' || S.feedType === 'later' || S.feedType === 'new') { S.feedType = 'video'; await chrome.storage.local.set({ feedType: 'video' }); }
      S.activeGroup = b.dataset.g || null;
      await TG.setActive(S.activeGroup);
    }
    window.scrollTo({ top: 0 });
  }

  // ---------- ホーム等の動画：登録チャンネル＝青枠 / それ以外＝赤枠 ----------
  const ITEM_SEL = 'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model, ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2, ytd-reel-item-renderer';
  const CH_LINK_SEL = 'a[href^="/@"], a[href^="/channel/"], a[href^="/c/"], a[href^="/user/"]';
  let favSet = new Set(), fMap = new Map(), nameMap = new Map();
  const normName = t => (t || '').replace(/\s+/g, ' ').trim().toLowerCase();
  function buildFavSet() {
    bumpMark();
    const subs = Object.values(S.channels).filter(c => !c.unsub);
    favSet = TG.matchSet(S.channels, subs.map(c => c.key));
    fMap = TG.folderMap(S.channels, S.folders);
    nameMap = new Map();
    subs.forEach(c => { if (c.name) nameMap.set(normName(c.name), c.key); });
  }
  const NAME_SEL = '[class*="metadata-row" i], [class*="metadatarow" i], ytd-channel-name #text, #channel-name #text, #byline';
  const MIX_SEL = 'a[href*="start_radio="], a[href^="/playlist"], yt-collection-thumbnail-view-model, ytd-playlist-thumbnail';
  // ---------- 動画ID → チャンネル（oEmbed）。チャンネル情報が画面に無いショート等で使う ----------
  const vidOwner = new Map();
  let ownerQ = [], ownerBusy = 0, ownerSaveT = null, markT = null;
  chrome.storage.local.get('vidOwner').then(({ vidOwner: o }) => { for (const [k, v] of Object.entries(o || {})) if (v?.k || v?.n) vidOwner.set(k, v); }); // 分からなかったもの（空）は調べ直す
  function videoIdOf(item) {
    const a = item.querySelector('a[href*="/shorts/"], a[href*="watch?v="]');
    const h = a?.getAttribute('href') || '';
    return (h.match(/\/shorts\/([\w-]{11})/) || h.match(/[?&]v=([\w-]{11})/))?.[1] || null;
  }
  function scheduleMark() { clearTimeout(markT); markT = setTimeout(markVideos, 300); }
  function lookupOwner(vid) {
    if (vidOwner.has(vid) || ownerQ.includes(vid)) return;
    ownerQ.push(vid);
    pumpOwner();
  }
  function pumpOwner() {
    while (ownerBusy < 4 && ownerQ.length) {
      const vid = ownerQ.shift();
      ownerBusy++;
      fetch(`/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + vid)}&format=json`, { credentials: 'omit' })
        .then(r => (r.ok ? r.json() : null))
        // 埋め込み禁止の動画（音楽・ダンスなど）は oEmbed で取れないので、YouTubeの動画情報から調べる
        .then(async j => j?.author_url ? { k: TG.channelKey(j.author_url) || '', n: j.author_name || '' } : (await YTAPI.videoOwner(vid).catch(() => null)))
        .then(o => vidOwner.set(vid, o || { k: '', n: '' }))
        .catch(() => vidOwner.set(vid, { k: '', n: '' }))
        .finally(() => {
          ownerBusy--;
          scheduleMark();
          clearTimeout(ownerSaveT);
          ownerSaveT = setTimeout(() => {
            const o = Object.fromEntries([...vidOwner].slice(-4000)); // 古いものから捨てる
            chrome.storage.local.set({ vidOwner: o });
          }, 3000);
          pumpOwner();
        });
    }
  }
  function ownerKey(o) {
    if (!o || (!o.k && !o.n)) return null;
    if (o.k && favSet.has(o.k)) return o.k;
    return nameMap.get(normName(o.n)) || o.k || '__other';
  }

  // リンクが無い欄（再生画面の横など）はチャンネル名の文字で判別する
  function nameEl(item) {
    const row = item.querySelector(NAME_SEL);
    if (!row) return null;
    return row.querySelector('a, span.yt-core-attributed-string, span') || row;
  }
  // 枠を描く部品：入れ子のうち一番外側のサムネ部品（querySelectorは外側から見つける）
  const THUMB_SEL = 'ytd-thumbnail, yt-thumbnail-view-model, [class*="content-image" i], [class*="contentimage" i], [class*="thumbnailcontainer" i]:not([class*="parent" i])';
  function frameTarget(item) {
    const t = item.querySelector(THUMB_SEL);
    if (!t) return;
    if (!t.classList.contains('tg-fr')) {
      t.classList.add('tg-fr');
      if (getComputedStyle(t).position === 'static') t.style.position = 'relative';
    }
    // 位置合わせは画像が読み込まれた後に1回だけ（毎回測ると重い）
    if (t.dataset.tgFit === fitGen) return;
    const img = t.querySelector('img');
    if (!img) return;
    if (!img.complete || !img.naturalWidth) {
      if (!img.dataset.tgWait) { img.dataset.tgWait = '1'; img.addEventListener('load', () => { delete img.dataset.tgWait; fitQueue.add(t); flushFit(); }, { once: true }); }
      return;
    }
    fitQueue.add(t);
    flushFit();
  }
  // 測定はまとめて1フレームで（読み取り→書き込みの順にして描き直しを1回に）
  let fitGen = '1', fitQueue = new Set(), fitRaf = 0;
  function flushFit() {
    if (fitRaf) return;
    fitRaf = requestAnimationFrame(() => {
      fitRaf = 0;
      const list = [...fitQueue].filter(t => t.isConnected);
      fitQueue.clear();
      const rects = list.map(t => { const img = t.querySelector('img'); return img ? [t.getBoundingClientRect(), img.getBoundingClientRect()] : null; });
      list.forEach((t, i) => { if (rects[i]) fitFrame(t, ...rects[i]); });
    });
  }
  let resizeT = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { fitGen = String(+fitGen + 1); document.querySelectorAll('.tg-fr').forEach(t => fitQueue.add(t)); flushFit(); }, 400);
  });
  // 枠を画像の範囲にぴったり合わせる（部品が画像より大きい場合、その差を内側に詰める）
  function fitFrame(t, a, b) {
    if (!a.height || !b.height) return;
    t.dataset.tgFit = fitGen;
    const px = v => Math.max(0, Math.round(v)) + 'px';
    const vals = { '--tg-it': px(b.top - a.top), '--tg-ir': px(a.right - b.right), '--tg-ib': px(a.bottom - b.bottom), '--tg-il': px(b.left - a.left) };
    for (const [k, v] of Object.entries(vals)) if (t.style.getPropertyValue(k) !== v) t.style.setProperty(k, v);
  }

  // 処理済みの動画は、中身（リンク）が変わるか設定が変わるまで飛ばす
  let markGen = 1;
  const bumpMark = () => { markGen++; };
  function itemSig(item) {
    const a = item.querySelector('a[href*="watch?v="], a[href*="/shorts/"], a[href^="/@"], a[href^="/channel/"]');
    return markGen + '|' + (a?.getAttribute('href') || item.textContent.length);
  }
  // ---------- 後で見る（ホーム・検索・再生画面の横の動画、再生中の動画） ----------
  let laterSet = new Set();
  function setLaterSet(list) {
    laterSet = new Set((list || []).map(x => x.v));
    document.querySelectorAll('.tg-lbtn').forEach(paintLaterBtn);
  }
  chrome.storage.local.get('later').then(({ later }) => setLaterSet(later));
  function paintLaterBtn(b) {
    const on = laterSet.has(b.dataset.v);
    b.classList.toggle('on', on);
    const label = b.id === 'tg-lfab' ? (on ? '✓ 後で見る' : '🕒 後で見る') : b.classList.contains('tg-lov') ? (on ? '✓' : '🕒') : (on ? '✓ 後で見る' : '🕒');
    if (b.textContent !== label) b.textContent = label;
    b.title = on ? 'TubeGroupsの「後で見る」から外す' : 'TubeGroupsの「後で見る」に追加（サイドバーの「後で見る」で一覧）';
  }
  function laterBtn(v, list = '', short = false) {
    const b = document.createElement('button');
    b.className = 'tg-lbtn';
    b.dataset.v = v;
    if (list) b.dataset.list = list;
    if (short) b.dataset.short = '1';
    paintLaterBtn(b);
    return b;
  }
  const txt = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  function laterInfo(btn) {
    const v = btn.dataset.v;
    const th = `https://i.ytimg.com/vi/${v}/mqdefault.jpg`;
    const extra = { ...(btn.dataset.list ? { list: btn.dataset.list } : {}), ...(btn.dataset.short ? { short: true } : {}) };
    if (btn.id === 'tg-lfab') {
      const ch = currentChannel();
      const t = isShortsPage()
        ? txt(document.querySelector('ytd-reel-video-renderer[is-active] h2, ytd-reel-video-renderer[is-active] [class*="title" i], yt-shorts-video-title-view-model')) || document.title.replace(/ - YouTube$/, '')
        : txt(document.querySelector('ytd-watch-metadata h1, #title h1')) || document.title.replace(/ - YouTube$/, '');
      return { v, t, th, ...extra, ch: { key: ch?.key || '', name: ch?.name || '', unsub: !(ch && favSet.has(ch.key)) } };
    }
    const item = btn.closest(ITEM_SEL);
    const tEl = item?.querySelector('#video-title, a#video-title-link, h3 a, h3, [class*="title" i] a[href*="watch"], [class*="title" i] a[href*="shorts"], [class*="title" i] span');
    const t = txt(tEl) || tEl?.getAttribute('title') || '';
    const link = item?.querySelector(CH_LINK_SEL);
    let key = link ? TG.channelKey(link.getAttribute('href')) : null;
    const nm = txt(item && nameEl(item));
    if (!key && nm) key = nameMap.get(normName(nm)) || null;
    if (!key && vidOwner.has(v)) key = ownerKey(vidOwner.get(v));
    if (key === '__other') key = '';
    const name = (key && S.channels[key]?.name) || nm || txt(link) || vidOwner.get(v)?.n || '';
    return { v, t, th, ...extra, ch: { key: key || '', name, unsub: !(key && favSet.has(key)) } };
  }
  // サムネや動画リンクの中にあってもページ移動させない
  ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'].forEach(type => window.addEventListener(type, async e => {
    const b = e.target.closest?.('.tg-lbtn');
    if (!b) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (type !== 'click' || b.dataset.busy) return;
    b.dataset.busy = '1';
    try {
      const added = await TGX.toggleLater(laterInfo(b));
      laterSet[added ? 'add' : 'delete'](b.dataset.v);
      document.querySelectorAll('.tg-lbtn').forEach(paintLaterBtn);
    } finally { delete b.dataset.busy; }
  }, true));
  function renderLaterFab() {
    let b = document.getElementById('tg-lfab');
    const v = isWatchPage() ? new URLSearchParams(location.search).get('v') : isShortsPage() ? location.pathname.split('/')[2] : null;
    if (!v) { b?.remove(); return; }
    if (!b) {
      b = document.createElement('button');
      b.id = 'tg-lfab';
      b.className = 'tg-lbtn';
      if (isShortsPage()) b.dataset.short = '1';
      document.body.appendChild(b);
    }
    if (b.dataset.v !== v) b.dataset.v = v;
    paintLaterBtn(b);
  }

  // 再生リスト・ミックス（束ねたサムネ）。ミックス・ステーションは最初の動画＋リストIDで「後で見る」に入れられる
  const COLL_SEL = 'yt-collection-thumbnail-view-model, ytd-playlist-thumbnail, a[href^="/playlist"]';
  const listIdOf = item => {
    const a = item.querySelector('a[href*="list="]');
    return (a?.getAttribute('href') || '').match(/[?&]list=([\w-]+)/)?.[1] || '';
  };
  const isShortItem = item => item.matches('ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2, ytd-reel-item-renderer') || !!item.querySelector('ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2, a[href^="/shorts/"]');
  const META_SEL = 'yt-lockup-metadata-view-model, [class*="lockup-metadata" i], #meta, #details';
  function markVideos() {
    if (!favSet.size) return; // まだ登録チャンネルを読み込んでいない
    const app = document.querySelector('ytd-app');
    if (!app) return;
    for (const item of app.querySelectorAll(ITEM_SEL)) {
      const sigNow = itemSig(item);
      // 処理済みでも、YouTubeが中身を描き直して枠や🕒が消えていたらやり直す
      if (item.dataset.tgSig === sigNow && decoOk(item)) continue;
      if (item.closest('#tg-feed')) continue;
      item.dataset.tgSig = sigNow;
      item.dataset.tgNeed = '';
      const coll = !!item.querySelector(COLL_SEL);
      const lvid = videoIdOf(item);
      if (coll) {
        // ミックス・再生リスト：枠は付けず、動画があるものだけ🕒
        if (item.dataset.tgfav) delete item.dataset.tgfav;
        if (item.parentElement?.closest(ITEM_SEL) || !lvid) continue;
        placeRow(item, null, [], null, lvid, listIdOf(item));
        continue;
      }
      const links = [...item.querySelectorAll(CH_LINK_SEL)];
      let key = links.length ? TG.channelKey(links[0].getAttribute('href')) : null;
      let byName = null;
      if (!key) {
        byName = nameEl(item);
        const nm = normName(byName?.textContent);
        if (nm) key = nameMap.get(nm) || null;
        if (!key) {
          // 名前で見つからない／名前が無い → 動画IDからチャンネルを調べる
          if (lvid) {
            if (vidOwner.has(lvid)) key = ownerKey(vidOwner.get(lvid)) || (nm ? '__other' : null); // 調べても分からない＝登録外として赤枠
            else { lookupOwner(lvid); delete item.dataset.tgSig; } // 判別できたら後でもう一度
          }
          if (!key && nm && !lvid) key = '__other';
        }
      }
      const val = key ? (favSet.has(key) ? '1' : '0') : '';
      if ((item.dataset.tgfav || '') !== val) {
        if (val) item.dataset.tgfav = val;
        else delete item.dataset.tgfav;
      }
      if (val) frameTarget(item);
      if (val && item.querySelector(THUMB_SEL)) item.dataset.tgNeed += 'f';
      if (item.parentElement?.closest(ITEM_SEL)) continue; // 入れ子は外側だけ
      placeRow(item, key, links, byName, lvid, '');
    }
  }
  // チャンネル名の下に「🕒＋フォルダ名」の行。置き場所が無いもの（ショート等）はサムネの左上に🕒
  function placeRow(item, key, links, byName, lvid, list) {
    const folders = key ? fMap.get(key) || [] : [];
    const short = isShortItem(item);
    const sig = folders.map(f => f.id + f.name + f.color).join('|') + '|' + (lvid || '') + '|' + list;
    const cur = item.querySelector('.tg-ftags, .tg-lov');
    if (cur && cur.dataset.sig === sig && cur.isConnected) { item.dataset.tgNeed += cur.classList.contains('tg-lov') ? 'o' : 'r'; return; }
    item.querySelectorAll('.tg-ftags, .tg-lov').forEach(x => x.remove());
    if (!folders.length && !lvid) return;
    let anchor = null, append = null;
    if (!short) {
      anchor = byName;
      if (!anchor) {
        const nameLink = links.find(l => l.textContent.trim() && !l.closest('#avatar, #avatar-link, yt-decorated-avatar-view-model'));
        anchor = nameLink ? nameLink.closest('ytd-channel-name') || nameLink : nameEl(item);
      }
      if (anchor) {
        // チャンネル名の「行」の直後に専用の1行として入れる（同じ行だと幅が足りず切れる）
        const ROW_SEL = '[class*="metadata-row" i], #byline-container, #channel-info, ytd-channel-name';
        const row = anchor.closest(ROW_SEL);
        if (row && item.contains(row)) anchor = row.closest('#channel-info') || row;
      } else {
        append = item.querySelector(META_SEL); // 名前が見つからない形式（音楽・ステーション等）は情報欄の最後に
      }
    }
    if (!anchor && !append) {
      if (!lvid) return;
      const t = item.querySelector(THUMB_SEL) || item.querySelector('a[href*="/shorts/"], a[href*="watch?v="]');
      if (!t) return;
      if (getComputedStyle(t).position === 'static') t.style.position = 'relative';
      const b = laterBtn(lvid, list, short);
      b.classList.add('tg-lov');
      b.dataset.sig = sig;
      t.appendChild(b);
      item.dataset.tgNeed += 'o';
      return;
    }
    const span = document.createElement('div');
    span.className = 'tg-ftags tg-ftags-row';
    span.dataset.sig = sig;
    if (lvid) span.appendChild(laterBtn(lvid, list, short));
    folders.forEach(f => {
      const t = document.createElement('span');
      t.className = 'tg-ftag';
      t.style.setProperty('--c', f.color);
      t.textContent = f.name;
      span.appendChild(t);
    });
    if (anchor) anchor.insertAdjacentElement('afterend', span);
    else append.appendChild(span);
    item.dataset.tgNeed += 'r';
  }
  function decoOk(item) {
    const n = item.dataset.tgNeed || '';
    if (n.includes('f')) {
      const t = item.querySelector(THUMB_SEL);
      if (t && !t.classList.contains('tg-fr')) return false;
    }
    if (n.includes('r') && !item.querySelector('.tg-ftags')) return false;
    if (n.includes('o') && !item.querySelector('.tg-lov')) return false;
    return true;
  }

  // ---------- ホームの列数（動画 / ショート別） ----------
  function applyHomeCols() {
    let st = document.getElementById('tg-homecols');
    if (!st) {
      st = document.createElement('style');
      st.id = 'tg-homecols';
      document.documentElement.appendChild(st);
    }
    const H = 'ytd-browse[page-subtype="home"]';
    let css = '';
    if (S.homeCols) {
      css += `${H} ytd-rich-grid-renderer { --ytd-rich-grid-items-per-row: ${S.homeCols} !important; }
        ${H} ytd-rich-grid-row, ${H} ytd-rich-grid-row > #contents { display: contents !important; }`;
    }
    if (st.textContent !== css) st.textContent = css;
    renderHomeTool();
    document.querySelectorAll('[data-tg-memo]').forEach(e => delete e.dataset.tgMemo);
    layoutHome();
  }

  // 拡張機能が上書きしたスタイルだけを記録し、「自動」に戻すときはYouTube自身の値に戻す
  const setStyle = (el, prop, val) => {
    const k = 'tgs' + prop.replace(/[^a-z]/gi, '');
    if (val === '' || val == null) {
      if (k in el.dataset) {
        const orig = el.dataset[k];
        if (orig) el.style.setProperty(prop, orig); else el.style.removeProperty(prop);
        delete el.dataset[k];
      }
      return;
    }
    if (!(k in el.dataset)) el.dataset[k] = el.style.getPropertyValue(prop) || '';
    if (el.style.getPropertyValue(prop) !== String(val) || el.style.getPropertyPriority(prop) !== 'important') {
      el.style.setProperty(prop, String(val), 'important');
    }
  };

  // YouTubeは自分の列数ごとにショート棚を差し込むので、指定列数で行が埋まってから棚が来るよう並べ替える
  function layoutHome() {
    if (location.pathname !== '/') return;
    const browse = document.querySelector('ytd-browse[page-subtype="home"]');
    const grid = browse?.querySelector('ytd-rich-grid-renderer');
    const contents = grid?.querySelector('#contents');
    if (!contents) return;
    const N = S.homeCols;
    // 動画の数・設定が変わっていなければやり直さない
    const memo = `${contents.childElementCount}|${N}|${S.homeShortCols}|${browse.querySelectorAll('ytd-rich-shelf-renderer[is-shorts] #contents > ytd-rich-item-renderer').length}`;
    if (contents.dataset.tgMemo === memo) return;
    contents.dataset.tgMemo = memo;
    const kids = [...contents.querySelectorAll('ytd-rich-item-renderer, ytd-rich-section-renderer, ytd-continuation-item-renderer')]
      .filter(e => !e.parentElement.closest('ytd-rich-section-renderer'));
    let pos = 0, n = 0;
    const pending = [];
    for (const el of kids) {
      if (!N) { setStyle(el, 'order', ''); continue; }
      if (el.tagName === 'YTD-RICH-SECTION-RENDERER') { pending.push(el); continue; }
      if (el.tagName === 'YTD-CONTINUATION-ITEM-RENDERER') { setStyle(el, 'order', 999999); continue; }
      setStyle(el, 'order', pos++);
      if (!el.hidden && !el.hasAttribute('hidden') && ++n % N === 0) {
        pending.forEach(sec => setStyle(sec, 'order', pos++));
        pending.length = 0;
      }
    }
    pending.forEach(sec => setStyle(sec, 'order', pos++));

    // ショート棚：届いている本数より多い列数だと空欄になるので、本数に合わせて詰める
    const M = S.homeShortCols;
    browse.querySelectorAll('ytd-rich-shelf-renderer[is-shorts]').forEach(shelf => {
      const items = [...shelf.querySelectorAll('#contents > ytd-rich-item-renderer')];
      // 届いている本数が足りなければ、棚の「もっと見る」を1回だけ押して追加分を読み込ませる
      if (M && items.length < M && !shelf.dataset.tgExpanded) {
        const btn = [...shelf.querySelectorAll('#show-more-button button, [id*="show-more" i] button, button')]
          .find(b => /もっと見る|show more|さらに表示/i.test((b.getAttribute('aria-label') || '') + ' ' + b.textContent));
        if (btn) { shelf.dataset.tgExpanded = '1'; btn.click(); }
      }
      const eff = M ? Math.max(1, Math.min(M, items.length)) : '';
      setStyle(shelf, '--ytd-rich-grid-slim-items-per-row', eff);
      setStyle(shelf, '--ytd-rich-grid-items-per-row', eff);
      setStyle(shelf, '--ytd-rich-shelf-items-count', eff);
      items.forEach((it, i) => setStyle(it, 'display', M ? (i < eff ? 'block' : 'none') : ''));
    });
  }

  function renderHomeTool() {
    const isHome = location.pathname === '/';
    let tool = document.getElementById('tg-hometool');
    if (!isHome) { tool?.remove(); return; }
    if (!tool) {
      tool = document.createElement('div');
      tool.id = 'tg-hometool';
      tool.addEventListener('click', async e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.toggle) { tool.classList.toggle('open'); return; }
        const v = b.dataset.v === '' ? null : +b.dataset.v;
        await chrome.storage.local.set({ [b.dataset.k]: v });
      });
      document.body.appendChild(tool);
    }
    const seg = (k, cur) => ['', 3, 4, 5, 6, 7].map(n =>
      `<button class="tg-seg-btn ${(cur ?? '') === n ? 'tg-active' : ''}" data-k="${k}" data-v="${n}">${n === '' ? '自動' : n}</button>`).join('');
    const open = tool.classList.contains('open');
    const html = `<button class="tg-ht-btn" data-toggle="1" title="ホームの列数">${IC.grid}<span>列</span></button>
      <div class="tg-ht-panel">
        <div class="tg-ht-row"><span>動画</span><div class="tg-seg">${seg('homeCols', S.homeCols)}</div></div>
        <div class="tg-ht-row"><span>ショート</span><div class="tg-seg">${seg('homeShortCols', S.homeShortCols)}</div></div>
      </div>`;
    if (tool.dataset.html !== html) { tool.innerHTML = html; tool.dataset.html = html; }
    tool.classList.toggle('open', open);
  }

  // ---------- チャンネル/動画ページ：フォルダ追加ボタン ----------
  // ページ上のキー（@ハンドル等）→ 保存済みのチャンネルのキー。チャンネルIDで照合する
  const canon = new Map(); // ページのキー → { key, id }
  function canonOf(pageKey) {
    if (S.channels[pageKey]) return { key: pageKey, id: S.channels[pageKey].id };
    const c = canon.get(pageKey);
    if (c) {
      const hit = c.id && Object.values(S.channels).find(x => x.id === c.id);
      return { key: hit ? hit.key : pageKey, id: c.id };
    }
    return null;
  }
  const resolving = new Set();
  async function resolveCanon(pageKey) {
    if (canon.has(pageKey) || resolving.has(pageKey)) return;
    resolving.add(pageKey);
    let id = pageKey.startsWith('channel/') ? pageKey.slice(8) : null;
    try { if (!id) id = await YTAPI.resolveId(pageKey); } catch { /* 取れなければキーのまま */ }
    canon.set(pageKey, { id });
    resolving.delete(pageKey);
    renderFab();
    if (document.getElementById('tg-pop')) buildPopover();
  }

  function currentChannel() {
    const ch = rawChannel();
    if (!ch) return null;
    const c = canonOf(ch.key);
    if (!c) resolveCanon(ch.key);
    return { ...ch, pageKey: ch.key, key: c?.key || ch.key, id: c?.id || null, resolved: !!c };
  }

  function rawChannel() {
    if (isShortsPage()) {
      const box = document.querySelector('ytd-reel-video-renderer[is-active], ytd-shorts [is-active]') || document;
      const a = box.querySelector('a[href^="/@"], a[href^="/channel/"]');
      const key = a && TG.channelKey(a.getAttribute('href'));
      const name = (a?.textContent || '').trim().replace(/^@/, '') || key;
      const thumb = box.querySelector('img[src*="yt3."], yt-avatar-shape img')?.src || '';
      return key ? { key, name, thumb } : null;
    }
    if (isChannelPage()) {
      const key = TG.channelKey(location.pathname);
      const name =
        document.querySelector('#page-header h1, yt-dynamic-text-view-model h1, #channel-name #text')?.textContent?.trim() ||
        document.title.replace(/ - YouTube$/, '');
      const thumb = document.querySelector('#page-header yt-avatar-shape img, #avatar img')?.src || '';
      return key ? { key, name, thumb } : null;
    }
    if (isWatchPage()) {
      const a = document.querySelector('ytd-watch-metadata ytd-video-owner-renderer a[href], #owner ytd-channel-name a[href]');
      const key = a && TG.channelKey(a.getAttribute('href'));
      const name = document.querySelector('ytd-watch-metadata ytd-channel-name a, #owner ytd-channel-name a')?.textContent?.trim();
      const thumb = document.querySelector('ytd-watch-metadata #owner img, #owner #avatar img')?.src || '';
      return key ? { key, name: name || key, thumb } : null;
    }
    return null;
  }

  function renderFab() {
    renderLaterFab();
    let fab = document.getElementById('tg-fab');
    if (!isChannelPage() && !isWatchPage() && !isShortsPage()) {
      fab?.remove();
      document.getElementById('tg-pop')?.remove();
      return;
    }
    if (!fab) {
      fab = document.createElement('button');
      fab.id = 'tg-fab';
      fab.title = 'このチャンネルをフォルダに追加';
      fab.addEventListener('click', togglePopover);
      document.body.appendChild(fab);
    }
    const ch = currentChannel();
    const count = ch ? S.folders.filter(f => f.keys.includes(ch.key)).length : 0;
    const label = count ? `📁 ${count}` : '📁＋';
    if (fab.textContent !== label) fab.textContent = label;
    fab.classList.toggle('tg-in', count > 0);
  }

  function togglePopover() {
    const pop = document.getElementById('tg-pop');
    if (pop) return pop.remove();
    buildPopover();
  }

  function buildPopover() {
    const ch = currentChannel();
    let pop = document.getElementById('tg-pop');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'tg-pop';
      ['keydown', 'keyup', 'keypress'].forEach(t => pop.addEventListener(t, e => e.stopPropagation()));
      document.body.appendChild(pop);
    }
    pop.textContent = '';
    const title = document.createElement('div');
    title.className = 'tg-pop-title';
    title.textContent = ch ? ch.name : 'チャンネルを取得できませんでした';
    pop.appendChild(title);
    if (!ch) return;
    if (!ch.resolved) {
      const w = document.createElement('div');
      w.className = 'tg-pop-wait';
      w.textContent = 'チャンネルを確認中…';
      pop.appendChild(w);
      return;
    }

    TG.tree(S.folders).forEach(({ f, depth }) => {
      const row = document.createElement('label');
      row.className = 'tg-pop-row';
      row.style.paddingLeft = (2 + depth * 16) + 'px';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = f.keys.includes(ch.key);
      cb.addEventListener('change', () => toggleMembership(f.id, ch, cb.checked));
      const dot = document.createElement('span');
      dot.className = 'tg-dot';
      dot.style.background = f.color;
      const name = document.createElement('span');
      name.textContent = f.name;
      row.append(cb, dot, name);
      pop.appendChild(row);
    });

    const form = document.createElement('form');
    form.className = 'tg-pop-new';
    const input = document.createElement('input');
    input.placeholder = '新しいフォルダ名';
    const add = document.createElement('button');
    add.textContent = '作成';
    form.append(input, add);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const n = input.value.trim();
      if (!n) return;
      input.value = '';
      await TG.update(d => {
        const f = TG.newFolder(n, d.folders.length);
        f.keys.push(ch.key);
        d.folders.push(f);
        ensureChannel(d, ch);
      });
    });
    pop.appendChild(form);
  }

  function ensureChannel(d, ch) {
    const c = d.channels[ch.key];
    if (c) { if (!c.id && ch.id) c.id = ch.id; return; }
    d.channels[ch.key] = { key: ch.key, id: ch.id || null, name: ch.name, thumb: ch.thumb, hidden: false };
  }

  function toggleMembership(folderId, ch, on) {
    return TG.update(d => {
      const f = d.folders.find(x => x.id === folderId);
      if (!f) return false;
      f.keys = f.keys.filter(k => k !== ch.key && k !== ch.pageKey);
      if (on) f.keys.push(ch.key);
      ensureChannel(d, ch);
    });
  }

  // ---------- ポップアップからの「フォルダ設定を開く」 ----------
  async function checkOpenRequest() {
    if (document.visibilityState !== 'visible') return;
    const { openManager } = await chrome.storage.local.get('openManager');
    if (!openManager) return;
    await chrome.storage.local.remove('openManager');
    TGManager.open();
  }

  // ---------- 画面内の通知（右下からスライド） ----------
  const TOAST_MS = { high: 0, normal: 12000, low: 6000 }; // 0＝閉じるまで残す
  function showToasts(items) {
    let box = document.getElementById('tg-toasts');
    if (!box) { box = document.createElement('div'); box.id = 'tg-toasts'; document.body.appendChild(box); }
    const KIND = { live: '🔴 配信中', upcoming: '⏰ 配信予定', kw: '⚡ キーワード', new: '新着' };
    items.slice(0, 6).forEach((it, i) => setTimeout(() => {
      const t = document.createElement('div');
      t.className = `tg-toast tg-lv-${it.level || 'normal'}`;
      const when = it.kind === 'upcoming' && it.at ? ` ${new Date(it.at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}〜` : '';
      t.innerHTML = `<img src="https://i.ytimg.com/vi/${esc(it.v)}/mqdefault.jpg" alt="">
        <div class="tg-t-body"><div class="tg-t-head"><span class="tg-t-kind">${KIND[it.kind] || '新着'}${esc(when)}</span><span class="tg-t-folder">${esc(it.folder || '')}</span></div>
          <div class="tg-t-title">${esc(it.title || '')}</div><div class="tg-t-ch">${esc(it.ch || '')}</div></div>
        <button class="tg-t-x" title="閉じる">✕</button>`;
      const close = () => { t.classList.remove('in'); setTimeout(() => t.remove(), 350); };
      t.querySelector('.tg-t-x').addEventListener('click', e => { e.stopPropagation(); close(); });
      t.addEventListener('click', () => { close(); location.assign('/watch?v=' + encodeURIComponent(it.v)); });
      box.appendChild(t);
      requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('in')));
      const ms = TOAST_MS[it.level || 'normal'];
      if (ms) { let tm = setTimeout(close, ms); t.addEventListener('mouseenter', () => clearTimeout(tm)); t.addEventListener('mouseleave', () => { tm = setTimeout(close, 4000); }); }
    }, i * 250));
    if (items.length > 6) setTimeout(() => showToasts([{ v: items[6].v, title: `ほか ${items.length - 6} 本の新着があります`, ch: '', folder: '', level: 'low', kind: 'new' }]), 1700);
  }

  // ---------- イベント ----------
  chrome.storage.onChanged.addListener(async changes => {
    if (changes.openManager?.newValue) checkOpenRequest();
    if (changes.watched) TGFeed.setWatched(changes.watched.newValue);
    if (changes.later) { TGFeed.setLater(changes.later.newValue); setLaterSet(changes.later.newValue || []); }
    if (changes.recent || changes.folderSeen || changes.watched || changes.later) refreshCounts();
    if (changes.recent && isSubsFeed() && S.feedType === 'new') setTimeout(() => TGFeed.refresh(S), 300);
    if (changes.queue) TGX.syncQueue();
    if (changes.hideWatched) { S.hideWatched = !!changes.hideWatched.newValue; TGFeed.setHideWatched(S.hideWatched); }
    if (changes.cols) {
      S.cols = changes.cols.newValue;
      TGFeed.setCols(S.cols);
      const bar = document.getElementById('tg-bar');
      if (bar) buildBar(bar);
    }
    if (changes.homeCols || changes.homeShortCols) {
      const d = await TG.load();
      S.homeCols = d.homeCols;
      S.homeShortCols = d.homeShortCols;
      applyHomeCols();
    }
    if (changes.channels || changes.folders || changes.activeGroup || changes.feedType) {
      reload().then(() => { if (document.getElementById('tg-pop')) buildPopover(); });
    } else if (changes.meta) {
      S.meta = changes.meta.newValue || {};
    }
  });

  // ---------- 再生した動画を記録（視聴済み表示用） ----------
  let wTimer = null, wSaveT = null, wPending = {};
  function currentVid() {
    if (location.pathname === '/watch') return new URLSearchParams(location.search).get('v');
    return location.pathname.match(/^\/shorts\/([\w-]{11})/)?.[1] || null;
  }
  // 保存はまとめて20秒に1回（＋ページを離れるとき）。5%未満の変化は保存しない（90%到達だけはすぐ）
  const wSaved = {};
  function recordWatch(id, p) {
    if (!id) return;
    const prev = Math.max(wPending[id] || 0, wSaved[id] || 0);
    if (p < prev + 5 && !(p >= 90 && prev < 90) && prev) return;
    wPending[id] = Math.max(wPending[id] || 0, p);
    if (p >= 90 && prev < 90) { clearTimeout(wSaveT); wSaveT = setTimeout(flushWatch, 500); return; }
    if (!wSaveT) wSaveT = setTimeout(flushWatch, 20000);
  }
  async function flushWatch() {
    clearTimeout(wSaveT); wSaveT = null;
    {
      const add = wPending; wPending = {};
      if (!Object.keys(add).length) return;
      Object.assign(wSaved, add);
      const { watched = {} } = await chrome.storage.local.get('watched');
      let changed = false;
      for (const [k, v] of Object.entries(add)) {
        const np = Math.max(watched[k]?.p || 0, v);
        if (watched[k]?.p !== np) { watched[k] = { p: np, at: Date.now() }; changed = true; }
      }
      if (!changed) return;
      const keys = Object.keys(watched);
      if (keys.length > 6000) keys.sort((a, b) => watched[a].at - watched[b].at).slice(0, keys.length - 6000).forEach(k => delete watched[k]);
      await chrome.storage.local.set({ watched });
    }
  }
  // ---------- 視聴記録（視聴時間・再生数・高評価数・自分の評価） ----------
  //   history: { 動画ID: { t, ch, k, d:長さ秒, first, last, sec:見た秒数, views, likes, rate:'like'|'dislike'|'' , short } }
  //   daily:   { 'YYYY-MM-DD': 見た秒数 }
  let hPending = {}, hDaily = {}, hSaveT = null;
  function readWatchMeta(id) {
    const isShort = location.pathname.startsWith('/shorts/');
    const meta = document.querySelector('ytd-watch-metadata');
    const title = (isShort ? document.querySelector('ytd-reel-video-renderer[is-active] h2, yt-shorts-video-title-view-model h2') : meta?.querySelector('h1'))?.textContent?.trim()
      || document.title.replace(/ - YouTube$/, '');
    const ch = isShort ? null : currentChannel();
    const shortCh = isShort ? document.querySelector('ytd-reel-video-renderer[is-active] ytd-channel-name a, yt-reel-channel-bar-view-model a') : null;
    const info = meta?.querySelector('#info, ytd-watch-info-text')?.textContent || '';
    const views = TG.parseCount(info.match(/([\d.,]+\s*[万億]?)\s*回視聴/)?.[1] || info.match(/([\d.,]+\s*[KMB]?)\s*views/i)?.[1] || '');
    const likeBtn = (isShort ? document.querySelector('ytd-reel-video-renderer[is-active]') : meta)?.querySelector('like-button-view-model button, #segmented-like-button button, ytd-toggle-button-renderer button');
    const disBtn = (isShort ? document.querySelector('ytd-reel-video-renderer[is-active]') : meta)?.querySelector('dislike-button-view-model button, #segmented-dislike-button button');
    const likes = TG.parseCount(likeBtn?.textContent?.trim() || likeBtn?.getAttribute('aria-label')?.match(/([\d.,]+\s*[万億KMB]?)/i)?.[1] || '');
    const rate = likeBtn?.getAttribute('aria-pressed') === 'true' ? 'like' : disBtn?.getAttribute('aria-pressed') === 'true' ? 'dislike' : '';
    const sk = shortCh ? TG.channelKey(shortCh.getAttribute('href')) : null;
    return { t: title, ch: ch?.name || shortCh?.textContent?.trim() || '', k: ch?.key || sk || '', views, likes, rate, short: isShort };
  }
  let metaCache = { id: null, at: 0, m: null };
  function recordHistory(id, addSec, v) {
    if (metaCache.id !== id || Date.now() - metaCache.at > 30000) metaCache = { id, at: Date.now(), m: readWatchMeta(id) };
    const m = metaCache.m;
    const e = (hPending[id] ||= { add: 0 });
    e.add += addSec;
    Object.assign(e, Object.fromEntries(Object.entries(m).filter(([, x]) => x !== '' && x !== 0 && x != null)));
    e.rate = m.rate; // 評価の取り消しも反映
    if (v?.duration > 0 && isFinite(v.duration)) e.d = Math.round(v.duration);
    const day = TG.dayKey();
    hDaily[day] = (hDaily[day] || 0) + addSec;
    if (!hSaveT) hSaveT = setTimeout(flushHistory, 30000);
  }
  async function flushHistory() {
    clearTimeout(hSaveT); hSaveT = null;
    const add = hPending, daily = hDaily;
    hPending = {}; hDaily = {};
    if (!Object.keys(add).length && !Object.keys(daily).length) return;
    const st = await chrome.storage.local.get(['history', 'daily']);
    const history = st.history || {}, dd = st.daily || {};
    const now = Date.now();
    for (const [id, e] of Object.entries(add)) {
      const h = (history[id] ||= { first: now, sec: 0 });
      h.sec = (h.sec || 0) + e.add;
      h.last = now;
      for (const k of ['t', 'ch', 'k', 'd', 'views', 'likes', 'short']) if (e[k] !== undefined) h[k] = e[k];
      h.rate = e.rate || '';
    }
    for (const [d, sec] of Object.entries(daily)) dd[d] = (dd[d] || 0) + sec;
    const ids = Object.keys(history);
    if (ids.length > 5000) ids.sort((a, b) => history[a].last - history[b].last).slice(0, ids.length - 5000).forEach(k => delete history[k]);
    await chrome.storage.local.set({ history, daily: dd });
  }

  function trackWatch() {
    clearInterval(wTimer);
    const id = currentVid();
    if (!id) return;
    recordWatch(id, 1); // 開いただけでも「途中」として記録
    let lastT = performance.now();
    wTimer = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(10, (now - lastT) / 1000);
      lastT = now;
      if (currentVid() !== id) { clearInterval(wTimer); flushHistory(); flushWatch(); return; }
      const v = document.querySelector('#movie_player video, video');
      if (v && v.duration > 0 && isFinite(v.duration) && !v.paused) {
        recordWatch(id, Math.min(100, Math.round((v.currentTime / v.duration) * 100)));
        if (!document.querySelector('#movie_player.ad-showing')) recordHistory(id, Math.round(dt), v); // 広告の時間は数えない
      }
    }, 5000);
  }
  window.addEventListener('pagehide', () => { flushHistory(); flushWatch(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { flushHistory(); flushWatch(); } });
  window.addEventListener('pagehide', () => {
    const id = currentVid();
    const v = document.querySelector('#movie_player video, video');
    if (id && v?.duration > 0 && isFinite(v.duration)) recordWatch(id, Math.round((v.currentTime / v.duration) * 100));
  });

  // ショートは上下に送ってもページ移動の合図が出ないことがあるので、URLの変化を見る
  let lastHref = location.href;
  setInterval(() => {
    if (location.href === lastHref || document.hidden) return;
    lastHref = location.href;
    if (isShortsPage()) { document.getElementById('tg-pop')?.remove(); renderFab(); setTimeout(renderFab, 800); }
  }, 700);
  document.addEventListener('yt-navigate-finish', () => {
    trackWatch();
    TGX.syncQueue();
    document.getElementById('tg-pop')?.remove();
    setTimeout(() => { renderGuide(true); renderSubsPage(true); renderFab(); renderHomeTool(); markVideos(); }, 200);
  });

  document.addEventListener('click', e => {
    const pop = document.getElementById('tg-pop');
    if (pop && !pop.contains(e.target) && e.target.id !== 'tg-fab') pop.remove();
  });

  document.addEventListener('visibilitychange', checkOpenRequest);

  // ---------- 画面の変化への追従（軽量化） ----------
  // ・動画プレーヤーや拡張機能自身の部品の中の変化は無視（再生時間の表示などで毎秒変わるため）
  // ・まとめて0.5秒に1回だけ処理（間引き）。タブが裏にあるときは何もしない
  const IGNORE = '#movie_player, .html5-video-player, #tg-feed, #tg-guide, #tg-bar, #tg-queue, #tg-pop, #tg-manager, #tg-hometool, .tg-c-panel, ytd-live-chat-frame, #chat, tp-yt-paper-tooltip, #ticker';
  function relevant(muts) {
    for (const m of muts) {
      const t = m.target;
      if (t.nodeType !== 1) continue;
      if (t.closest(IGNORE)) continue;
      return true;
    }
    return false;
  }
  function runAll() {
    tick = null;
    if (document.hidden) { pendingWhileHidden = true; return; }
    renderGuide(false);
    renderSubsPage(false);
    renderFab();
    markVideos();
    layoutHome();
  }
  let pendingWhileHidden = false;
  function schedule(delay = 500) {
    if (tick) return;
    tick = setTimeout(runAll, delay);
  }
  new MutationObserver(muts => { if (relevant(muts)) schedule(); })
    .observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && pendingWhileHidden) { pendingWhileHidden = false; schedule(50); } });

  reload().then(checkOpenRequest);
  trackWatch();
  TGX.syncQueue();
  try { chrome.runtime.sendMessage({ type: 'tg-hello' }).catch(() => {}); } catch { /* 拡張機能の再読み込み直後 */ }
  // 新着の確認（15分以上たっていれば）。拡張機能のバックグラウンドからの依頼にも応える
  setTimeout(() => TGX.check().catch(() => {}), 4000);
  chrome.runtime.onMessage.addListener((m, _s, reply) => {
    if (m?.type === 'tg-toast') { showToasts(m.items || []); reply({ ok: true }); return; }
    if (m?.type === 'tg-hist') {
      TGX.importHistory({ force: true }).then(r => reply({ ok: true, ...r }), e => reply({ ok: false, error: e.message }));
      return true;
    }
    if (m?.type !== 'tg-check') return;
    TGX.check({ force: !!m.force }).then(r => reply({ ok: true, ...r }), e => reply({ ok: false, error: e.message }));
    return true;
  });
  // Google Drive 自動同期：開いたときに新しい方へ合わせる
  try { chrome.runtime.sendMessage({ type: 'drive', op: 'autoPull' }).catch(() => {}); } catch { /* 拡張機能の再読み込み直後など */ }
})();

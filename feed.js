// 登録チャンネルの独自フィード（動画 / ライブ・配信 / ショート）
// 各チャンネルの「動画 / ライブ / ショート」タブをYouTube内部APIで並列取得し、揃ってから一括で描画する
// （RSSが使えれば予備として使う）
const TGFeed = (() => {
  const TYPES = {
    new: { label: '新着動画', short: '新着', pl: '' },
    video: { label: '動画', pl: 'UULF' },
    live: { label: 'ライブ・配信', pl: 'UULV' },
    short: { label: 'ショート', pl: 'UUSH' },
    rec: { label: 'おすすめ', short: 'おすすめ', pl: '' },
    later: { label: '後で見る', short: '後で見る', pl: '' }
  };
  let laterSet = new Set();
  chrome.storage.local.get('later').then(({ later = [] }) => { laterSet = new Set(later.map(x => x.v)); });
  let folderMap = new Map();
  // ---------- 視聴済み ----------
  const WATCHED = 90; // これ以上見たら「視聴済み」
  let watched = {};   // このPCで再生した記録 { 動画ID: { p: 割合, at } }
  chrome.storage.local.get('watched').then(({ watched: w }) => { watched = w || {}; markWatched(); });
  const watchedOf = it => Math.max(+it.w || 0, watched[it.v]?.p || 0);
  const wLabel = p => (p >= WATCHED ? '視聴済み' : p > 0 ? `途中 ${Math.round(p)}%` : '');
  // 表示中のカードに視聴状態を反映（一覧を作り直さずに更新）
  function markWatched() {
    if (!el) return;
    el.querySelectorAll('.tg-card[data-v]').forEach(c => {
      const p = Math.max(+c.dataset.w || 0, watched[c.dataset.v]?.p || 0);
      c.classList.toggle('tg-watched', p >= WATCHED);
      c.classList.toggle('tg-partial', p > 0 && p < WATCHED);
      c.style.setProperty('--tg-wpn', p / 100);
      const b = c.querySelector('.tg-wbadge');
      if (b && b.textContent !== wLabel(p)) b.textContent = wLabel(p);
    });
    fillIfHidden();
  }
  function setWatched(w) { watched = w || {}; markWatched(); }
  function setHideWatched(on) {
    if (!el) return;
    el.classList.toggle('tg-hidewatched', !!on);
    fillIfHidden();
  }
  // 視聴済みを隠して画面が埋まらないときは続きを表示
  function fillIfHidden() {
    if (!el?.classList.contains('tg-hidewatched')) return;
    requestAnimationFrame(() => {
      const r = el.querySelector('.tg-more')?.getBoundingClientRect();
      if (r && r.top < innerHeight + 300) more();
    });
  }
  // おすすめ：動画とショートで別々に持つ
  const newRec = (kind, fav = new Set()) => ({ kind, token: null, at: 0, items: [], loading: false, fav });
  const recs = { video: newRec('video'), short: newRec('short') };
  let rec = recs.video;
  // ショートには投稿者が付いていないので、動画IDから調べる（oEmbed → YouTubeの動画情報）
  const owners = new Map();
  async function ownerOf(v, signal) {
    if (owners.has(v)) return owners.get(v);
    let o = null;
    try {
      const r = await fetch(`/oembed?url=${encodeURIComponent('https://www.youtube.com/shorts/' + v)}&format=json`, { credentials: 'omit', signal });
      const j = r.ok ? await r.json() : null;
      if (j?.author_url) o = { k: TG.channelKey(j.author_url), n: j.author_name || '', t: j.title || '' };
    } catch (e) { if (signal?.aborted) throw e; }
    if (!o) o = await YTAPI.videoOwner(v).catch(() => null);
    owners.set(v, o);
    return o;
  }
  // 動画・ライブ・ショートは30チャンネルずつ取得し、表示も30件ずつ
  const BATCH = 30, PAGE = 30;
  const BATCHED = t => t !== 'rec' && t !== 'later' && t !== 'new';
  let batch = { chs: [], loaded: 0, loading: false };
  const CACHE = 'feedCache4';
  const TTL = 10 * 60e3;
  const esc = TG.esc;
  const mem = new Map();
  let loaded = false, run = 0, ctl = null, saveT = null;
  let el = null, items = [], shown = 0, curType = 'video', io = null;

  // ---------- キャッシュ ----------
  async function loadCache() {
    if (loaded) return;
    const got = await chrome.storage.local.get(CACHE);
    for (const [k, v] of Object.entries(got[CACHE] || {})) mem.set(k, v);
    chrome.storage.local.remove(['feedCache', 'feedCache3']); // 旧キャッシュを削除
    loaded = true;
  }
  function saveCache() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      const o = {}, cut = Date.now() - 3 * 864e5;
      for (const [k, v] of mem) if (v.at > cut) o[k] = v;
      chrome.storage.local.set({ [CACHE]: o });
    }, 1500);
  }

  async function fetchRss(id, type, signal) {
    const r = await fetch(`/feeds/videos.xml?playlist_id=${TYPES[type].pl}${id.slice(2)}`, { credentials: 'omit', signal });
    if (!r.ok) return [];
    const doc = new DOMParser().parseFromString(await r.text(), 'application/xml');
    return [...doc.getElementsByTagName('entry')].map(e => ({
      v: e.getElementsByTagName('yt:videoId')[0]?.textContent,
      t: e.getElementsByTagName('title')[0]?.textContent || '',
      p: Date.parse(e.getElementsByTagName('published')[0]?.textContent || '') || 0,
      n: +(e.getElementsByTagName('media:statistics')[0]?.getAttribute('views') || 0)
    })).filter(x => x.v);
  }

  async function fetchList(id, type, signal) {
    let list = [];
    try {
      list = (await YTAPI.channelTab(id, type, signal)).slice(0, 30)
        .map(x => ({ v: x.v, t: x.t, p: x.p, n: x.n, th: x.thumb, d: x.dur || 0, live: x.live, up: x.upcoming, i: x.i, w: x.w || 0 }));
    } catch (e) {
      if (signal.aborted) throw e;
    }
    if (!list.length) {
      try { list = await fetchRss(id, type, signal); } catch { /* RSSも不可 */ }
    }
    return list;
  }

  // ---------- 集中モード ----------
  //   FX: { active, until, folderLocked(id), channelLocked(key, id) }（content.js が設定）
  let FX = { active: false };
  function setFocus(fx) { FX = fx || { active: false }; }
  const lockedCh = (key, id) => FX.active && FX.channelLocked(key, id);
  function lockScreen(name) {
    const until = FX.until ? new Date(FX.until).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '';
    items = []; shown = 0;
    el.classList.remove('tg-loading');
    el.querySelector('.tg-grid').classList.remove('tg-split');
    el.querySelector('.tg-grid').innerHTML = `<div class="tg-empty tg-lockscreen"><div class="tg-lock-ic">🔒</div>
      <div class="tg-lock-t">集中モード中です</div>
      <div>「${esc(name)}」は ${until ? until + ' まで' : '今は'} 見られません。</div>
      <div class="tg-lock-btns"><button class="tg-chip tg-ghost" data-tg-unlock="1">少しだけ解除する…</button><button class="tg-chip tg-ghost" data-tg-focuscfg="1">集中モードの設定</button></div></div>`;
    status('');
  }

  // ---------- 対象チャンネル ----------
  function targets(S, cap = !BATCHED(S.feedType)) {
    const all = Object.values(S.channels).filter(c => !c.hidden && !lockedCh(c.key, c.id));
    let list;
    if (S.activeGroup === '__unsorted') {
      const inAny = new Set(S.folders.flatMap(f => f.keys));
      list = all.filter(c => !inAny.has(c.key));
    } else if (S.activeGroup && S.folders.some(f => f.id === S.activeGroup)) {
      const ks = TG.folderKeys(S.folders, S.activeGroup);
      list = all.filter(c => ks.has(c.key));
    } else {
      list = all;
    }
    // 大量のときは最近投稿のあるチャンネルに絞る（最大400）
    if (list.length > 150) {
      const cut = Date.now() - 60 * 864e5;
      list = list
        .filter(c => { const m = S.meta[c.key]; return !m?.at || (m.last && m.last > cut); })
        .sort((a, b) => (S.meta[b.key]?.last || 0) - (S.meta[a.key]?.last || 0))
        .slice(0, cap ? 400 : Infinity);
    }
    if (!cap) list = [...list].sort((a, b) => (S.meta[b.key]?.last || 0) - (S.meta[a.key]?.last || 0)); // 最近投稿したチャンネルから
    return list;
  }

  function signature(S) {
    if (FX.active && S.activeGroup && !['rec', 'later', 'new'].includes(S.feedType) && FX.folderLocked(S.activeGroup)) return 'locked:' + S.activeGroup;
    if (S.feedType === 'later') return 'later:' + Date.now(); // 毎回作り直す（カテゴリの切り替えも含む）
    if (S.feedType === 'new') return JSON.stringify(['new', FX.active, S.newOff, S.folders.map(f => [f.id, f.keys.length, f.parent]), Object.values(S.channels).filter(c => c.hidden).length]);
    if (S.feedType === 'rec') return JSON.stringify(['rec', S.recMode, S.recKind, S.recMode === 'search' ? TG.searchQuery(S.folders, S.sFolder, S.sText) : '', favSetOf(S).size, S.folders.map(f => [f.name, f.color, f.keys.length])]);
    return JSON.stringify([S.activeGroup, S.feedType, targets(S).map(c => c.key), S.folders.map(f => [f.name, f.color])]);
  }

  function collect(chs, type) {
    const out = [];
    const now = Date.now();
    chs.forEach((c, ci) => {
      const e = c.id && mem.get(type + ':' + c.id);
      // 日付のないもの（ショート）は各チャンネルの新しい順に交互に並べる
      if (e) e.items.forEach((it, i) => out.push({ ...it, ch: c, s: it.p || now - (i + 1) * 864e5 - ci }));
    });
    return out.sort((a, b) => b.s - a.s);
  }

  // ---------- 描画 ----------
  function mount(container) {
    el = container;
    if (el.dataset.ready) return;
    el.dataset.ready = '1';
    el.innerHTML = '<div class="tg-feed-status"></div><div class="tg-grid"></div><div class="tg-more"></div>';
    // ショートの縦長サムネが無いときは通常サムネに切り替え
    el.addEventListener('error', e => {
      const img = e.target;
      if (img.tagName === 'IMG' && img.dataset.fb && img.src !== img.dataset.fb) img.src = img.dataset.fb;
    }, true);
    // サムネが無いとYouTubeは灰色の「…」画像(120x90)を返すので、通常サムネに差し替える
    el.addEventListener('load', e => {
      const img = e.target;
      if (img.tagName === 'IMG' && img.naturalWidth <= 120 && img.naturalHeight <= 90 && img.dataset.fb && img.src !== img.dataset.fb) {
        img.src = img.dataset.fb;
      }
    }, true);
    el.addEventListener('click', async e => {
      const cm = e.target.closest('[data-cmenu]');
      if (cm) { e.preventDefault(); e.stopPropagation(); return openCardMenu(cm); }
      // 後で見る：カードを押したら、その一覧の続きを連続再生
      const cardEl = e.target.closest('.tg-card');
      if (cardEl && curType === 'later' && !e.target.closest('button') && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
        const sec = cardEl.closest('.tg-sec');
        const list = laterSecItems(sec?.dataset.sec);
        const i = list.findIndex(x => x.v === cardEl.dataset.v);
        if (i >= 0 && !list[i].short) {
          e.preventDefault();
          const title = sec?.dataset.sec === 'tg' ? '後で見る' : sec?.querySelector('.tg-sec-h')?.textContent.replace(/[▸▾]/g, '').trim().split('\n')[0] || '後で見る';
          return TGX.startQueue(list.slice(i).filter(x => !x.short), title.slice(0, 40), { pick: true });
        }
      }
      const rm = e.target.closest('[data-wlrm]');
      if (rm) { e.preventDefault(); e.stopPropagation(); return removeWl(rm); }
      const b = e.target.closest('[data-later]');
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      const it = items.find(x => x.v === b.dataset.later && !x.wlSrc);
      if (!it) return;
      const added = await TGX.toggleLater(it);
      if (curType === 'later' && !added) {
        b.closest('.tg-card')?.remove();
        items = items.filter(x => !(x.v === it.v && !x.wlSrc));
        shown = Math.min(shown, items.length);
        const small = el.querySelector('.tg-sec .tg-sec-h small');
        if (small) small.textContent = `${items.filter(x => !x.wlSrc).length} 本・追加した順`;
      }
    });
    io = new IntersectionObserver(ents => { if (ents.some(x => x.isIntersecting)) more(); }, { rootMargin: '300px' });
    io.observe(el.querySelector('.tg-more'));
  }

  function status(t) {
    if (el) el.querySelector('.tg-feed-status').textContent = t;
  }

  const fmtDur = sec => { sec = Math.round(sec); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), x = String(sec % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };
  function card(it) {
    const short = curType === 'short' || (curType === 'rec' && !!it.short);
    const shortUrl = short || (curType === 'later' && it.short);
    const url = shortUrl ? `/shorts/${it.v}` : `/watch?v=${it.v}${it.list ? '&list=' + encodeURIComponent(it.list) : ''}`;
    const hq = `https://i.ytimg.com/vi/${encodeURIComponent(it.v)}/hqdefault.jpg`;
    const src = /^https:\/\/i\d?\.ytimg\.com\//.test(it.th || '') ? it.th : short ? `https://i.ytimg.com/vi/${encodeURIComponent(it.v)}/oardefault.jpg` : hq;
    const now = Date.now();
    let badge = '';
    if (it.live) badge = '<span class="tg-badge tg-live">● ライブ配信中</span>';
    else if (it.up && it.up > now) badge = `<span class="tg-badge tg-up">配信予定 ${new Date(it.up).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>`;
    else if (it.p && now - it.p < 2 * 864e5) badge = '<span class="tg-badge">新着</span>';
    const when = it.live ? '配信中' : it.up && it.up > now ? '配信予定' : it.p ? TG.rel(it.p) : '';
    const tags = (folderMap.get(it.ch.key) || []).map(f => `<span class="tg-ftag" style="--c:${esc(f.color)}">${esc(f.name)}</span>`).join('');
    const chLine = `<div class="tg-sub tg-chline"><span class="tg-chname">${esc(it.ch.name)}</span>${tags}${!short && when ? `<span class="tg-when"> • ${when}</span>` : ''}</div>`;
    const sub = short
      ? `<div class="tg-sub">${esc(TG.views(it.n))}</div>`
      : `${chLine}${it.n ? `<div class="tg-sub">${esc(TG.views(it.n))}</div>` : ''}`;
    const wp = watchedOf(it);
    const wcls = wp >= WATCHED ? ' tg-watched' : wp > 0 ? ' tg-partial' : '';
    return `<a class="tg-card ${it.ch.unsub ? 'tg-nofav' : 'tg-fav'}${wcls}" href="${url}" title="${esc(it.t)}" data-v="${esc(it.v)}" data-w="${it.w || 0}" style="--tg-wpn:${wp / 100}">
      <div class="tg-thumb"><img src="${esc(src)}" data-fb="${hq}" alt="" ${shown < 30 ? '' : 'loading="lazy"'} decoding="async" referrerpolicy="no-referrer">
        ${badge}${it.d && !it.live && !(it.up > now) ? `<span class="tg-dur">${fmtDur(it.d)}</span>` : ''}<span class="tg-wbadge">${wLabel(wp)}</span><span class="tg-wbar"></span>
        ${it.wlSrc ? `<button class="tg-later tg-wlrm" data-wlrm="${esc(it.v)}" data-pl="${esc(it.pl || 'WL')}" title="YouTubeの${it.pl && it.pl !== 'WL' ? '再生リスト' : '「後で見る」'}から削除">✕</button>`
          : `<button class="tg-later ${laterSet.has(it.v) ? 'on' : ''}" data-later="${esc(it.v)}" title="${laterSet.has(it.v) ? '後で見るから外す' : '後で見るに追加'}">${laterSet.has(it.v) ? '✓' : '🕒'}</button>`}</div>
      ${curType === 'later' ? `<div class="tg-title-row"><div class="tg-title">${esc(it.t)}</div><button class="tg-cmenu" data-cmenu="${esc(it.v)}" data-pl="${esc(it.wlSrc ? it.pl || 'WL' : '')}" title="メニュー">⋮</button></div>` : `<div class="tg-title">${esc(it.t)}</div>`}
      ${short ? chLine : ''}${sub}</a>`;
  }

  // ---------- 絞り込み検索（表示中の一覧の中から。タイトル・チャンネル名、スペース区切りで全部を含む） ----------
  let query = '';
  const norm = t => String(t || '').normalize('NFKC').toLowerCase();
  const matchQ = it => { if (!query) return true; const s = norm(it.t + ' ' + (it.ch?.name || '')); return query.split(/\s+/).every(w => s.includes(w)); };
  const visible = () => (query ? items.filter(matchQ) : items);
  function setQuery(q) {
    query = norm(q).trim();
    if (!el) return;
    const g = el.querySelector('.tg-grid');
    if (g.classList.contains('tg-split')) { // 後で見る（上下2段）はカードの表示／非表示で
      g.querySelectorAll('.tg-card').forEach(c => { const it = items.find(x => x.v === c.dataset.v); c.classList.toggle('tg-qhide', !!it && !matchQ(it)); });
      return;
    }
    if (g.querySelector('.tg-skel')) return;
    g.innerHTML = '';
    shown = 0;
    more();
    qStatus();
  }
  function qStatus() {
    if (!query || !el) return;
    const n = visible().length;
    const rest = BATCHED(curType) && batch.loaded < batch.chs.length ? '（下へスクロールすると残りのチャンネルからも探します）' : curType === 'rec' && recHasMore() ? '（下へスクロールで続きからも探します）' : '';
    status(`「${query}」で絞り込み：${n} 件${rest}`);
    if (!n && !rest) el.querySelector('.tg-grid').innerHTML = '<div class="tg-empty">見つかりませんでした。</div>';
  }

  function more(noLoad) {
    if (!el) return;
    const vis = visible();
    if (shown >= vis.length) {
      if (noLoad) return;
      if (curType === 'new' && !nx.end && !nx.loading && items.length) loadNewMore(run);
      if (curType === 'rec' && recHasMore() && !rec.loading) (rec.kind === 'search' ? loadSearch : loadRec)(run, false);
      if (BATCHED(curType) && batch.loaded < batch.chs.length && !batch.loading) loadBatch(run, false);
      return;
    }
    const n = BATCHED(curType) ? PAGE : Math.max(40, (+el.style.getPropertyValue('--tg-cols') || 4) * 10);
    if (shown === 0) lastDay = '';
    const html = vis.slice(shown, shown + n).map(it => {
      let h = '';
      if (curType === 'new') { // 日付が変わるところに見出し
        const d = dayLabel(it);
        if (d.key !== lastDay) { lastDay = d.key; h += `<div class="tg-dayhead"><span>${d.html}</span><i></i></div>`; }
      }
      h += card(it); shown++; return h;
    }).join('');
    el.querySelector('.tg-empty')?.remove();
    el.querySelector('.tg-grid').insertAdjacentHTML('beforeend', html);
    fillIfHidden();
    if (query) qStatus();
    // 一番下（読み込みの目印）がまだ見えていれば続ける（見えたままだと次の合図が来ないため）
    if (!noLoad) requestAnimationFrame(() => { const r = el?.querySelector('.tg-more')?.getBoundingClientRect(); if (r && r.top < innerHeight + 300) moreIfCan(); });
  }
  // 絞り込み中で画面が埋まらないときは、続きを読み込む
  function moreIfCan() {
    if (shown < visible().length) return more();
    if (curType === 'new' && !nx.end && !nx.loading) loadNewMore(run);
    if (curType === 'rec' && recHasMore() && !rec.loading) (rec.kind === 'search' ? loadSearch : loadRec)(run, false);
    if (BATCHED(curType) && batch.loaded < batch.chs.length && !batch.loading) loadBatch(run, false);
  }

  function paint(list, msg) {
    items = list;
    shown = 0;
    el.querySelector('.tg-grid').classList.remove('tg-split');
    el.querySelector('.tg-grid').innerHTML = '';
    el.classList.remove('tg-loading');
    status(msg);
    if (!list.length) {
      el.querySelector('.tg-grid').innerHTML = `<div class="tg-empty">${msg ? '' : `${TYPES[curType].label}はまだありません`}</div>`;
      return;
    }
    more();
  }

  function skeleton(done, total) {
    el.classList.add('tg-loading');
    status(`読み込み中… ${done} / ${total} チャンネル`);
    const g = el.querySelector('.tg-grid');
    if (!g.querySelector('.tg-skel')) {
      g.innerHTML = Array.from({ length: 15 }, () => '<div class="tg-card tg-skel"><div class="tg-thumb"></div><div class="tg-line"></div><div class="tg-line short"></div></div>').join('');
    }
  }

  // ---------- 新着動画：登録チャンネルの直近3日（15分ごとに取得している recent）をカテゴリで絞って表示 ----------
  function newFilter(S) {
    const off = new Set(S.newOff || []);
    const fmap = TG.folderMap(S.channels, S.folders);
    const hidden = new Set();
    for (const c of Object.values(S.channels)) if (c.hidden) { hidden.add(c.key); if (c.id) hidden.add('channel/' + c.id); }
    return x => {
      if (hidden.has(x.k) || (x.id && hidden.has('channel/' + x.id))) return false;
      if (lockedCh(x.k, x.id)) return false;
      const fs = fmap.get(x.k) || (x.id && fmap.get('channel/' + x.id)) || [];
      if (!fs.length) return !off.has('__unsorted');
      return fs.some(f => !off.has(TG.rootOf(S.folders, f.id)?.id || f.id));
    };
  }
  // 新着の続き（直近3日より前）：登録チャンネルのフィードを下へスクロールするたびに読み込む
  // 読み込んだ「続き」は覚えておき、新着の定期確認で一覧が作り直されても消さない（「更新」で捨てる）
  let nx = { token: null, started: false, loading: false, end: false, keep: null, extra: [] };
  const toNewItem = x => ({ v: x.v, t: x.t, p: x.p, n: 0, d: x.d || 0, live: x.live, up: x.up, w: x.w || 0, ch: { key: x.k || (x.id ? 'channel/' + x.id : ''), name: x.n, unsub: false } });
  async function loadNewMore(my) {
    if (nx.loading || nx.end) return;
    nx.loading = true;
    status('さらに前の新着を読み込み中…');
    let added = 0, pages = 0;
    try {
      const have = new Set(items.map(x => x.v));
      nx.extra.forEach(x => have.add(x.v));
      while (pages++ < 8 && added < 30) {
        const r = await YTAPI.subsPage(nx.started ? nx.token : null, ctl.signal);
        if (my !== run) return;
        nx.started = true;
        nx.token = r.token;
        const raw = r.items.filter(x => !have.has(x.v)).map(x => ({ v: x.v, t: x.t, p: x.p, d: x.dur || 0, k: x.chKey, id: x.chId, n: x.chName, w: x.w || 0, live: !!x.live }));
        raw.forEach(x => have.add(x.v));
        nx.extra.push(...raw);
        const list = raw.filter(nx.keep).map(toNewItem);
        items = items.concat(list).sort((a, b) => (b.up > Date.now()) - (a.up > Date.now()) || (b.p || 0) - (a.p || 0));
        added += list.length;
        if (!r.token) { nx.end = true; break; }
      }
    } catch (e) {
      if (my === run && !ctl.signal.aborted) status('続きを読み込めませんでした：' + e.message);
      nx.end = true;
    } finally { nx.loading = false; }
    if (my !== run) return;
    newStatus();
    // 並べ直したので、表示済みの位置から下を描き直す
    rerenderKeep(true);
  }
  function newStatus() {
    const days = new Set(items.filter(x => !(x.up > Date.now())).map(x => TG.dayKey(x.p)));
    status(`新着 ${items.length} 本（${days.size}日分）${nx.end ? '・これ以上はありません' : '・下へスクロールでさらに前の日へ'}`);
  }
  // 表示していた件数まで描き直す（スクロール位置がずれないように）
  function rerenderKeep(loaded) {
    const keepN = Math.max(shown, 1);
    const g = el.querySelector('.tg-grid');
    g.innerHTML = '';
    shown = 0;
    while (shown < keepN && shown < visible().length) { const before = shown; more(true); if (shown === before) break; }
    loaded ? afterLoad() : more();
  }
  // 読み込みが終わったら：新しく来た分を表示し、一番下がまだ見えているときだけ次を読む
  //   （すぐ more() すると、表示済みのときに次の読み込みを呼んで止まらなくなる）
  function afterLoad() {
    more(true);
    requestAnimationFrame(() => { const r = el?.querySelector('.tg-more')?.getBoundingClientRect(); if (r && r.top < innerHeight + 300) moreIfCan(); });
  }
  // 日付の見出し（新着動画）
  const W = '日月火水木金土';
  function dayLabel(it) {
    if (it.up && it.up > Date.now()) return { key: 'up', html: '配信予定' };
    const d = new Date(it.live ? Date.now() : it.p || Date.now());
    const key = TG.dayKey(d.getTime());
    const today = TG.dayKey(), yest = TG.dayKey(Date.now() - 864e5);
    return { key, html: `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${W[d.getDay()]}）${key === today ? '<small>今日</small>' : key === yest ? '<small>昨日</small>' : ''}` };
  }
  let lastDay = '';

  async function paintNew(S, my, force) {
    let { recent = [], lastCheckAt = 0 } = await chrome.storage.local.get(['recent', 'lastCheckAt']);
    if (force) nx = { token: null, started: false, loading: false, end: false, keep: null, extra: [] };
    const draw = () => {
      if (my !== run) return;
      const keep = newFilter(S);
      const prevShown = curType === 'new' && el.querySelector('.tg-grid .tg-card') ? shown : 0;
      nx.keep = keep;
      const seen = new Set();
      const list = recent.concat(nx.extra).filter(x => !seen.has(x.v) && seen.add(x.v)).filter(keep)
        .sort((a, b) => (b.up > Date.now()) - (a.up > Date.now()) || (b.p || 0) - (a.p || 0)).map(toNewItem);
      paint(list, '');
      if (prevShown > shown) { shown = prevShown; rerenderKeep(); }
      if (!list.length) el.querySelector('.tg-grid').innerHTML = `<div class="tg-empty">${recent.length ? '選んだカテゴリの新着はありません。上のカテゴリをオンにしてください。' : '新着を確認しています…'}</div>`;
      else newStatus();
    };
    draw();
    if (!force && Date.now() - lastCheckAt < 5 * 60e3 && recent.length) return;
    status('新着を確認中…');
    try {
      await TGX.check({ force: true });
      ({ recent = [], lastCheckAt = 0 } = await chrome.storage.local.get(['recent', 'lastCheckAt']));
      draw();
    } catch (e) {
      if (my === run) status('新着を確認できませんでした：' + e.message);
    }
  }

  // ---------- 後で見る：TubeFolioの後で見る → 自分の再生リスト（リストごと） → YouTubeの「後で見る」 ----------
  //   各一覧は見出しを押すと開閉（laterOpen に保存）。再生リストは開いたときに読み込む
  let wl = { at: 0, items: null, error: '' };
  let pls = { at: 0, list: null, error: '' };
  const plItems = new Map(); // 再生リストID → { at, items, error, loading }
  let laterS = null, laterMy = 0;
  async function paintLater(S, my, force) {
    laterS = S; laterMy = my;
    const fav = favSetOf(S);
    const unsub = key => !(key && fav.has(key));
    let later = await TGX.getLater();
    // 以前「取り込む」で入れたものは YouTube の「後で見る」の段で表示するので、上の一覧からは外す
    if (later.some(x => x.wl)) { later = later.filter(x => !x.wl); await chrome.storage.local.set({ later }); }
    // カテゴリ（トップのフォルダ／未分類／登録外）で絞り込み
    const off = new Set(S.laterOff || []);
    const fmap = TG.folderMap(S.channels, S.folders);
    const catOk = it => {
      if (!off.size) return true;
      const fs = (it.ch?.key && fmap.get(it.ch.key)) || [];
      if (fs.length) return fs.some(f => !off.has(TG.rootOf(S.folders, f.id)?.id || f.id));
      return !off.has(it.ch?.key && fav.has(it.ch.key) ? '__unsorted' : '__other');
    };
    const conv = (x, pl) => ({ v: x.v, t: x.t, p: x.p || 0, n: x.n, th: x.thumb, d: x.dur || 0, w: x.w || 0, wlSrc: true, pl, ...(pl !== 'WL' ? { list: pl } : {}), ch: { key: x.chKey || '', name: x.chName || '', unsub: unsub(x.chKey) } });
    const allTop = later.map(x => ({ ...x, ch: { ...x.ch, unsub: unsub(x.ch.key) } }));
    let { wlSort = 'yt', laterOpen = {} } = await chrome.storage.local.get(['wlSort', 'laterOpen']);
    const isOpen = id => laterOpen[id] ?? (id === 'tg' || id === 'WL');
    const sortList = list => {
      const l = list.map((x, i) => ({ ...x, _i: i }));
      if (wlSort === 'new') l.sort((a, b) => (b.p || 0) - (a.p || 0) || a._i - b._i);
      if (wlSort === 'old') l.sort((a, b) => (a.p || Infinity) - (b.p || Infinity) || a._i - b._i);
      return l;
    };
    const loadPl = async id => {
      const e = plItems.get(id);
      if (e?.loading || (e?.items && Date.now() - e.at < 5 * 60e3 && !force)) return;
      plItems.set(id, { ...(e || {}), loading: true });
      draw();
      try {
        const list = await YTAPI.playlistItems(id, { maxPages: 10 }, ctl.signal);
        plItems.set(id, { at: Date.now(), items: list.map(x => conv(x, id)), error: '' });
      } catch (err) {
        if (ctl.signal.aborted) return;
        plItems.set(id, { at: 0, items: null, error: err.message });
      }
      draw();
    };
    const draw = () => {
      if (my !== run) return;
      const top = allTop.filter(catOk);
      let hid = allTop.length - top.length;
      const secs = [];
      const sortSel = `<select class="tg-wlsort" title="YouTubeの一覧の並び順">${[['yt', 'YouTubeの並び'], ['new', '投稿が新しい順'], ['old', '投稿が古い順']].map(([k, l]) => `<option value="${k}" ${k === wlSort ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
      secs.push({ id: 'tg', icon: '🕒', title: 'TubeFolioの後で見る', note: `${top.length} 本・追加した順`, items: top,
        empty: 'まだありません。サムネイルの左下の 🕒 で追加できます。' });
      for (const p of pls.list || []) {
        const e = plItems.get(p.id);
        const its = e?.items ? sortList(e.items.filter(catOk)) : null;
        if (e?.items) hid += e.items.length - its.length;
        secs.push({ id: p.id, icon: '📃', title: p.title, note: its ? `${its.length} 本・再生リスト（✕で YouTube の再生リストからも削除）` : p.count != null ? `${p.count} 本` : '再生リスト',
          items: its, loading: !its && !e?.error, error: e?.error, empty: 'この再生リストは空です。' });
      }
      if (pls.error) secs.push({ id: '_plerr', icon: '📃', title: '再生リスト', note: '', items: null, error: pls.error });
      const wlIts = wl.items ? sortList(wl.items.map(x => ({ ...x, pl: 'WL' })).filter(catOk)) : null;
      if (wl.items) hid += wl.items.length - wlIts.length;
      secs.push({ id: 'WL', icon: '▶', title: 'YouTubeの「後で見る」', note: wlIts ? `${wlIts.length} 本・YouTubeと同じ内容（✕で YouTube からも削除）` : '', items: wlIts, loading: !wl.items && !wl.error, error: wl.error, empty: 'YouTubeの「後で見る」は空です。' });
      // 連続再生・絞り込みは開いている一覧が対象
      items = secs.filter(x => isOpen(x.id) && x.items).flatMap(x => x.items);
      shown = items.length;
      el.classList.remove('tg-loading');
      status(hid ? `カテゴリで ${hid} 本を隠しています` : '');
      const g = el.querySelector('.tg-grid');
      g.classList.add('tg-split');
      g.innerHTML = secs.map(x => {
        const open = isOpen(x.id);
        const body = !open ? '' : x.error ? `<div class="tg-empty tg-empty-s">読み込めませんでした：${esc(x.error)}</div>`
          : x.loading || !x.items ? '<div class="tg-empty tg-empty-s">読み込み中…</div>'
          : x.items.length ? `<div class="tg-grid-in">${x.items.map(it => card(it)).join('')}</div>` : `<div class="tg-empty tg-empty-s">${x.empty}</div>`;
        return `<div class="tg-sec ${open ? 'open' : ''}" data-sec="${esc(x.id)}"><div class="tg-sec-h" data-sectoggle="${esc(x.id)}" title="押すと${open ? '閉じる' : '開く'}">
          <b class="tg-sec-caret">▸</b>${x.icon} ${esc(x.title)}<small>${esc(x.note)}</small>${x.id !== 'tg' && open && x.items?.length ? sortSel : ''}</div>${body}</div>`;
      }).join('');
      g.querySelectorAll('.tg-wlsort').forEach(sel => {
        sel.addEventListener('click', e => e.stopPropagation());
        sel.addEventListener('change', e => { wlSort = e.target.value; chrome.storage.local.set({ wlSort }); draw(); });
      });
      g.querySelectorAll('[data-sectoggle]').forEach(h => h.addEventListener('click', () => {
        const id = h.dataset.sectoggle;
        laterOpen = { ...laterOpen, [id]: !isOpen(id) };
        chrome.storage.local.set({ laterOpen });
        if (laterOpen[id] && id !== 'tg' && id !== 'WL' && id !== '_plerr') loadPl(id);
        draw();
      }));
      if (query) setQuery(query);
      fillIfHidden();
    };
    draw();
    const jobs = [];
    if (force || !wl.items || Date.now() - wl.at > 5 * 60e3) jobs.push((async () => {
      try {
        const list = await YTAPI.watchLater({ maxPages: 10 }, ctl.signal);
        wl = { at: Date.now(), error: '', items: list.map(x => conv(x, 'WL')) };
      } catch (e) {
        if (ctl.signal.aborted) return;
        wl = { at: 0, items: null, error: e.message };
        TG.log('後で見る', 'YouTubeの「後で見る」を読み込めません：' + e.message, 'error');
      }
      draw();
    })());
    if (force || !pls.list || Date.now() - pls.at > 10 * 60e3) jobs.push((async () => {
      try { pls = { at: Date.now(), list: await YTAPI.myPlaylists(ctl.signal), error: '' }; }
      catch (e) { if (ctl.signal.aborted) return; pls = { at: 0, list: [], error: e.message }; }
      draw();
      (pls.list || []).filter(p => isOpen(p.id)).forEach(p => loadPl(p.id));
    })());
    else (pls.list || []).filter(p => isOpen(p.id)).forEach(p => loadPl(p.id));
    await Promise.all(jobs);
  }
  // 後で見るの一覧（段ごと）の動画
  function laterSecItems(id) {
    if (!id) return [];
    if (id === 'tg') return items.filter(x => !x.wlSrc);
    return items.filter(x => x.wlSrc && (x.pl || 'WL') === id);
  }
  // ---------- サムネの「⋮」メニュー：再生リストへ移動・保存、外す ----------
  function closeCardMenu() { document.getElementById('tg-cardmenu')?.remove(); }
  document.addEventListener('click', e => { if (!e.target.closest?.('#tg-cardmenu') && !e.target.closest?.('[data-cmenu]')) closeCardMenu(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCardMenu(); });
  window.addEventListener('scroll', closeCardMenu, { passive: true });
  async function openCardMenu(btn) {
    closeCardMenu();
    const v = btn.dataset.cmenu, from = btn.dataset.pl || ''; // from: '' = TubeFolioの後で見る ／ 'WL' ／ 再生リストID
    const it = items.find(x => x.v === v && (from ? x.wlSrc && (x.pl || 'WL') === from : !x.wlSrc));
    if (!it) return;
    const m = document.createElement('div');
    m.id = 'tg-cardmenu';
    const plName = id => id === 'WL' ? 'YouTubeの「後で見る」' : (pls.list || []).find(p => p.id === id)?.title || '再生リスト';
    const targets = [{ id: 'WL', title: 'YouTubeの「後で見る」' }, ...(pls.list || [])].filter(p => p.id !== from);
    const sub = act => targets.map(p => `<button data-cm="${act}" data-to="${esc(p.id)}">${p.id === 'WL' ? '🕒' : '📃'} ${esc(p.title)}</button>`).join('') || '<div class="tg-cm-note">再生リストを読み込み中です。少し待ってから開き直してください。</div>';
    m.innerHTML = `
      <button data-cm="play">▶ ここから連続再生</button>
      <div class="tg-cm-sep"></div>
      <div class="tg-cm-h">➡ 移動（${from ? `${esc(plName(from))}から外す` : 'TubeFolioの後で見るから外す'}）</div>
      ${from ? '<button data-cm="move" data-to="tg">🕒 TubeFolioの後で見る</button>' : ''}${sub('move')}
      <div class="tg-cm-sep"></div>
      <div class="tg-cm-h">💾 保存（このまま残す）</div>${sub('save')}
      <div class="tg-cm-sep"></div>
      <button data-cm="remove">🗑 ${from ? `${esc(plName(from))}から削除` : 'TubeFolioの後で見るから外す'}</button>`;
    document.body.appendChild(m);
    const r = btn.getBoundingClientRect();
    const w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';
    m.style.top = (r.bottom + h + 8 < innerHeight ? r.bottom + 4 : Math.max(8, r.top - h - 4)) + 'px';
    m.addEventListener('click', async e => {
      const b = e.target.closest('[data-cm]');
      if (!b) return;
      e.preventDefault(); e.stopPropagation();
      const act = b.dataset.cm, to = b.dataset.to;
      if (act === 'play') {
        closeCardMenu();
        const sec = from || 'tg';
        const list = laterSecItems(sec);
        return TGX.startQueue(list.slice(Math.max(0, list.findIndex(x => x.v === v))).filter(x => !x.short), from ? plName(from) : '後で見る', { pick: true });
      }
      b.disabled = true;
      try {
        if (act === 'move' || act === 'save') {
          if (to === 'tg') { if (!laterSet.has(v)) await TGX.toggleLater({ ...it, wlSrc: undefined, pl: undefined, list: undefined }); }
          else await YTAPI.addToPlaylist(v, to);
          if (to === 'WL') wl.at = 0; else plItems.delete(to);
        }
        if (act === 'move' || act === 'remove') {
          if (!from) { if (laterSet.has(v)) await TGX.toggleLater(it); }
          else await (from === 'WL' ? YTAPI.removeFromWatchLater(v) : YTAPI.removeFromPlaylist(v, from));
          if (from === 'WL') { if (wl.items) wl.items = wl.items.filter(x => x.v !== v); }
          else if (from) { const e2 = plItems.get(from); if (e2?.items) e2.items = e2.items.filter(x => x.v !== v); }
        }
        const msg = { move: `「${it.t}」を${to === 'tg' ? 'TubeFolioの後で見る' : plName(to)}へ移動しました`, save: `「${it.t}」を${plName(to)}に保存しました`, remove: `「${it.t}」を外しました` }[act];
        TG.log('後で見る', msg);
        closeCardMenu();
        status(msg);
        if (act !== 'save') btn.closest('.tg-card')?.remove();
        if (act !== 'save' && !from) items = items.filter(x => !(x.v === v && !x.wlSrc));
        if (act !== 'save' && from) items = items.filter(x => !(x.v === v && x.wlSrc && (x.pl || 'WL') === from));
      } catch (err) {
        b.disabled = false;
        b.textContent = '失敗しました：' + err.message;
        TG.log('後で見る', 'メニューの操作に失敗：' + err.message, 'error');
      }
    });
  }
  async function removeWl(btn) {
    const v = btn.dataset.wlrm, pl = btn.dataset.pl || 'WL';
    const it = items.find(x => x.v === v && x.wlSrc && x.pl === pl);
    const name = pl === 'WL' ? '「後で見る」' : `再生リスト「${(pls.list || []).find(p => p.id === pl)?.title || ''}」`;
    btn.disabled = true;
    try {
      await (pl === 'WL' ? YTAPI.removeFromWatchLater(v) : YTAPI.removeFromPlaylist(v, pl));
      if (pl === 'WL') { if (wl.items) wl.items = wl.items.filter(x => x.v !== v); }
      else { const e = plItems.get(pl); if (e?.items) e.items = e.items.filter(x => x.v !== v); }
      items = items.filter(x => !(x.v === v && x.wlSrc && x.pl === pl));
      btn.closest('.tg-card')?.remove();
      TG.log('後で見る', `YouTubeの${name}から削除：${it?.t || v}`);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = '!';
      btn.title = '削除できませんでした：' + e.message;
      TG.log('後で見る', `YouTubeの${name}から削除できません：` + e.message, 'error');
    }
  }

  // ---------- おすすめ（未登録チャンネルのみ） ----------
  function favSetOf(S) {
    const s = new Set();
    for (const c of Object.values(S.channels)) {
      if (c.unsub) continue;
      s.add(c.key);
      if (c.id) s.add('channel/' + c.id);
    }
    return s;
  }

  // ---------- お気に入り以外を検索（YouTube検索から未登録チャンネルのものだけ） ----------
  const searches = new Map();
  function startSearch(S, my, force) {
    const kind = S.recKind === 'short' ? 'short' : 'video';
    const q = TG.searchQuery(S.folders, S.sFolder, S.sText);
    if (!q) {
      items = [];
      el.querySelector('.tg-grid').innerHTML = '<div class="tg-empty">上の欄にキーワードを入れるか、フォルダを選んでください。<br>フォルダを選ぶと、フォルダ名と振り分け補助のキーワード（🏷）で、登録していないチャンネルの動画を探します。</div>';
      status('');
      rec = newRec('search');
      rec.mode = 'end';
      return;
    }
    const key = kind + '|' + q;
    const fav = favSetOf(S);
    if (!force && searches.has(key) && Date.now() - searches.get(key).at < TTL) {
      rec = searches.get(key); rec.fav = fav;
      return paint(rec.items, `検索：${q}`);
    }
    rec = newRec('search', fav);
    rec.q = q; rec.qKind = kind; rec.mode = 'more';
    searches.set(key, rec);
    skeleton(0, 0);
    status(`検索中… ${q}`);
    return loadSearch(my, true);
  }
  async function loadSearch(my, first) {
    rec.loading = true;
    let added = 0, pages = 0;
    const short = rec.qKind === 'short';
    try {
      while (pages++ < 5 && added < 24 && rec.mode !== 'end') {
        const { items: list, token } = await YTAPI.search(rec.token ? null : rec.q + (short ? ' #shorts' : ''), rec.token, ctl.signal);
        if (my !== run) return;
        rec.token = token;
        if (!token) rec.mode = 'end';
        const seen = new Set(rec.items.map(x => x.v));
        const cand = list.filter(x => x.v && !seen.has(x.v) && !!x.short === short && !x.upcoming);
        // ショートは投稿者が付いていないので調べる
        const queue = cand.filter(x => !x.chKey);
        await Promise.all(Array.from({ length: 6 }, async () => {
          while (queue.length) { const x = queue.shift(); const o = await ownerOf(x.v, ctl.signal); if (o) { x.chKey = o.k; x.chName = o.n; if (!x.t) x.t = o.t || ''; } }
        }));
        if (my !== run) return;
        for (const x of cand) {
          if (!x.chKey || seen.has(x.v)) continue;
          if (rec.fav.has(x.chKey) || (x.chId && rec.fav.has('channel/' + x.chId))) continue; // 登録済みは除外
          seen.add(x.v);
          rec.items.push({ v: x.v, t: x.t, p: x.p, n: x.n, th: x.thumb, d: x.dur || 0, live: x.live, short, w: x.w || 0, ch: { key: x.chKey, name: x.chName, unsub: true } });
          added++;
        }
        if (first) status(`検索中… ${rec.items.length} 件`);
      }
      rec.at = Date.now();
    } catch (e) {
      if (my === run && !ctl.signal.aborted) status('検索できませんでした：' + e.message);
      rec.mode = 'end';
    } finally { rec.loading = false; }
    if (my !== run) return;
    const msg = `検索：${rec.q}　${rec.items.length} 件（登録していないチャンネルのみ）${rec.mode === 'end' ? '' : '・下へスクロールで続き'}`;
    if (first) paint(rec.items, msg);
    else { items = rec.items; status(msg); afterLoad(); }
    requestAnimationFrame(() => {
      const r = el.querySelector('.tg-more')?.getBoundingClientRect();
      if (r && r.top < innerHeight + 800 && recHasMore() && my === run) more();
    });
    if (first && !rec.items.length) el.querySelector('.tg-grid').innerHTML = '<div class="tg-empty">登録していないチャンネルの動画は見つかりませんでした。キーワードを変えてみてください。</div>';
  }

  // まだ続きがあるか（動画＝ホームの続き、ショート＝ホームの棚→ショートの連続再生の流れ）
  const recHasMore = () => (rec.kind === 'short' || rec.kind === 'search' ? rec.mode !== 'end' : rec.vmode !== 'end');
  // ---------- おすすめの重複を避ける ----------
  //   表示したおすすめは recSeen に覚えておき、3日間は出さない（「更新」で同じ動画が並ばないように）。見終わった動画も出さない
  let recSeen = null, recSeenT = null;
  async function loadRecSeen() {
    if (recSeen) return recSeen;
    const { recSeen: o = {} } = await chrome.storage.local.get('recSeen');
    const cut = Date.now() - 3 * 864e5;
    recSeen = new Map(Object.entries(o).filter(([, t]) => t > cut));
    return recSeen;
  }
  function markRecSeen(list) {
    const now = Date.now();
    list.forEach(x => { if (!recSeen.has(x.v)) recSeen.set(x.v, now); });
    clearTimeout(recSeenT);
    recSeenT = setTimeout(() => chrome.storage.local.set({ recSeen: Object.fromEntries([...recSeen].slice(-6000)) }), 2000);
  }
  // この画面を開く前から覚えている分（今回の一覧で出したものは除外しない）
  const recBlocked = v => rec.blocked?.has(v) || (watched[v]?.p || 0) >= WATCHED;
  // 関連動画の元にする動画：登録チャンネルの新着・最近見た動画・おすすめに出した動画（シャッフル）
  async function recSeeds() {
    const { recent = [], history = {} } = await chrome.storage.local.get(['recent', 'history']);
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const hist = Object.entries(history).filter(([, h]) => !h.short).sort((a, b) => (b[1].last || 0) - (a[1].last || 0)).slice(0, 60).map(([v]) => v);
    const fresh = recent.filter(x => !x.live && !(x.up > Date.now())).slice(0, 80).map(x => x.v);
    return shuffle([...new Set([...shuffle(hist).slice(0, 25), ...shuffle(fresh).slice(0, 25)])]);
  }
  // 読み込みの途中でも、集まった分から先に表示する（全部そろうまで待たせない）
  function showSoFar(my, first) {
    if (my !== run) return;
    if (first && !rec.painted && rec.items.length >= 8) { rec.painted = true; paint(rec.items, 'おすすめを読み込み中…'); return; }
    if (rec.painted || !first) { items = rec.items; more(true); status(`おすすめを読み込み中… ${rec.items.length} 件`); return; }
    status(`おすすめを読み込み中… ${rec.items.length} 件`);
  }
  // ---------- おすすめ（動画）：ホーム・検索（自分のフォルダのキーワード）・関連動画を並行で取り、まとめて並べる ----------
  //   ・日本語の動画を多め（割合は「⚖ 比重」で設定）、フォルダごとの比重（多め／普通／少なめ／使わない）
  //   ・登録済み・見た動画・最近出したおすすめは出さない。見たことのあるチャンネルは後ろへ。1チャンネル2本まで
  const JP = /[\u3040-\u30ff\u3400-\u9fff]/;
  async function recPrefsOf(S) {
    const { recPrefs } = await chrome.storage.local.get('recPrefs');
    const w = { ...(recPrefs?.w || {}) };
    // 初期値：「国内」を含むフォルダは多め、「海外」を含むフォルダは少なめ
    if (!recPrefs) S.folders.filter(f => !f.parent).forEach(f => { if (/国内/.test(f.name)) w[f.id] = 3; else if (/海外/.test(f.name)) w[f.id] = 0.3; });
    return { jp: recPrefs?.jp ?? 0.9, w };
  }
  async function recPlan(S) {
    const P = await recPrefsOf(S);
    const { history = {} } = await chrome.storage.local.get('history');
    const fmap = TG.folderMap(S.channels, S.folders);
    const tops = S.folders.filter(f => !f.parent || !S.folders.some(x => x.id === f.parent));
    // フォルダごとの視聴時間の割合（よく見るフォルダのキーワードほど多く使う）
    const sec = {}; let total = 0;
    const histCh = new Set();
    for (const h of Object.values(history)) {
      if (h.k) histCh.add(h.k);
      const fs = (h.k && fmap.get(h.k)) || [];
      fs.forEach(f => { const r = TG.rootOf(S.folders, f.id)?.id || f.id; sec[r] = (sec[r] || 0) + (h.sec || 0); total += h.sec || 0; });
    }
    const pool = [];
    for (const f of tops) {
      const w = P.w[f.id] ?? 1;
      if (!w) continue;
      const kws = [...new Set([f.name, ...TG.folderKw(f).inc])].filter(k => k.length >= 2).slice(0, 14);
      const fw = w * (0.5 + (total ? (sec[f.id] || 0) / total * 4 : 0.5));
      kws.forEach(k => pool.push({ k, w: fw / Math.sqrt(kws.length) }));
    }
    // 重み付きで並べる（重いものほど前に出やすい）
    const queries = pool.map(x => ({ ...x, r: Math.pow(Math.random(), 1 / Math.max(x.w, 0.01)) })).sort((a, b) => b.r - a.r).map(x => x.k);
    return { P, histCh, queries: [...new Set(queries)], seeds: await recSeeds() };
  }
  async function loadRecVideo(my, first) {
    rec.loading = true;
    try {
      if (!rec.plan) rec.plan = await recPlan(rec.S);
      const { P, histCh } = rec.plan;
      const perCh = rec.perCh || (rec.perCh = new Map());
      let added = 0, rounds = 0;
      const seen = new Set(rec.items.map(x => x.v));
      while (rounds++ < 3 && added < 24) {
        // 1回分：検索2つ＋関連動画1本＋ホーム（続きがあれば）を同時に取りに行く
        const jobs = [];
        const q1 = rec.plan.queries.shift(), q2 = rec.plan.queries.shift();
        const searchJob = q => YTAPI.search(q, null, ctl.signal).then(r => r.items, () => []);
        if (q1) jobs.push(searchJob(q1));
        if (q2) jobs.push(searchJob(q2));
        const seed = rec.plan.seeds.shift();
        if (seed) jobs.push(YTAPI.related(seed, ctl.signal).catch(() => []));
        if (first && rounds === 1 || rec.token) jobs.push(YTAPI.recommended(first && rounds === 1 ? null : rec.token, ctl.signal).then(r => { rec.token = r.token; return r.items; }, () => []));
        if (!jobs.length) { rec.vmode = 'end'; break; }
        const lists = await Promise.all(jobs);
        if (my !== run) return;
        // 候補をそろえて、日本語・見たことのないチャンネルを前に
        const cand = [];
        for (const x of lists.flat()) {
          if (!x.chKey || x.short || x.upcoming || seen.has(x.v) || recBlocked(x.v)) continue;
          if (rec.fav.has(x.chKey) || (x.chId && rec.fav.has('channel/' + x.chId))) continue; // 登録済みは除外
          seen.add(x.v);
          const jp = JP.test(x.t || '') || JP.test(x.chName || '');
          cand.push({ x, jp, sc: (jp ? 2 : 0) + (histCh.has(x.chKey) ? 0 : 1) + Math.random() * 1.5 });
        }
        cand.sort((a, b) => b.sc - a.sc);
        const got = [];
        for (const c of cand) {
          const n = perCh.get(c.x.chKey) || 0;
          if (n >= 2) continue;
          // 日本語以外は決めた割合まで
          if (!c.jp && P.jp < 1) {
            const jpN = rec.items.filter(i => i._jp).length + got.filter(i => i._jp).length;
            const frN = rec.items.filter(i => !i._jp).length + got.filter(i => !i._jp).length;
            if (P.jp >= 1 || frN + 1 > Math.max(1, jpN) * (1 - P.jp) / P.jp) continue;
          } else if (!c.jp && P.jp >= 1) continue;
          perCh.set(c.x.chKey, n + 1);
          const x = c.x;
          got.push({ v: x.v, t: x.t, p: x.p, n: x.n, th: x.thumb, d: x.dur || 0, live: x.live, w: x.w || 0, _jp: c.jp, ch: { key: x.chKey, name: x.chName, unsub: true } });
          // 出したおすすめも、次の関連動画の元にする
          if (got.length <= 2) rec.plan.seeds.push(x.v);
        }
        rec.items.push(...got);
        added += got.length;
        showSoFar(my, first);
        if (!rec.plan.queries.length && !rec.plan.seeds.length && !rec.token) { rec.vmode = 'end'; break; }
      }
      rec.at = Date.now();
    } catch (e) {
      if (my === run && !ctl.signal.aborted) status('おすすめの取得に失敗しました：' + e.message);
    } finally { rec.loading = false; }
    if (my !== run) return;
    markRecSeen(rec.items);
    if (first && !rec.painted) paint(rec.items, '');
    else { items = rec.items; status(recHasMore() ? '' : 'これ以上のおすすめは見つかりませんでした（「更新」で読み直せます）'); afterLoad(); }
    if (first && !rec.items.length) el.querySelector('.tg-grid').innerHTML = '<div class="tg-empty">おすすめが見つかりませんでした。「⚖ 比重」の設定を見直すか、しばらくしてから「更新」してください。</div>';
  }

  async function loadRec(my, first) {
    if (rec.kind === 'video') {
      if (first) { await loadRecSeen(); rec.blocked = new Set(recSeen.keys()); }
      return loadRecVideo(my, first);
    }
    rec.loading = true;
    let added = 0, tries = 0;
    const isShort = rec.kind === 'short';
    await loadRecSeen();
    if (first) rec.blocked = new Set(recSeen.keys());
    try {
      if (!first) status(isShort ? 'おすすめのショートを読み込み中…（投稿者を確認しています）' : 'おすすめを読み込み中…');
      while (tries++ < (isShort ? 8 : 6) && added < (isShort ? 24 : 30)) {
        const seen = new Set(rec.items.map(x => x.v));
        if (isShort) {
          let cand = [];
          if ((rec.mode || 'home') === 'home') {
            // まずホームのショート棚から（最初の3ページまで）
            const { items: list, token } = await YTAPI.recommended(first && tries === 1 ? null : rec.token, ctl.signal);
            if (my !== run) return;
            rec.token = token;
            rec.homePages = (rec.homePages || 0) + 1;
            cand = list.filter(x => x.short && x.v && !seen.has(x.v));
            if (!token || rec.homePages >= 3) rec.mode = 'seq';
            rec.mode = rec.mode || 'home';
          } else {
            // その先は、ショートの連続再生と同じ流れ（YouTubeのおすすめショート）から
            const seed = rec.seed || rec.items[rec.items.length - 1]?.v || rec.lastSeen;
            if (!seed) { rec.mode = 'end'; break; }
            let r;
            try { r = await YTAPI.shortsSequence(seed, rec.seqTok, ctl.signal); }
            catch (e) { if (ctl.signal.aborted) throw e; rec.mode = 'end'; TG.log('おすすめ', 'ショートの続きを取得できません：' + e.message, 'warn'); break; }
            if (my !== run) return;
            rec.seed = seed;
            rec.seqTok = r.token;
            cand = r.ids.filter(v => !seen.has(v)).map(v => ({ v, short: true }));
            if (!r.token || !r.ids.length) rec.mode = 'end';
          }
          if (cand.length) rec.lastSeen = cand[cand.length - 1].v;
          // 投稿者（と題名）を調べて、未登録チャンネルのものだけ
          const queue = [...cand];
          await Promise.all(Array.from({ length: 10 }, async () => {
            while (queue.length) {
              const x = queue.shift();
              const o = await ownerOf(x.v, ctl.signal);
              if (o) { x.chKey = o.k; x.chName = o.n; if (!x.t) x.t = o.t || ''; }
            }
          }));
          if (my !== run) return;
          for (const x of cand) {
            if (!x.chKey || seen.has(x.v) || recBlocked(x.v)) continue;
            if (rec.fav.has(x.chKey)) continue;
            seen.add(x.v);
            rec.items.push({ v: x.v, t: x.t || '', p: null, n: x.n || 0, th: x.thumb || '', d: x.dur || 0, short: true, w: x.w || 0, ch: { key: x.chKey, name: x.chName, unsub: true } });
            added++;
          }
          showSoFar(my, first);
          if (rec.mode === 'end') break;
          continue;
        }
        // 動画：まずホームのおすすめ（最大3ページ）→ その先は関連動画（登録チャンネルの新着・最近見た動画・出したおすすめを元に）
        let list = [];
        if ((rec.vmode || 'home') === 'home') {
          const r = await YTAPI.recommended(first && tries === 1 ? null : rec.token, ctl.signal);
          if (my !== run) return;
          rec.token = r.token;
          rec.homePages = (rec.homePages || 0) + 1;
          list = r.items;
          rec.vmode = !r.token || rec.homePages >= 3 ? 'related' : 'home';
        } else {
          if (!rec.seedQ) rec.seedQ = await recSeeds();
          // 関連動画は3本分まとめて並行で取る（1本ずつだと遅い）
          const seeds = rec.seedQ.splice(0, 3);
          if (!seeds.length) { rec.vmode = 'end'; break; }
          const res = await Promise.all(seeds.map(v => YTAPI.related(v, ctl.signal).catch(e => { if (ctl.signal.aborted) throw e; return []; })));
          if (my !== run) return;
          list = res.flat();
        }
        const got = [];
        for (const x of list) {
          if (!x.chKey || x.p === undefined || x.short || seen.has(x.v) || recBlocked(x.v)) continue;
          if (rec.fav.has(x.chKey) || (x.chId && rec.fav.has('channel/' + x.chId))) continue; // 登録済みは除外
          seen.add(x.v);
          got.push({ v: x.v, t: x.t, p: x.p, n: x.n, th: x.thumb, d: x.dur || 0, live: x.live, up: x.upcoming, w: x.w || 0, ch: { key: x.chKey, name: x.chName, unsub: true } });
        }
        rec.items.push(...got);
        added += got.length;
        // 出したおすすめも、次の関連動画の元にする（どんどん広がる）
        if (rec.seedQ && got.length) rec.seedQ.push(...got.slice(0, 3).map(x => x.v));
        showSoFar(my, first);
      }
      rec.at = Date.now();
    } catch (e) {
      if (my === run && !ctl.signal.aborted) status('おすすめの取得に失敗しました：' + e.message);
    } finally {
      rec.loading = false;
    }
    if (my !== run) return;
    markRecSeen(rec.items);
    if (first && !rec.painted) paint(rec.items, '');
    else { items = rec.items; status(recHasMore() ? '' : 'これ以上のおすすめは見つかりませんでした（「更新」で読み直せます）'); afterLoad(); }
    // まだ下端が見えていれば続けて読み込む
    requestAnimationFrame(() => {
      const r = el.querySelector('.tg-more')?.getBoundingClientRect();
      if (r && r.top < innerHeight + 800 && recHasMore() && my === run) more();
    });
    if (first && !rec.items.length) {
      el.querySelector('.tg-grid').innerHTML = `<div class="tg-empty">未登録チャンネルのおすすめ${isShort ? 'ショート' : ''}が見つかりませんでした。<br>しばらくしてから開き直してください。</div>`;
    }
  }

  // ---------- チャンネル群の取得（共通） ----------
  async function fetchChannels(list, type, signal, onProgress) {
    let done = 0, idsChanged = false;
    const queue = [...list];
    const worker = async () => {
      while (queue.length && !signal.aborted) {
        const c = queue.shift();
        try {
          if (!c.id) {
            c.id = await YTAPI.resolveId(c.key, signal);
            if (c.id) idsChanged = true;
          }
          if (c.id) mem.set(type + ':' + c.id, { at: Date.now(), items: await fetchList(c.id, type, signal) });
        } catch { /* 取得失敗は飛ばす */ }
        onProgress?.(++done, list.length);
      }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
    return idsChanged;
  }

  // ライブ・ショート：次の100チャンネル分を取得して追加
  async function loadBatch(my, first, force = false) {
    batch.loading = true;
    const type = curType;
    const part = batch.chs.slice(batch.loaded, batch.loaded + BATCH);
    const fresh = c => { const e = c.id && mem.get(type + ':' + c.id); return e && Date.now() - e.at < TTL; };
    const need = force ? part : part.filter(c => !fresh(c));
    const from = batch.loaded + 1, to = batch.loaded + part.length, total = batch.chs.length;
    try {
      if (need.length) {
        if (first) skeleton(0, need.length);
        else status(`さらに読み込み中… ${from}〜${to} / ${total} チャンネル`);
        const ids = await fetchChannels(need, type, ctl.signal, (d, n) => {
          if (my !== run) return;
          if (first && d % 5 === 0) skeleton(d, n);
          else if (!first) status(`さらに読み込み中… ${from}〜${to} / ${total} チャンネル（${d}/${n}）`);
        });
        if (my !== run) return;
        saveCache();
        if (ids) saveIds(part);
      }
      batch.loaded += part.length;
    } finally {
      batch.loading = false;
    }
    if (my !== run) return;
    const added = collect(part, type);
    const rest = batch.chs.length - batch.loaded;
    const msg = rest > 0 ? `${batch.loaded} / ${total} チャンネル表示中（下までスクロールで次の${Math.min(BATCH, rest)}チャンネル）` : '';
    if (first) paint(added, msg);
    else { items = items.concat(added); status(msg); afterLoad(); }
    if (first && !added.length && rest > 0) return loadBatch(my, false);
    if (first) return; // 初回は30件で止める（続きはスクロールで）
    // まだ下端が見えていれば続けて表示
    requestAnimationFrame(() => {
      const r = el.querySelector('.tg-more')?.getBoundingClientRect();
      if (r && r.top < innerHeight + 800 && my === run) more();
    });
  }

  // ---------- 取得 ----------
  async function refresh(S, { force = false } = {}) {
    if (!el) return;
    const my = ++run;
    ctl?.abort();
    ctl = new AbortController();
    const { signal } = ctl;
    await loadCache();
    curType = S.feedType;
    el.dataset.type = curType === 'rec' && S.recKind === 'short' ? 'short' : curType;
    el.style.setProperty('--tg-cols', S.cols);
    folderMap = TG.folderMap(S.channels, S.folders);

    if (FX.active && S.activeGroup && !['rec', 'later', 'new'].includes(curType) && FX.folderLocked(S.activeGroup)) {
      const f = S.folders.find(x => x.id === S.activeGroup);
      return lockScreen(f ? TG.pathName(S.folders, f) : '未分類');
    }
    if (curType === 'later') return paintLater(S, my, force);
    if (curType === 'new') return paintNew(S, my, force);
    if (curType === 'rec') {
      if (S.recMode === 'search') return startSearch(S, my, force);
      const kind = S.recKind === 'short' ? 'short' : 'video';
      rec = recs[kind];
      rec.fav = favSetOf(S);
      if (!force && rec.items.length && Date.now() - rec.at < TTL) return paint(rec.items, '');
      rec = recs[kind] = newRec(kind, rec.fav);
      rec.S = S;
      skeleton(0, 0);
      status(kind === 'short' ? 'おすすめのショートを読み込み中…（投稿者を確認しています）' : 'おすすめを読み込み中…');
      return loadRec(my, true);
    }

    const chs = targets(S);
    if (!chs.length) {
      items = [];
      el.querySelector('.tg-grid').innerHTML = `<div class="tg-empty">${Object.keys(S.channels).length
        ? 'このフォルダにはチャンネルがありません。<br>「フォルダ設定」からチャンネルを振り分けてください。'
        : 'まだチャンネルが読み込まれていません。<br>「フォルダ設定」→「登録チャンネルを読み込む」を押してください。'}</div>`;
      status('');
      return;
    }
    if (BATCHED(curType)) {
      batch = { chs, loaded: 0, loading: false };
      return loadBatch(my, true, force);
    }
    const fresh = c => { const e = c.id && mem.get(curType + ':' + c.id); return e && Date.now() - e.at < TTL; };
    const cached = chs.filter(c => c.id && mem.has(curType + ':' + c.id)).length;
    const need = force ? chs : chs.filter(c => !fresh(c));
    const cachedFirst = cached / chs.length >= 0.7;

    if (cachedFirst) paint(collect(chs, curType), need.length ? '新着を確認中…' : '');
    else skeleton(0, need.length);
    if (!need.length) return;

    const type = curType;
    const idsChanged = await fetchChannels(need, type, signal, (d, n) => {
      if (my === run && !cachedFirst && d % 5 === 0) skeleton(d, n);
    });
    if (my !== run) return;
    saveCache();
    if (idsChanged) saveIds(chs);
    paint(collect(chs, type), '');
  }

  function saveIds(chs) {
    return TG.update(d => {
      let changed = false;
      chs.forEach(c => { if (c.id && d.channels[c.key] && !d.channels[c.key].id) { d.channels[c.key].id = c.id; changed = true; } });
      return changed ? undefined : false;
    });
  }

  function setCols(n) {
    el?.style.setProperty('--tg-cols', n);
  }

  // 後で見るの変更を、表示中のボタンに反映
  function setLater(later) {
    laterSet = new Set((later || []).map(x => x.v));
    el?.querySelectorAll('[data-later]').forEach(b => {
      const on = laterSet.has(b.dataset.later);
      b.classList.toggle('on', on);
      b.textContent = on ? '✓' : '🕒';
      b.title = on ? '後で見るから外す' : '後で見るに追加';
    });
  }
  // 連続再生用：表示中の一覧のうち未視聴のもの（表示順）
  function playable() {
    return visible().filter(it => !it.up && !it.live && watchedOf(it) < WATCHED);
  }
  const type = () => curType;

  return { setFocus, setQuery, TYPES, mount, refresh, signature, setCols, setWatched, setHideWatched, markWatched, setLater, playable, type };
})();

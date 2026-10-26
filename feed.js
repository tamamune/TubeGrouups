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
        .map(x => ({ v: x.v, t: x.t, p: x.p, n: x.n, th: x.thumb, live: x.live, up: x.upcoming, i: x.i, w: x.w || 0 }));
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
    if (S.feedType === 'later') return 'later:' + Date.now(); // 毎回作り直す
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
        ${badge}<span class="tg-wbadge">${wLabel(wp)}</span><span class="tg-wbar"></span>
        ${it.wlSrc ? `<button class="tg-later tg-wlrm" data-wlrm="${esc(it.v)}" title="YouTubeの「後で見る」から削除">✕</button>`
          : `<button class="tg-later ${laterSet.has(it.v) ? 'on' : ''}" data-later="${esc(it.v)}" title="${laterSet.has(it.v) ? '後で見るから外す' : '後で見るに追加'}">${laterSet.has(it.v) ? '✓' : '🕒'}</button>`}</div>
      <div class="tg-title">${esc(it.t)}</div>
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

  function more() {
    if (!el) return;
    const vis = visible();
    if (shown >= vis.length) {
      if (curType === 'rec' && recHasMore() && !rec.loading) (rec.kind === 'search' ? loadSearch : loadRec)(run, false);
      if (BATCHED(curType) && batch.loaded < batch.chs.length && !batch.loading) loadBatch(run, false);
      return;
    }
    const n = BATCHED(curType) ? PAGE : Math.max(40, (+el.style.getPropertyValue('--tg-cols') || 4) * 10);
    const html = vis.slice(shown, shown + n).map(it => { const h = card(it); shown++; return h; }).join('');
    el.querySelector('.tg-empty')?.remove();
    el.querySelector('.tg-grid').insertAdjacentHTML('beforeend', html);
    fillIfHidden();
    if (query) { qStatus(); requestAnimationFrame(() => { const r = el.querySelector('.tg-more')?.getBoundingClientRect(); if (r && r.top < innerHeight + 300) moreIfCan(); }); }
  }
  // 絞り込み中で画面が埋まらないときは、続きを読み込む
  function moreIfCan() {
    if (shown < visible().length) return more();
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
  async function paintNew(S, my, force) {
    let { recent = [], lastCheckAt = 0 } = await chrome.storage.local.get(['recent', 'lastCheckAt']);
    const draw = msg => {
      if (my !== run) return;
      const keep = newFilter(S);
      const list = recent.filter(keep).sort((a, b) => (b.p || 0) - (a.p || 0)).map(x => ({
        v: x.v, t: x.t, p: x.p, n: 0, live: x.live, up: x.up, w: x.w || 0, ch: { key: x.k || (x.id ? 'channel/' + x.id : ''), name: x.n, unsub: false }
      }));
      paint(list, msg ?? `直近3日の新着 ${list.length} 本${recent.length !== list.length ? `（全 ${recent.length} 本中・カテゴリで絞り込み）` : ''}・${lastCheckAt ? TG.rel(lastCheckAt) + 'に確認' : ''}`);
      if (!list.length) el.querySelector('.tg-grid').innerHTML = `<div class="tg-empty">${recent.length ? '選んだカテゴリの新着はありません。上のカテゴリをオンにしてください。' : '新着を確認しています…'}</div>`;
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

  // ---------- 後で見る：上＝🕒で追加したもの／下＝YouTube本体の「後で見る」（YouTubeと同期） ----------
  let wl = { at: 0, items: null, error: '' };
  async function paintLater(S, my, force) {
    const fav = favSetOf(S);
    const unsub = key => !(key && fav.has(key));
    let later = await TGX.getLater();
    // 以前「取り込む」で入れたものは下の段（YouTube側）で表示するので、上の一覧からは外す
    if (later.some(x => x.wl)) { later = later.filter(x => !x.wl); await chrome.storage.local.set({ later }); }
    const top = later.map(x => ({ ...x, ch: { ...x.ch, unsub: unsub(x.ch.key) } }));
    let { wlSort = 'yt' } = await chrome.storage.local.get('wlSort');
    const draw = () => {
      if (my !== run) return;
      let bottom = (wl.items || []).map((x, i) => ({ ...x, wlSrc: true, _i: i }));
      // 並び：YouTubeの並び／投稿が新しい順／投稿が古い順（投稿日が分からないものは最後）
      if (wlSort === 'new') bottom.sort((a, b) => (b.p || 0) - (a.p || 0) || a._i - b._i);
      if (wlSort === 'old') bottom.sort((a, b) => (a.p || Infinity) - (b.p || Infinity) || a._i - b._i);
      const sortSel = `<select class="tg-wlsort" title="並び順">${[['yt', 'YouTubeの並び'], ['new', '投稿が新しい順'], ['old', '投稿が古い順']].map(([k, l]) => `<option value="${k}" ${k === wlSort ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
      items = top.concat(bottom);
      shown = items.length;
      el.classList.remove('tg-loading');
      status('');
      const g = el.querySelector('.tg-grid');
      g.classList.add('tg-split');
      g.innerHTML = `<div class="tg-sec"><div class="tg-sec-h">🕒 TubeGroupsの後で見る<small>${top.length} 本・追加した順</small></div>
          ${top.length ? `<div class="tg-grid-in">${top.map(it => card(it)).join('')}</div>`
            : '<div class="tg-empty tg-empty-s">まだありません。ホームや再生画面の動画のチャンネル名の下の 🕒、一覧のサムネイルにマウスを乗せると出る 🕒 で追加できます。</div>'}</div>
        <div class="tg-sec"><div class="tg-sec-h">▶ YouTubeの「後で見る」<small>${wl.items ? `${bottom.length} 本・YouTubeと同じ内容（✕で YouTube からも削除）` : ''}</small>${wl.items?.length ? sortSel : ''}</div>
          ${!wl.items ? `<div class="tg-empty tg-empty-s">${wl.error ? '読み込めませんでした：' + esc(wl.error) : 'YouTubeの「後で見る」を読み込み中…'}</div>`
            : bottom.length ? `<div class="tg-grid-in">${bottom.map(it => card(it)).join('')}</div>`
            : '<div class="tg-empty tg-empty-s">YouTubeの「後で見る」は空です。</div>'}</div>`;
      g.querySelector('.tg-wlsort')?.addEventListener('change', e => {
        wlSort = e.target.value;
        chrome.storage.local.set({ wlSort });
        draw();
      });
      fillIfHidden();
    };
    const stale = force || !wl.items || Date.now() - wl.at > 5 * 60e3;
    if (stale && !force) wl.error = '';
    draw();
    if (!stale) return;
    try {
      const list = await YTAPI.watchLater({ maxPages: 10 }, ctl.signal);
      wl = { at: Date.now(), error: '', items: list.map(x => ({ v: x.v, t: x.t, p: x.p || 0, n: x.n, th: x.thumb, w: x.w || 0, ch: { key: x.chKey || '', name: x.chName || '', unsub: unsub(x.chKey) } })) };
    } catch (e) {
      if (ctl.signal.aborted) return;
      wl = { at: 0, items: null, error: e.message };
      TG.log('後で見る', 'YouTubeの「後で見る」を読み込めません：' + e.message, 'error');
    }
    draw();
  }
  async function removeWl(btn) {
    const v = btn.dataset.wlrm;
    const it = items.find(x => x.v === v && x.wlSrc);
    btn.disabled = true;
    try {
      await YTAPI.removeFromWatchLater(v);
      if (wl.items) wl.items = wl.items.filter(x => x.v !== v);
      items = items.filter(x => !(x.v === v && x.wlSrc));
      const sec = btn.closest('.tg-sec');
      btn.closest('.tg-card')?.remove();
      const small = sec?.querySelector('.tg-sec-h small');
      if (small && wl.items) small.textContent = `${wl.items.length} 本・YouTubeと同じ内容（✕で YouTube からも削除）`;
      TG.log('後で見る', `YouTubeの「後で見る」から削除：${it?.t || v}`);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = '!';
      btn.title = '削除できませんでした：' + e.message;
      TG.log('後で見る', 'YouTubeの「後で見る」から削除できません：' + e.message, 'error');
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
          rec.items.push({ v: x.v, t: x.t, p: x.p, n: x.n, th: x.thumb, live: x.live, short, w: x.w || 0, ch: { key: x.chKey, name: x.chName, unsub: true } });
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
    else { items = rec.items; status(msg); more(); }
    requestAnimationFrame(() => {
      const r = el.querySelector('.tg-more')?.getBoundingClientRect();
      if (r && r.top < innerHeight + 800 && recHasMore() && my === run) more();
    });
    if (first && !rec.items.length) el.querySelector('.tg-grid').innerHTML = '<div class="tg-empty">登録していないチャンネルの動画は見つかりませんでした。キーワードを変えてみてください。</div>';
  }

  // まだ続きがあるか（動画＝ホームの続き、ショート＝ホームの棚→ショートの連続再生の流れ）
  const recHasMore = () => (rec.kind === 'short' || rec.kind === 'search' ? rec.mode !== 'end' : !!rec.token);
  async function loadRec(my, first) {
    rec.loading = true;
    let added = 0, tries = 0;
    const isShort = rec.kind === 'short';
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
          await Promise.all(Array.from({ length: 6 }, async () => {
            while (queue.length) {
              const x = queue.shift();
              const o = await ownerOf(x.v, ctl.signal);
              if (o) { x.chKey = o.k; x.chName = o.n; if (!x.t) x.t = o.t || ''; }
            }
          }));
          if (my !== run) return;
          for (const x of cand) {
            if (!x.chKey || seen.has(x.v)) continue;
            if (rec.fav.has(x.chKey)) continue;
            seen.add(x.v);
            rec.items.push({ v: x.v, t: x.t || '', p: null, n: x.n || 0, th: x.thumb || '', short: true, w: x.w || 0, ch: { key: x.chKey, name: x.chName, unsub: true } });
            added++;
          }
          if (first) status(`おすすめのショートを読み込み中… ${rec.items.length} 件`);
          if (rec.mode === 'end') break;
          continue;
        }
        const { items: list, token } = await YTAPI.recommended(first && tries === 1 ? null : rec.token, ctl.signal);
        if (my !== run) return;
        rec.token = token;
        for (const x of list) {
          if (!x.chKey || x.p === undefined || seen.has(x.v)) continue;
          if (rec.fav.has(x.chKey) || (x.chId && rec.fav.has('channel/' + x.chId))) continue; // 登録済みは除外
          seen.add(x.v);
          rec.items.push({ v: x.v, t: x.t, p: x.p, n: x.n, th: x.thumb, live: x.live, up: x.upcoming, w: x.w || 0, ch: { key: x.chKey, name: x.chName, unsub: true } });
          added++;
        }
        if (first) status(`おすすめを読み込み中… ${rec.items.length} 件`);
        if (!rec.token) break;
      }
      rec.at = Date.now();
    } catch (e) {
      if (my === run && !ctl.signal.aborted) status('おすすめの取得に失敗しました：' + e.message);
    } finally {
      rec.loading = false;
    }
    if (my !== run) return;
    if (first) paint(rec.items, '');
    else { items = rec.items; status(recHasMore() ? '' : 'これ以上のおすすめは見つかりませんでした（「更新」で読み直せます）'); more(); }
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
    else { items = items.concat(added); status(msg); more(); }
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

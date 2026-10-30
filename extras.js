// 新着件数・新着通知・連続再生・後で見る
//   recent:      登録チャンネルの新着（直近3日）[{ v, t, p, k:チャンネルキー, id:チャンネルID, n:チャンネル名, w:視聴% }]
//   folderSeen:  { フォルダID: 最後に開いた時刻 }（新着件数の起点）
//   notifyFolders: [フォルダID]   notified: [通知済みの動画ID]
//   later:       [{ v, t, p, th, ch:{key,name,unsub}, at }]
//   queue:       { title, items:[{ v, t }], i }
const TGX = (() => {
  const NEW_DAYS = 3, CHECK_MIN = 15, WATCHED = 90;
  const esc = TG.esc;

  // ---------- 新着の取得（YouTubeのタブで実行） ----------
  async function check({ force = false } = {}) {
    const now = Date.now();
    const { lastCheckAt = 0, checkLock = 0 } = await chrome.storage.local.get(['lastCheckAt', 'checkLock']);
    const iv = Math.max(5, (await TG.notifyRules()).interval || CHECK_MIN);
    if (!force && now - lastCheckAt < (iv - 0.5) * 60e3) return { skipped: true };
    if (now - checkLock < 90e3) return { busy: true }; // 他のタブが確認中
    await chrome.storage.local.set({ checkLock: now });
    try {
      const list = await YTAPI.subsFeed({ maxPages: 8, maxAge: NEW_DAYS * 864e5 });
      const recent = list.slice(0, 900).map(x => ({ v: x.v, t: x.t, p: x.p, d: x.dur || 0, k: x.chKey, id: x.chId, n: x.chName, w: x.w || 0, live: !!x.live, ...(x.upcoming ? { up: x.upcoming } : {}) }));
      await chrome.storage.local.set({ recent, lastCheckAt: Date.now() });
      await notifyNew(recent);
      TG.log('新着', `登録チャンネルの新着を確認：直近${NEW_DAYS}日 ${recent.length}本${force ? '（手動）' : ''}`);
      importHistory().catch(e => TG.log('履歴', '取り込みに失敗：' + e.message, 'error')); // 1時間に1回まで
      return { count: recent.length };
    } catch (e) {
      TG.log('新着', '新着の確認に失敗：' + e.message, 'error');
      throw e;
    } finally {
      await chrome.storage.local.set({ checkLock: 0 });
    }
  }

  // ---------- YouTubeの視聴履歴から取り込み（スマホ・テレビなど他の端末で見た分） ----------
  //   ・見た日と「どこまで見たか(%)」×長さ で視聴時間を推定（src:'yt'）
  //   ・このPCで同じ日に記録した動画は、PCの正確な記録を優先して数えない
  //   ・同じ動画・同じ日は二度数えない（ytHistSeen）
  async function importHistory({ force = false } = {}) {
    const now = Date.now();
    const st = await chrome.storage.local.get(['history', 'daily', 'ytHistSeen', 'lastHistImport', 'ytHistOn', 'dayYt']);
    if (st.ytHistOn === false && !force) return { off: true };
    if (!force && now - (st.lastHistImport || 0) < 60 * 60e3) return { skipped: true };
    const first = !st.ytHistSeen;
    const list = await YTAPI.watchHistory({ maxPages: first ? 15 : 4, stopBefore: first ? 0 : now - 10 * 864e5 });
    const history = st.history || {}, daily = st.daily || {}, seen = st.ytHistSeen || {}, dayYt = st.dayYt || {}; // dayYt … 日・チャンネルごとの秒（~s＝ショート）
    let added = 0, skippedPc = 0;
    for (const x of list) {
      if (x.day == null) continue;
      const dk = TG.dayKey(x.day);
      if (seen[x.v] === dk) continue;
      seen[x.v] = dk;
      const h = history[x.v];
      if (h && h.src !== 'yt' && TG.dayKey(h.last) === dk) { skippedPc++; continue; } // PCで記録済み
      if (h && (h.last || 0) >= x.day + 864e5) continue; // PCの記録の方が新しい
      const d = x.dur || h?.d || 0;
      const sec = Math.round(d ? (x.w ? (d * x.w) / 100 : Math.min(d, x.short ? d : 60)) : x.short ? 30 : 60);
      const last = dk === TG.dayKey(now) ? now : x.day + 12 * 3600e3; // 時刻は分からないので、その日の昼として扱う
      history[x.v] = {
        ...(h || {}),
        t: x.t || h?.t || '', ch: x.chName || h?.ch || '', k: x.chKey || h?.k || '',
        d: d || h?.d || 0, views: x.n || h?.views || 0, short: !!(x.short || h?.short),
        first: Math.min(h?.first || Infinity, last), last: Math.max(h?.last || 0, last),
        sec: (h?.sec || 0) + sec, src: h && h.src !== 'yt' ? 'mix' : 'yt', ytDay: dk, rate: h?.rate || ''
      };
      daily[dk] = (daily[dk] || 0) + sec;
      const yd = (dayYt[dk] ||= {}), ck = x.chKey || h?.k || (x.chName ? '#' + x.chName : '');
      yd[ck] = (yd[ck] || 0) + sec;
      if (x.short || h?.short) yd['~s'] = (yd['~s'] || 0) + sec;
      added++;
    }
    const keys = Object.keys(seen);
    if (keys.length > 8000) keys.slice(0, keys.length - 8000).forEach(k => delete seen[k]);
    const cutDay = TG.dayKey(now - 400 * 864e5);
    for (const d of Object.keys(dayYt)) if (d < cutDay) delete dayYt[d];
    await chrome.storage.local.set({ history, daily, ytHistSeen: seen, lastHistImport: now, dayYt });
    TG.log('履歴', `YouTubeの履歴を取り込み：${list.length}本を確認、${added}本を追加（PCの記録と重複 ${skippedPc}本）${force ? '（手動）' : ''}`);
    return { added, skippedPc, total: list.length };
  }

  // ---------- 通知 ----------
  //   フォルダごとのルール（すぐ／時間帯／キーワードだけ／オフ）・重要度・例外キーワード・配信 で決める
  //   すぐ知らせるもの → バックグラウンドへ tg-notify ／ 時間帯待ち → notifyQueue に入れ、時間になったらバックグラウンドが出す
  const LV = { high: 3, normal: 2, low: 1 };
  const MODE = { now: 4, kw: 3, window: 2, off: 0 };
  async function notifyNew(recent) {
    const d = await TG.load();
    const rules = await TG.notifyRules();
    const { notified, notifyQueue = [] } = await chrome.storage.local.get(['notified', 'notifyQueue']);
    const ids = new Set(recent.map(x => x.v));
    if (!Array.isArray(notified)) { // 初回は既存分を通知済み扱いにする
      await chrome.storage.local.set({ notified: [...ids, ...recent.filter(x => x.live).map(x => 'L:' + x.v), ...recent.filter(x => x.up > Date.now()).map(x => 'U:' + x.v)] });
      return;
    }
    const done = new Set(notified);
    const fmap = TG.folderMap(d.channels, d.folders);
    const subs = TG.matchSet(d.channels, Object.values(d.channels).filter(c => !c.unsub).map(c => c.key));
    const kws = TG.kwList(rules.kw).map(k => k.toLowerCase());
    const now = Date.now();
    const out = [], queue = [...notifyQueue];
    for (const x of recent) {
      const fs = fmap.get(x.k) || (x.id && fmap.get('channel/' + x.id)) || [];
      // 一番強い設定のフォルダを使う（すぐ ＞ キーワード ＞ 時間帯）
      let best = { mode: 'off', level: 'normal' }, folder = fs[0]?.name || '未分類';
      for (const f of fs) {
        const r = TG.ruleFor(rules, d.folders, f.id);
        if (MODE[r.mode] > MODE[best.mode] || (r.mode === best.mode && LV[r.level] > LV[best.level])) { best = r; folder = f.name; }
      }
      const base = { v: x.v, title: x.t, ch: x.n, folder };
      const isSub = subs.has(x.k) || (x.id && subs.has('channel/' + x.id));
      // 配信（登録チャンネル）
      if (rules.live.on && isSub && (rules.live.scope === 'all' || best.mode !== 'off')) {
        if (x.live && !done.has('L:' + x.v)) { done.add('L:' + x.v); done.add(x.v); out.push({ ...base, level: rules.live.level, kind: 'live' }); continue; }
        if (rules.live.upcoming && x.up > now && !done.has('U:' + x.v)) { done.add('U:' + x.v); done.add(x.v); out.push({ ...base, level: rules.live.level, kind: 'upcoming', at: x.up }); continue; }
      }
      if (done.has(x.v) || now - x.p > 864e5 || x.up > now) continue;
      const title = (x.t || '').toLowerCase();
      const hitKw = kws.find(k => title.includes(k));
      // 例外キーワード：含んでいればすぐ
      if (hitKw && (best.mode !== 'off' || (rules.kwAll && isSub))) {
        done.add(x.v); out.push({ ...base, level: rules.kwLevel, kind: 'kw', kw: hitKw }); continue;
      }
      if (best.mode === 'now') { done.add(x.v); out.push({ ...base, level: best.level, kind: 'new' }); continue; }
      if (best.mode === 'window') {
        done.add(x.v);
        const item = { ...base, level: best.level, kind: 'new' };
        if (TG.inWindow(best.from, best.to)) out.push(item);
        else queue.push({ ...item, due: TG.nextWindowStart(best.from) });
        continue;
      }
    }
    recent.forEach(x => done.add(x.v)); // 通知対象外の新着も記録（後でフォルダに入れても昔の動画は通知しない）
    await chrome.storage.local.set({ notified: [...done].slice(-3000), notifyQueue: queue.slice(-300) });
    if (queue.length > notifyQueue.length) TG.log('通知', `時間帯待ちに ${queue.length - notifyQueue.length}本（${new Date(Math.min(...queue.map(q => q.due))).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} から通知）`);
    if (out.length) chrome.runtime.sendMessage({ type: 'tg-notify', items: out }).catch(() => {});
  }

  // ---------- 新着件数 ----------
  // 戻り値: Map(フォルダID or '__unsorted' / '__all' → 件数)
  function newCounts(S, recent, watched, seen) {
    const now = Date.now();
    const res = new Map();
    if (!recent?.length) return res;
    // チャンネル → 直接入っているフォルダ（1回だけ作る）と、フォルダ → 親たち
    const fmap = TG.folderMap(S.channels, S.folders);
    const byId = new Map(S.folders.map(f => [f.id, f]));
    const ancestors = id => { const out = []; let f = byId.get(id); let g = 0; while (f && g++ < 50) { out.push(f.id); f = byId.get(f.parent); } return out; };
    const anc = new Map(S.folders.map(f => [f.id, ancestors(f.id)]));
    const hidden = new Set();
    for (const c of Object.values(S.channels)) if (c.hidden) { hidden.add(c.key); if (c.id) hidden.add('channel/' + c.id); }
    S.folders.forEach(f => res.set(f.id, 0));
    res.set('__unsorted', 0); res.set('__all', 0);
    for (const x of recent) {
      if (now - x.p > NEW_DAYS * 864e5 || x.up > now) continue;
      if (hidden.has(x.k) || (x.id && hidden.has('channel/' + x.id))) continue;
      if (Math.max(x.w || 0, watched[x.v]?.p || 0) >= WATCHED) continue;
      if (x.p > (seen.__all || 0)) res.set('__all', res.get('__all') + 1);
      const fs = fmap.get(x.k) || (x.id && fmap.get('channel/' + x.id)) || [];
      if (!fs.length) { if (x.p > (seen.__unsorted || 0)) res.set('__unsorted', res.get('__unsorted') + 1); continue; }
      const ids = new Set(fs.flatMap(f => anc.get(f.id) || [f.id])); // 親フォルダにも数える（重複なし）
      for (const id of ids) if (x.p > (seen[id] || 0)) res.set(id, res.get(id) + 1);
    }
    return res;
  }

  // フォルダを開いたら、そのフォルダ（と中のフォルダ）の新着を既読にする
  async function markSeen(S, id) {
    const { folderSeen = {} } = await chrome.storage.local.get('folderSeen');
    const now = Date.now();
    const key = id || '__all';
    if (folderSeen[key] && now - folderSeen[key] < 30e3) return;
    if (id && id !== '__unsorted') TG.subtreeIds(S.folders, id).forEach(x => { folderSeen[x] = now; });
    else folderSeen[key] = now;
    await chrome.storage.local.set({ folderSeen });
  }

  // ---------- 後で見る ----------
  async function getLater() {
    const { later = [] } = await chrome.storage.local.get('later');
    return later;
  }
  async function toggleLater(it) {
    const later = await getLater();
    const i = later.findIndex(x => x.v === it.v);
    if (i >= 0) {
      later.splice(i, 1);
      // 外したことを記録（別のPCと同期したときに戻ってこないように）
      const { laterRemoved = {} } = await chrome.storage.local.get('laterRemoved');
      laterRemoved[it.v] = Date.now();
      await chrome.storage.local.set({ laterRemoved });
    }
    else later.unshift({ v: it.v, t: it.t, p: it.p || 0, th: it.th || '', n: it.n || 0, ...(it.d ? { d: it.d } : {}), ...(it.list ? { list: it.list } : {}), ...(it.short ? { short: true } : {}), ch: { key: it.ch?.key || '', name: it.ch?.name || '', unsub: !!it.ch?.unsub }, at: Date.now() });
    await chrome.storage.local.set({ later: later.slice(0, 1000) });
    TG.log('後で見る', `${i < 0 ? '追加' : '外す'}：${it.t || it.v}（計 ${Math.min(later.length, 1000)}本）`);
    return i < 0;
  }

  // YouTube本体の「後で見る」から取り込む（TubeFolioの一覧から外したものは除く）
  async function importWatchLater() {
    const list = await YTAPI.watchLater();
    const later = await getLater();
    const { laterRemoved = {} } = await chrome.storage.local.get('laterRemoved');
    const have = new Set(later.map(x => x.v));
    const now = Date.now();
    let added = 0, skipped = 0;
    const add = [];
    list.forEach((x, i) => {
      if (have.has(x.v)) return;
      if (laterRemoved[x.v]) { skipped++; return; }
      add.push({ v: x.v, t: x.t, p: x.p || 0, th: x.thumb || '', n: x.n || 0, ch: { key: x.chKey || '', name: x.chName || '', unsub: false }, at: now - i, wl: true });
      added++;
    });
    if (added) await chrome.storage.local.set({ later: add.concat(later).slice(0, 1000) });
    TG.log('後で見る', `YouTubeの「後で見る」から取り込み：${list.length}本中 ${added}本を追加${skipped ? `（外したことのある ${skipped}本は除外）` : ''}`);
    return { total: list.length, added, skipped };
  }

  // ---------- 連続再生 ----------
  // opts.pick … 動画の終わりの20秒前に、続きの候補（4本）を出して選べるようにする
  async function startQueue(items, title, opts = {}) {
    if (!items.length) return false;
    await chrome.storage.local.set({ queue: { title, items: items.slice(0, 300).map(x => ({ v: x.v, t: x.t, ch: x.ch?.name || '', d: x.d || 0 })), i: 0, at: Date.now(), pick: !!opts.pick } });
    location.assign('/watch?v=' + encodeURIComponent(items[0].v));
    return true;
  }

  let Q = null;
  const curVid = () => (location.pathname === '/watch' ? new URLSearchParams(location.search).get('v') : null);

  async function syncQueue() {
    const { queue } = await chrome.storage.local.get('queue');
    Q = queue?.items?.length ? queue : null;
    renderQueue();
  }

  function renderQueue() {
    let box = document.getElementById('tg-queue');
    const v = curVid();
    const idx = Q ? Q.items.findIndex(x => x.v === v) : -1;
    if (!Q || idx < 0) { box?.remove(); return; }
    if (Q.i !== idx) { Q.i = idx; chrome.storage.local.set({ queue: Q }); }
    if (!box) {
      box = document.createElement('div');
      box.id = 'tg-queue';
      box.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.q === 'prev') go(Q.i - 1);
        if (b.dataset.q === 'next') go(Q.i + 1);
        if (b.dataset.q === 'stop') stopQueue();
        if (b.dataset.q === 'list') box.classList.toggle('open');
        if (b.dataset.jump) go(+b.dataset.jump);
      });
      document.body.appendChild(box);
    }
    const open = box.classList.contains('open');
    const rows = Q.items.map((x, i) =>
      `<button class="tg-q-row ${i === Q.i ? 'cur' : ''} ${i < Q.i ? 'done' : ''}" data-jump="${i}"><span>${i + 1}</span>${esc(x.t)}</button>`).join('');
    box.innerHTML = `<div class="tg-q-head">
        <span class="tg-q-title">▶ 連続再生：${esc(Q.title)}</span>
        <span class="tg-q-pos">${Q.i + 1} / ${Q.items.length}</span>
        <button data-q="prev" ${Q.i <= 0 ? 'disabled' : ''} title="前へ">⏮</button>
        <button data-q="next" ${Q.i >= Q.items.length - 1 ? 'disabled' : ''} title="次へ">⏭</button>
        <button data-q="list" title="一覧">☰</button>
        <button data-q="stop" title="連続再生をやめる">✕</button>
      </div><div class="tg-q-list">${rows}</div>`;
    box.classList.toggle('open', open);
    box.querySelector('.tg-q-row.cur')?.scrollIntoView({ block: 'nearest' });
  }

  async function go(i) {
    if (!Q || i < 0 || i >= Q.items.length) return;
    Q.i = i;
    await chrome.storage.local.set({ queue: Q });
    location.assign('/watch?v=' + encodeURIComponent(Q.items[i].v));
  }

  async function stopQueue() {
    Q = null;
    await chrome.storage.local.remove('queue');
    renderQueue();
  }

  // 動画が最後まで再生されたら次へ（広告の終了は無視）。候補から選んでいればその動画へ
  let picked = null;
  document.addEventListener('ended', e => {
    if (e.target.tagName !== 'VIDEO' || !Q) return;
    if (document.querySelector('#movie_player.ad-showing, .ad-showing')) return;
    const idx = Q.items.findIndex(x => x.v === curVid());
    if (idx < 0) return;
    if (picked != null) { const p = picked; picked = null; go(p); return; }
    if (idx >= Q.items.length - 1) { stopQueue(); return; }
    go(idx + 1);
  }, true);

  // ---------- 終わる30秒前に「次に見る動画」4本 ----------
  //   1本目：TubeFolioの連続再生中なら次の動画 ／ YouTubeの再生リストで見ているならリストの次の動画
  //   2本目以降：TubeFolioの「後で見る」からランダム（無ければYouTubeのおすすめ＝関連動画）
  //   出す場面（pickMode）：'auto'＝TubeFolioの後で見る・連続再生／YouTubeの再生リストのときだけ（初期・ほかの動画はふつうに再生）
  //                         'always'＝いつも ／ 'off'＝出さない
  const PICK_SEC = 30;
  let pickFor = null, pickMode = 'auto';
  chrome.storage.local.get(['pickMode', 'pickMig']).then(r => {
    // v4.27.6 で一時的に「いつも」に切り替えた分を元に戻す
    if (r.pickMig === 1 && r.pickMode === 'always') { r.pickMode = 'auto'; chrome.storage.local.set({ pickMode: 'auto', pickMig: 2 }); }
    pickMode = r.pickMode || 'auto';
  });
  chrome.storage.onChanged?.addListener(ch => { if (ch.pickMode) pickMode = ch.pickMode.newValue || 'auto'; });
  const listParam = () => new URLSearchParams(location.search).get('list');
  document.addEventListener('timeupdate', e => {
    const vEl = e.target;
    if (vEl.tagName !== 'VIDEO' || pickMode === 'off') return;
    if (document.querySelector('#movie_player.ad-showing')) return;
    const v = curVid();
    if (!v) return;
    const inQueue = Q?.pick && Q.items.some(x => x.v === v);
    const inList = !!listParam();
    if (!inQueue && !inList && pickMode !== 'always') return;
    const left = (vEl.duration || 0) - vEl.currentTime;
    if (!vEl.duration || !isFinite(left) || vEl.duration < 45) return;
    if (left <= PICK_SEC && left > 0.5 && pickFor !== v) { pickFor = v; showPicker(v, inQueue).catch(() => {}); }
    if (left > PICK_SEC + 5 && pickFor === v) { pickFor = null; document.getElementById('tg-pick')?.remove(); }
  }, true);
  // YouTubeの再生リスト（右側のリスト）で、今の次の動画
  function nextInYtList() {
    const rows = [...document.querySelectorAll('ytd-playlist-panel-renderer #items ytd-playlist-panel-video-renderer')];
    const i = rows.findIndex(r => r.hasAttribute('selected'));
    const r = i >= 0 ? rows[i + 1] : null;
    const a = r?.querySelector('a[href*="watch?v="]');
    const v = (a?.getAttribute('href') || '').match(/[?&]v=([\w-]{11})/)?.[1];
    if (!v) return null;
    return { v, t: (r.querySelector('#video-title')?.textContent || '').trim(), ch: (r.querySelector('#byline, #channel-name')?.textContent || '').trim(), url: a.getAttribute('href'), first: 'リストの次' };
  }
  async function showPicker(v, inQueue) {
    const player = document.querySelector('#movie_player');
    if (!player) return;
    const out = [];
    const skip = new Set([v]);
    // 1本目
    if (inQueue) {
      const idx = Q.items.findIndex(x => x.v === v);
      const n = Q.items[idx + 1];
      if (n) { out.push({ ...n, qi: idx + 1, first: '次' }); skip.add(n.v); }
    } else if (listParam()) {
      const n = nextInYtList();
      if (n) { out.push(n); skip.add(n.v); }
    }
    // 2本目以降：TubeFolioの後で見るからランダム
    const later = (await getLater()).filter(x => !skip.has(x.v) && !x.short);
    for (const x of later.sort(() => Math.random() - 0.5)) {
      if (out.length >= 4) break;
      out.push({ v: x.v, t: x.t, ch: x.ch?.name || '', d: x.d || 0, url: '/watch?v=' + x.v + (x.list ? '&list=' + x.list : ''), src: '後で見る' });
      skip.add(x.v);
    }
    // 足りなければYouTubeのおすすめ（関連動画）
    if (out.length < 4) {
      try {
        const rel = (await YTAPI.related(v)).filter(x => !skip.has(x.v) && !x.short && !x.live);
        for (const x of rel) { if (out.length >= 4) break; out.push({ v: x.v, t: x.t, ch: x.chName, d: x.dur || 0, url: '/watch?v=' + x.v, src: 'おすすめ' }); skip.add(x.v); }
      } catch { /* 取れなければそのまま */ }
    }
    if (!out.length || curVid() !== v) return;
    document.getElementById('tg-pick')?.remove();
    const dur = s => { s = Math.round(s || 0); if (!s) return ''; const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); };
    const box = document.createElement('div');
    box.id = 'tg-pick';
    const note = out[0].first ? '選ばなければ「' + out[0].first + '」を自動で再生' : '押すとその動画へ';
    box.innerHTML = `<div class="tg-pk-h"><b>次に見る動画</b><span>（${note}）</span><button class="tg-pk-x" title="閉じる">✕</button></div>
      <div class="tg-pk-list">${out.map((x, k) => `<button class="tg-pk-item ${x.first ? 'next' : ''}" data-k="${k}">
        <span class="tg-pk-th"><img src="https://i.ytimg.com/vi/${esc(x.v)}/mqdefault.jpg" alt="">${x.d ? `<i>${dur(x.d)}</i>` : ''}${x.first ? `<em>${esc(x.first)}</em>` : x.src ? `<em class="sub">${esc(x.src)}</em>` : ''}</span>
        <span class="tg-pk-t">${esc(x.t || '')}</span><span class="tg-pk-c">${esc(x.ch || '')}</span></button>`).join('')}</div>`;
    ['click', 'dblclick', 'mousedown', 'mouseup', 'keydown'].forEach(t => box.addEventListener(t, ev => ev.stopPropagation()));
    box.addEventListener('click', ev => {
      if (ev.target.closest('.tg-pk-x')) { box.remove(); return; }
      const b = ev.target.closest('.tg-pk-item');
      if (!b) return;
      const x = out[+b.dataset.k];
      if (x.qi != null) go(x.qi);
      else location.assign(x.url || '/watch?v=' + x.v);
    });
    player.appendChild(box);
  }

  return { importWatchLater, importHistory, check, newCounts, markSeen, getLater, toggleLater, startQueue, syncQueue, renderQueue, stopQueue };
})();

// フォルダ設定画面（YouTubeのメイン画面に全面表示）
const TGManager = (() => {
  const SVG = p => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${p}"/></svg>`;
  const I = {
    back: SVG('M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z'),
    gear: SVG('M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z'),
    list: SVG('M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z'),
    folder: SVG('M9.17 6l2 2H20v10H4V6h5.17M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z'),
    alert: SVG('M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z'),
    eye: SVG('M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z'),
    eyeOff: SVG('M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z'),
    sync: SVG('M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z'),
    edit: SVG('M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z'),
    del: SVG('M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z'),
    plus: SVG('M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z'),
    caret: SVG('M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z'),
    bellRing: SVG('M7.58 4.08L6.15 2.65C3.75 4.48 2.17 7.3 2.03 10.5h2c.15-2.65 1.51-4.97 3.55-6.42zm12.39 6.42h2c-.15-3.2-1.73-6.02-4.12-7.85l-1.42 1.43c2.02 1.45 3.39 3.77 3.54 6.42zM18 11c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2v-5zm-6 11c.14 0 .27-.01.4-.04.65-.14 1.18-.58 1.44-1.18.1-.24.15-.5.15-.78h-4c.01 1.1.9 2 2.01 2z'),
    bell: SVG('M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z'),
    bellOff: SVG('M20 18.69L7.84 6.14 5.27 3.49 4 4.76l2.8 2.8v.01c-.52.99-.8 2.16-.8 3.42v5l-2 2v1h13.73l2 2L21 19.72l-1-1.03zM12 22c1.11 0 2-.89 2-2h-4c0 1.11.89 2 2 2zm6-7.32V11c0-3.08-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68c-.15.03-.29.08-.42.12-.1.03-.2.07-.3.11h-.01c-.01 0-.01 0-.02.01-.23.09-.46.2-.68.31 0 0-.01 0-.01.01L18 14.68z'),
    unsub: SVG('M14 8c0-2.21-1.79-4-4-4S6 5.79 6 8s1.79 4 4 4 4-1.79 4-4zm3 2v2h6v-2h-6zM2 18v2h16v-2c0-2.66-5.33-4-8-4s-8 1.34-8 4z'),
    tag: SVG('M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z'),
    check: SVG('M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'),
    down: SVG('M7 10l5 5 5-5z'),
    cloud: SVG('M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3zM8 13h2.55v3h2.9v-3H16l-4-4z'),
    dl: SVG('M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z'),
    ul: SVG('M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z')
  };

  const PALETTE = [
    '#e53935', '#d81b60', '#ec407a', '#8e24aa', '#5e35b1', '#3949ab', '#1e88e5', '#039be5',
    '#00acc1', '#00897b', '#43a047', '#7cb342', '#c0ca33', '#fdd835', '#ffb300', '#fb8c00',
    '#f4511e', '#6d4c41', '#757575', '#546e7a', '#ffffff', '#000000'
  ];

  const BUCKETS = [
    { id: 'd10', label: '10日以内', max: 10, color: '#22c55e' },
    { id: 'm1', label: '1カ月以内', max: 30, color: '#84cc16' },
    { id: 'm3', label: '3カ月以内', max: 90, color: '#eab308' },
    { id: 'm9', label: '9カ月以内', max: 270, color: '#f97316' },
    { id: 'y1', label: '1年以内', max: 365, color: '#ef4444' },
    { id: 'old', label: '1年以上', max: Infinity, color: '#991b1b' },
    { id: 'none', label: '動画なし・未取得', max: null, color: '#6b7280' }
  ];
  const bucketOf = m => {
    if (!m?.last) return BUCKETS[6];
    const d = (Date.now() - m.last) / 864e5;
    return BUCKETS.find(b => b.max !== null && d <= b.max);
  };
  const esc = TG.esc;
  // 取り直しが必要なもの：未取得・失敗・日付が読めなかった・旧版で「ショートのみ」と判定したもの
  const isMissing = m => !m?.last && (!m?.shortsOnly || !m.v2);

  function freq(iv) {
    if (iv == null || !isFinite(iv) || iv <= 0) return '';
    if (iv < 1) return `1日に約 ${Math.max(1, Math.round(1 / iv))} 本`;
    return `平均 ${iv < 10 ? iv.toFixed(1).replace(/\.0$/, '') : Math.round(iv)} 日ごと`;
  }
  function fmt(t) {
    const d = new Date(t);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  let host = null, $ = null, st = null, abort = null, prevOverflow = '', saveT = null, dragging = null;
  const q = s => $.querySelector(s);

  // ---------- 開閉 ----------
  async function open(view = 'all') {
    if (view === 'focus') { // 集中モードの設定を直接開く
      if (!host) await open('all');
      return openSettings('focus');
    }
    if (host) return;
    const d = await TG.load();
    const { savedAt = null } = await chrome.storage.local.get('savedAt');
    d.folders.forEach(f => { f.parent ??= null; });
    if (TG.dedupe(d)) await TG.saveData({ channels: d.channels, folders: d.folders }); // 過去にできた重複をまとめる
    st = {
      channels: structuredClone(d.channels), folders: structuredClone(d.folders), meta: d.meta,
      view, bucket: null, q: '', sort: 'recent', sel: new Set(), saving: false, savedAt,
      progress: '', shown: [], busy: false, bulkFolder: null, pop: null,
      thumbMode: (await chrome.storage.local.get('mgrThumbs')).mgrThumbs || 'none',
      thumbCount: (await chrome.storage.local.get('mgrThumbCount')).mgrThumbCount || 4,
      assign: 'all',
      assist: !!(await chrome.storage.local.get('assistOn')).assistOn,
      titles: (await chrome.storage.local.get('chTitles')).chTitles || {},
      rules: { ...RULES_DEF, ...((await chrome.storage.local.get('assistRules')).assistRules || {}) },
      nrules: await TG.notifyRules(),
      notify: new Set(),
      thumbs: (await chrome.storage.local.get('chThumbs')).chThumbs || {}
    };
    syncNotifySet();
    host = document.createElement('div');
    host.id = 'tg-manager';
    $ = host.attachShadow({ mode: 'open' });
    $.innerHTML = `<style>${CSS}</style>${SKELETON}`;
    q('.app').classList.toggle('light', !document.documentElement.hasAttribute('dark'));
    ['keydown', 'keyup', 'keypress'].forEach(t => host.addEventListener(t, e => e.stopPropagation()));
    document.documentElement.appendChild(host);
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey, true);
    st.sync = (await chrome.storage.local.get('sync')).sync || {};
    chrome.storage.onChanged.addListener(onExternal);
    bind();
    renderAll();
    if (Object.keys(st.channels).length) refreshMeta(false);
  }

  // 別のタブやページ（📁＋ボタン等）での変更を取り込む。保存待ちの変更がある間は上書きしない
  async function onExternal(ch) {
    if (!host) return;
    if (ch.sync) { st.sync = ch.sync.newValue || {}; renderHeader(); }
    if (!ch.savedAt || ch.savedAt.newValue === st.savedAt || saveT || st.saving) return;
    const d = await TG.load();
    Object.assign(st, { channels: structuredClone(d.channels), folders: structuredClone(d.folders), savedAt: ch.savedAt.newValue });
    if (st.view !== 'all' && st.view !== 'unsorted' && st.view !== 'hidden' && !st.folders.some(f => f.id === st.view)) st.view = 'all';
    renderAll();
  }

  function close() {
    if (!host) return;
    chrome.storage.onChanged.removeListener(onExternal);
    flush();
    abort?.abort();
    document.removeEventListener('keydown', onKey, true);
    host.remove();
    host = null;
    document.body.style.overflow = prevOverflow;
  }

  function onKey(e) {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    if (st.pop) hidePop();
    else close();
  }

  // ---------- 自動保存 ----------
  function persist() {
    st.saving = true;
    renderHeader();
    clearTimeout(saveT);
    saveT = setTimeout(() => { saveT = null; writeNow(); }, 350);
  }
  function flush() {
    if (!saveT) return;
    clearTimeout(saveT);
    saveT = null;
    writeNow();
  }
  async function writeNow() {
    st.savedAt = Date.now();
    await chrome.storage.local.set({ channels: st.channels, folders: st.folders, savedAt: st.savedAt });
    st.saving = false;
    if (host) renderHeader();
  }

  // ---------- 骨組み ----------
  const SKELETON = `
  <div class="app">
    <header>
      <button class="icon" data-act="close" title="閉じる (Esc)">${I.back}</button>
      <h1>${I.gear}フォルダ設定</h1>
      <span class="spacer"></span>
      <span class="progress"></span>
      <button data-act="import" class="imp">${I.sync}<span>登録チャンネルを読み込む</span></button>
      <button data-act="refresh" class="ref">更新情報を取得</button>
      <button class="missing" data-act="missing">未取得だけ取得</button>
      <span class="status"></span>
      <button class="icon setbtn" data-act="settings" title="設定（バックアップ・同期／振り分け補助／コメント）">${I.gear}</button>
    </header>
    <div class="body">
      <aside>
        <div class="aside-title">フォルダ</div>
        <form class="newfolder"><input placeholder="新しいフォルダ名" maxlength="40"><button>追加</button></form>
        <nav class="views"></nav>
        <div class="notifybox">
          <div class="nb-title">新着通知</div>
          <p class="help">フォルダにマウスを乗せて🔔で通知のオン／オフ。タイミング（すぐ・夜だけ等）・重要度・キーワード・配信の通知は右上の ⚙ →「🔔 通知」で設定します。</p>
          <button data-act="checknow">今すぐ新着を確認</button> <button data-act="settab" data-tab="notify">🔔 通知の設定</button>
        </div>
        <p class="help">フォルダを選ぶと、そのフォルダのチャンネルだけを表示します。<br>
          各チャンネルの下のボタンを押すとフォルダに出し入れできます（複数フォルダOK）。<br>
          フォルダはドラッグで並べ替え・ほかのフォルダの中へ移動できます。チャンネルをフォルダへドラッグして追加することもできます。<br>
          チェックして「非表示」にしたチャンネルは、登録チャンネルの一覧に表示されなくなります（行の 👁 で戻せます）。<br>
          変更は自動で保存されます。</p>
      </aside>
      <main>
        <div class="stats"></div>
        <div class="sticky">
        <div class="toolbar">
          <input class="search" placeholder="チャンネル名で検索">
          <select class="sort">
            <option value="recent">最終投稿が新しい順</option>
            <option value="old">最終投稿が古い順</option>
            <option value="freq">投稿頻度が高い順</option>
            <option value="name">名前順</option>
          </select>
          <button class="assistbtn" data-act="assist" title="未分類チャンネルにフォルダの候補を表示（候補の出し方は右上の ⚙ → 振り分け補助）">🪄 振り分け補助</button>
          <button class="bulkassist" data-act="bulkassist" hidden></button>
          <select class="assign" title="フォルダの振り分け状態で絞り込み">
            <option value="all">振り分け：すべて</option>
            <option value="done">振り分け済みのみ</option>
            <option value="none">未振り分けのみ</option>
          </select>
          <select class="thumbsel" title="チャンネル名の横に表示するサムネイル">
            <option value="none">サムネ：なし</option>
            <option value="latest">サムネ：最新</option>
            <option value="popular">サムネ：人気</option>
          </select>
          <select class="cntsel" title="サムネイルの本数">
            <option value="2">本数：2</option>
            <option value="3">本数：3</option>
            <option value="4">本数：4</option>
          </select>
          <span class="spacer"></span>
          <span class="shown"></span>
        </div>
        <div class="bulk" hidden></div>
        </div>
        <div class="list"></div>
      </main>
    </div>
    <div class="pop" hidden></div>
  </div>`;

  function bind() {
    q('.app').addEventListener('click', onClick);
    let searchT = null;
    q('.search').addEventListener('input', e => {
      clearTimeout(searchT);
      searchT = setTimeout(() => { st.q = e.target.value.trim().toLowerCase(); st.rendered = 0; renderList(); }, 200);
    });
    q('.sort').addEventListener('change', e => { st.sort = e.target.value; st.rendered = 0; renderList(); });
    q('.assign').addEventListener('change', e => { st.assign = e.target.value; st.rendered = 0; renderList(); });
    q('.thumbsel').addEventListener('change', e => {
      st.thumbMode = e.target.value;
      chrome.storage.local.set({ mgrThumbs: st.thumbMode });
      renderHeader(); renderList();
    });
    q('.cntsel').addEventListener('change', e => {
      st.thumbCount = +e.target.value;
      chrome.storage.local.set({ mgrThumbCount: st.thumbCount });
      renderHeader(); renderList();
    });
    q('.newfolder').addEventListener('submit', e => {
      e.preventDefault();
      const input = e.target.querySelector('input');
      const n = input.value.trim();
      if (!n) return;
      st.folders.push(TG.newFolder(n, st.folders.length));
      input.value = '';
      persist();
      renderAll();
    });
    q('.bulk').addEventListener('change', e => { if (e.target.matches('select')) st.bulkFolder = e.target.value; });
    q('main').addEventListener('scroll', () => { if (st.pop) hidePop(); }, { passive: true });
    // カラーパレットのカスタム色
    q('.pop').addEventListener('input', e => {
      if (!e.target.matches('input[type=color]')) return;
      const f = folder(st.pop?.f);
      if (!f) return;
      f.color = e.target.value;
      persist();
      renderAside();
    });
    q('.pop').addEventListener('change', e => { if (e.target.matches('input[type=color]')) renderList(); });
    bindDrag();
  }

  // ---------- ドラッグ＆ドロップ ----------
  function clearMarks() {
    $.querySelectorAll('.drop-before,.drop-after,.drop-inside,.over').forEach(x => x.classList.remove('drop-before', 'drop-after', 'drop-inside', 'over'));
  }
  function bindDrag() {
    const views = q('.views');
    const list = q('.list');

    views.addEventListener('dragstart', e => {
      const it = e.target.closest('.vi[data-f]');
      if (!it) return;
      dragging = { kind: 'folder', id: it.dataset.f };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', it.dataset.f);
      q('.app').classList.add('dragging-folder');
    });
    list.addEventListener('dragstart', e => {
      const row = e.target.closest('.row');
      if (!row) return;
      const key = row.dataset.key;
      const keys = st.sel.has(key) ? [...st.sel] : [key];
      dragging = { kind: 'keys', keys };
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', keys.join('\n'));
      q('.app').classList.add('dragging-keys');
    });
    const end = () => { dragging = null; clearMarks(); q('.app').classList.remove('dragging-folder', 'dragging-keys'); };
    views.addEventListener('dragend', end);
    list.addEventListener('dragend', end);

    views.addEventListener('dragover', e => {
      if (!dragging) return;
      clearMarks();
      dragging.target = null;
      const root = e.target.closest('.rootdrop');
      if (root && dragging.kind === 'folder') {
        root.classList.add('over');
        dragging.target = '__root';
        e.preventDefault();
        return;
      }
      const it = e.target.closest('.vi[data-f]');
      if (!it) return;
      const tid = it.dataset.f;
      if (dragging.kind === 'folder') {
        if (TG.subtreeIds(st.folders, dragging.id).has(tid)) return;
        const r = it.getBoundingClientRect();
        const y = (e.clientY - r.top) / r.height;
        dragging.zone = y < 0.28 ? 'before' : y > 0.72 ? 'after' : 'inside';
      } else {
        dragging.zone = 'inside';
      }
      dragging.target = tid;
      it.classList.add('drop-' + dragging.zone);
      e.preventDefault();
    });
    views.addEventListener('dragleave', e => { if (!views.contains(e.relatedTarget)) clearMarks(); });

    views.addEventListener('drop', e => {
      if (!dragging?.target) return;
      e.preventDefault();
      const d = dragging;
      if (d.kind === 'folder') {
        st.folders = d.target === '__root'
          ? TG.moveFolder(st.folders, d.id, null, 'root')
          : TG.moveFolder(st.folders, d.id, d.target, d.zone);
      } else {
        const f = folder(d.target);
        const set = new Set(f.keys);
        d.keys.forEach(k => set.add(k));
        f.keys = [...set];
        setProgress(`「${f.name}」に ${d.keys.length} 件追加しました`);
      }
      dragging = null;
      clearMarks();
      q('.app').classList.remove('dragging-folder', 'dragging-keys');
      persist();
      renderAll();
    });
  }

  // ---------- 状態 ----------
  const folder = id => st.folders.find(f => f.id === id);
  function inView(c, viewKeys, inAny) {
    switch (st.view) {
      case 'all': return !c.hidden;
      case 'hidden': return !!c.hidden;
      case 'unsorted': return !c.hidden && !inAny.has(c.key);
      default: return !!viewKeys?.has(c.key);
    }
  }
  function viewChannels() {
    const viewKeys = folder(st.view) ? TG.folderKeys(st.folders, st.view) : null;
    const inAny = new Set(st.folders.flatMap(f => f.keys));
    return Object.values(st.channels).filter(c => inView(c, viewKeys, inAny));
  }
  function setProgress(t) { st.progress = t; if (host) q('.progress').textContent = t; }

  // ---------- 描画 ----------
  function renderAll() { renderHeader(); renderAside(); renderStats(); renderList(); renderBulk(); }

  function renderHeader() {
    if (!host) return;
    const sy = st.sync || {};
    let drv = '';
    if (sy.connected) {
      if (sy.needReauth) drv = ' ／ Drive：再接続が必要（⚙）';
      else if (sy.lastError && (sy.lastErrorAt || 0) > (sy.lastSyncAt || 0)) drv = ' ／ Drive：保存できていません';
      else if (st.savedAt && sy.syncedSavedAt === st.savedAt) drv = ' ／ Drive保存済み';
      else drv = ' ／ Driveへ保存待ち';
    }
    q('.status').textContent = (st.saving ? '保存中…' : st.savedAt ? `自動保存済み・${fmt(st.savedAt)}` : '') + drv;
    q('.status').classList.toggle('warn', drv.includes('できていません') || drv.includes('再接続'));
    q('.ref').textContent = abort ? '取得を中止' : '更新情報を取得';
    q('.thumbsel').value = st.thumbMode;
    q('.cntsel').value = String(st.thumbCount);
    q('.assistbtn').classList.toggle('on', st.assist);
    q('.assistbtn').textContent = st.assist ? '🪄 振り分け補助：オン' : '🪄 振り分け補助：オフ';
    updateBulkAssist();
    q('.cntsel').hidden = st.thumbMode === 'none';
    const miss = Object.values(st.channels).filter(c => isMissing(st.meta[c.key])).length;
    q('.missing').textContent = `未取得だけ取得（${miss}）`;
    q('.missing').disabled = !miss;
    q('.imp').disabled = st.busy;
    q('.progress').textContent = st.progress;
  }

  function renderAside() {
    const all = Object.values(st.channels);
    const inAny = new Set(st.folders.flatMap(f => f.keys));
    const count = set => [...set].filter(k => st.channels[k]).length;
    const vi = (v, icon, name, ct, o = {}) =>
      `<div class="vi ${st.view === v ? 'on' : ''}" data-act="view" data-v="${esc(v)}" ${o.drag ? `draggable="true" data-f="${esc(v)}"` : ''}
        style="padding-left:${6 + (o.depth || 0) * 18}px">${o.caret || '<span class="caret-sp"></span>'}${icon}<span class="nm">${esc(name)}</span><span class="ct">${ct}</span>${o.ops || ''}</div>`;

    let h = vi('all', I.list, 'すべてのチャンネル', all.filter(c => !c.hidden).length);
    for (const { f, depth, hidden } of TG.tree(st.folders)) {
      if (hidden) continue;
      const kids = TG.hasChildren(st.folders, f.id);
      const caret = kids
        ? `<button class="caret ${f.collapsed ? '' : 'open'}" data-act="collapse" data-f="${f.id}" title="${f.collapsed ? '開く' : '閉じる'}">${I.caret}</button>`
        : '<span class="caret-sp"></span>';
      const ops = `<span class="ops">
        <button class="fdot" data-act="palette" data-f="${f.id}" title="色・アイコンを変更" style="background:${esc(f.color)}"></button>
        <button data-act="notify" data-f="${f.id}" title="${st.notify.has(f.id) ? '新着通知をオフ' : '新着通知をオン'}">${st.notify.has(f.id) ? I.bellRing : I.bellOff}</button>
        <button data-act="subfolder" data-f="${f.id}" title="この中にフォルダを追加">${I.plus}</button>
        <button data-act="kw" data-f="${f.id}" title="振り分け補助のキーワード">${I.tag}</button>
        <button data-act="rename" data-f="${f.id}" title="名前を変更">${I.edit}</button>
        <button data-act="delfolder" data-f="${f.id}" title="フォルダを削除">${I.del}</button></span>`;
      h += vi(f.id, `<span class="fi" style="color:${esc(f.color)}">${TG.iconHtml(f, I.folder)}</span>`, f.name + (st.notify.has(f.id) ? ' 🔔' : ''),
        count(TG.folderKeys(st.folders, f.id)), { depth, caret, ops, drag: true });
    }
    if (st.folders.length) h += '<div class="rootdrop">ここにドロップでトップ階層へ</div>';
    h += '<hr>';
    h += vi('unsorted', I.alert, '未分類', all.filter(c => !c.hidden && !inAny.has(c.key)).length);
    h += vi('hidden', I.eyeOff, '非表示', all.filter(c => c.hidden).length);
    q('.views').innerHTML = h;
  }

  function renderStats() {
    const counts = Object.fromEntries(BUCKETS.map(b => [b.id, 0]));
    viewChannels().forEach(c => counts[bucketOf(st.meta[c.key]).id]++);
    let shortsN = 0, missN = 0;
    viewChannels().forEach(c => { const m = st.meta[c.key]; if (!m?.last) { if (isMissing(m)) missN++; else shortsN++; } });
    q('.stats').innerHTML = BUCKETS.map(b =>
      `<button class="card ${st.bucket === b.id ? 'on' : ''}" data-act="bucket" data-b="${b.id}">
        <span class="lb"><i class="dot" style="background:${b.color}"></i>${b.label}</span>
        <span class="n">${counts[b.id]}</span>
        ${b.id === 'none' && counts.none ? `<span class="sub">ショートのみ ${shortsN}・未取得 ${missN}</span>` : ''}</button>`).join('');
  }

  function sorted(list) {
    const L = c => st.meta[c.key]?.last;
    const IV = c => st.meta[c.key]?.interval;
    const by = {
      recent: (a, b) => (L(b) || 0) - (L(a) || 0),
      old: (a, b) => (L(a) ?? Infinity) - (L(b) ?? Infinity),
      freq: (a, b) => (IV(a) ?? Infinity) - (IV(b) ?? Infinity),
      name: (a, b) => (a.name || '').localeCompare(b.name || '', 'ja')
    }[st.sort];
    return list.sort(by);
  }

  function metaHtml(c) {
    const m = st.meta[c.key];
    const b = bucketOf(m);
    let h = `<span class="badge"><i class="dot" style="background:${b.color}"></i>${b.label}</span>`;
    if (m?.last) {
      h += `<span>最終投稿 ${TG.rel(m.last)}</span>`;
      if (m.interval != null) h += `<span class="fq">${freq(m.interval)}</span>`;
    } else {
      h += `<span class="${m?.error ? 'errtxt' : ''}">${m?.shortsOnly && m.v2 ? `ショートのみ（${m.count}本・投稿日は取得できません）` : m?.nodate ? '投稿日を読み取れませんでした（再取得します）' : m?.error ? '取得失敗（「未取得だけ取得」で再取得）' : m?.at ? '動画なし' : '未取得'}</span>`;
    }
    if (c.unsub) h += '<span class="unsubtag">登録解除済み</span>';
    return h;
  }

  function rowHtml(c, tree) {
    const av = c.thumb
      ? `<img class="av" src="${esc(c.thumb)}" loading="lazy" referrerpolicy="no-referrer" alt="">`
      : `<div class="av ph">${esc((c.name || '?').slice(0, 1))}</div>`;
    // 入っているフォルダだけ表示（✕で外す）。追加・変更は「＋ フォルダ」の一覧から
    const mine = tree.filter(({ set }) => set.has(c.key));
    const chips = st.folders.length ? mine.map(({ f, depth }) =>
      `<button class="chip on" data-act="toggle" data-f="${f.id}" style="--c:${esc(f.color)}" title="「${esc(f.name)}」から外す">${esc(depth ? TG.pathName(st.folders, f) : f.name)}<span class="x">✕</span></button>`).join('') +
      `<button class="chip add ${mine.length ? '' : 'first'}" data-act="picker">＋ ${mine.length ? 'フォルダ' : 'フォルダに追加'}</button>` : '';
    const subBtn = c.unsub
      ? `<button class="subbtn join" data-act="subscribe">チャンネル登録</button>`
      : `<button class="subbtn" data-act="submenu">${I.bell}<span>登録済み</span>${I.down}</button>`;
    return `<div class="row ${st.sel.has(c.key) ? 'selected' : ''} ${c.hidden ? 'is-hidden' : ''}" data-key="${esc(c.key)}" draggable="true">
      <input type="checkbox" data-act="sel" ${st.sel.has(c.key) ? 'checked' : ''}>
      ${av}
      <div class="info">
        <a class="name" href="${esc(TG.channelUrl(c.key))}" target="_blank" rel="noopener" draggable="false">${esc(c.name || c.key)}</a>
        <div class="meta">${metaHtml(c)}</div>
        <div class="chips">${chips || '<span class="nofolder">左の「新しいフォルダ名」からフォルダを作ると、ここで振り分けられます</span>'}</div>
        ${st.assist && !inAnyFolder(c.key) ? `<div class="sugg" data-k="${esc(c.key)}">${suggHtml(c)}</div>` : ''}
      </div>
      ${st.thumbMode !== 'none' ? `<div class="strip" data-k="${esc(c.key)}">${stripHtml(c.key)}</div>` : ''}
      <div class="right">
        ${subBtn}
        ${c.hidden ? `<button class="icon eye off" data-act="hide" title="非表示中（押すと表示に戻す）">${I.eyeOff}</button>` : ''}
      </div>
    </div>`;
  }

  const chipTree = () => TG.tree(st.folders).map(({ f, depth }) => ({ f, depth, set: new Set(f.keys) }));

  function renderList() {
    let list = viewChannels();
    if (st.bucket) list = list.filter(c => bucketOf(st.meta[c.key]).id === st.bucket);
    if (st.assign !== 'all') {
      const inAny = new Set(st.folders.flatMap(f => f.keys));
      list = list.filter(c => inAny.has(c.key) === (st.assign === 'done'));
    }
    if (st.q) list = list.filter(c => (c.name || '').toLowerCase().includes(st.q) || c.key.toLowerCase().includes(st.q));
    sorted(list);
    st.shown = list.map(c => c.key);
    const total = Object.keys(st.channels).length;
    q('.shown').textContent = `${list.length} / ${total} チャンネル`;
    const tree = chipTree();
    const el = q('.list');
    if (!total) {
      el.innerHTML = `<div class="empty"><h2>まだチャンネルがありません</h2>
        <p>YouTubeで登録しているチャンネルを一括で読み込めます。</p>
        <button class="primary big" data-act="import">${I.sync}<span>登録チャンネルを読み込む</span></button></div>`;
    } else if (!list.length) {
      el.innerHTML = '<div class="empty"><p>該当するチャンネルはありません</p></div>';
    } else {
      // 一度に全部は作らず60行ずつ（スクロールで追加）。970行を一度に作ると重いため
      const keep = Math.max(ROWS, st.rendered || 0);
      st.listCache = list;
      st.rendered = 0;
      el.innerHTML = '<div class="list-more"></div>';
      moreRows(keep, tree);
    }
  }

  const ROWS = 60;
  let rowsIO = null;
  function moreRows(n = ROWS, tree = chipTree()) {
    const el = q('.list');
    const sentinel = el.querySelector('.list-more');
    const part = (st.listCache || []).slice(st.rendered, st.rendered + n);
    if (!part.length || !sentinel) return;
    sentinel.insertAdjacentHTML('beforebegin', part.map(c => rowHtml(c, tree)).join(''));
    st.rendered += part.length;
    observeStrips();
    observeSugg();
    rowsIO?.disconnect();
    if (st.rendered < st.listCache.length) {
      rowsIO = new IntersectionObserver(ents => { if (ents.some(e => e.isIntersecting)) moreRows(); }, { root: q('main'), rootMargin: '600px' });
      rowsIO.observe(sentinel);
    }
  }

  const rowEl = key => q('.list').querySelector(`.row[data-key="${globalThis.CSS.escape(key)}"]`);
  function renderRow(key) {
    const old = rowEl(key);
    const c = st.channels[key];
    if (!old || !c) return;
    const t = document.createElement('template');
    t.innerHTML = rowHtml(c, chipTree()).trim();
    old.replaceWith(t.content.firstElementChild);
  }
  function updateRowMeta(key) {
    const m = rowEl(key)?.querySelector('.meta');
    if (m && st.channels[key]) m.innerHTML = metaHtml(st.channels[key]);
  }

  // ---------- 最新 / 人気のサムネイル ----------
  const THUMB_TTL = { latest: 6 * 3600e3, popular: 24 * 3600e3 };
  let stripIO = null, thumbQueue = [], thumbBusy = 0, thumbSaveT = null;
  function stripHtml(key) {
    const e = st.thumbs[key]?.[st.thumbMode];
    const n = st.thumbCount;
    if (!e) return '<span class="th"><span class="tp sk"></span><span class="tt sk"></span></span>'.repeat(n);
    if (e.error) return '<span class="strip-msg">取得できませんでした</span>';
    if (!e.items.length) return '<span class="strip-msg">動画なし</span>';
    return e.items.slice(0, n).map(x => `<a class="th" href="https://www.youtube.com/watch?v=${esc(x.v)}" target="_blank" rel="noopener" title="${esc(x.t)}" draggable="false">
      <span class="tp"><img src="https://i.ytimg.com/vi/${esc(x.v)}/mqdefault.jpg" loading="lazy" alt="" referrerpolicy="no-referrer"></span>
      <span class="tt">${esc(x.t)}</span></a>`).join('');
  }
  function observeStrips() {
    stripIO?.disconnect();
    if (st.thumbMode === 'none') return;
    stripIO = new IntersectionObserver(ents => {
      for (const en of ents) {
        if (!en.isIntersecting) continue;
        stripIO.unobserve(en.target);
        const key = en.target.dataset.k;
        const e = st.thumbs[key]?.[st.thumbMode];
        if (!e || Date.now() - e.at > THUMB_TTL[st.thumbMode]) { thumbQueue.push([key, st.thumbMode]); pumpThumbs(); }
      }
    }, { root: q('main'), rootMargin: '400px' });
    $.querySelectorAll('.strip').forEach(x => stripIO.observe(x));
  }
  function pumpThumbs() {
    while (thumbBusy < 3 && thumbQueue.length) {
      const [key, mode] = thumbQueue.shift();
      const c = st.channels[key];
      if (!c) continue;
      thumbBusy++;
      (async () => {
        let entry;
        try {
          const id = await ensureId(c);
          if (!id) throw new Error();
          const list = mode === 'popular' ? await YTAPI.channelPopular(id) : await YTAPI.channelTab(id, 'video');
          entry = { at: Date.now(), items: list.slice(0, 4).map(x => ({ v: x.v, t: x.t })) };
        } catch {
          entry = { at: Date.now() - THUMB_TTL[mode] + 600e3, items: [], error: true }; // 失敗は10分後に再挑戦
        }
        (st.thumbs[key] ||= {})[mode] = entry;
        if (host && mode === st.thumbMode) {
          const strip = [...$.querySelectorAll('.strip')].find(x => x.dataset.k === key);
          if (strip) strip.innerHTML = stripHtml(key);
        }
        clearTimeout(thumbSaveT);
        thumbSaveT = setTimeout(() => chrome.storage.local.set({ chThumbs: st.thumbs }), 2000);
      })().finally(() => { thumbBusy--; if (host) pumpThumbs(); });
    }
  }

  // ---------- 振り分け補助 ----------
  const defaultKw = name => TG.defaultKw(name);
  // 候補の出し方（フォルダ設定の 🪄 の横の ⚙ で変更）
  const RULES_DEF = {
    nameScore: 3,     // チャンネル名に含まれる
    titleScore: 1,    // 最近の動画タイトル1本につき
    titleCount: 15,   // 見る動画タイトルの本数
    minScore: 2,      // 候補に出す最低点
    bulkMin: 4,       // 「まとめて適用」の最低点
    maxSugg: 3,       // 1チャンネルに出す候補の数
    useDict: true,    // キーワード未設定のフォルダは、フォルダ名から自動で作る
    fuzzy: true,      // ひらがな／カタカナ・全角／半角・大文字／小文字を区別しない
    useShorts: true,  // 動画が無いチャンネルはショートのタイトルを見る
    subfolder: true,  // 中のフォルダ（サブフォルダ）も候補にする
    useDesc: true,    // 動画の概要欄・チャンネルの説明も見る
    descScore: 1,     // 概要欄（1本）・説明文に入っている
    descCount: 3,     // 見る概要欄の本数
    useTr: false,     // 文字起こし（字幕）も見る（時間がかかる）
    trScore: 1,       // 文字起こし（1本）に入っている
    trCount: 1        // 見る文字起こしの本数
  };
  // 文字のゆれをそろえる（ｶﾀｶﾅ→カタカナ→ひらがな、全角英数→半角、小文字）
  const norm = t => {
    t = String(t || '');
    if (!st.rules.fuzzy) return t.toLowerCase();
    return t.normalize('NFKC').toLowerCase().replace(/[\u30a1-\u30f6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
  };
  // キーワード：「-言葉」は除外（その言葉があるとそのフォルダは候補に出さない）
  function kwOf(f) {
    const src = f.kw?.length ? f.kw : st.rules.useDict ? defaultKw(f.name) : [];
    const inc = [], exc = [];
    for (const x of src) {
      const k = x.trim();
      if (!k) continue;
      if (/^[-－ー]/.test(k) && k.length > 1) exc.push(norm(k.slice(1))); else inc.push(norm(k));
    }
    return { inc, exc };
  }
  const inAnyFolder = key => st.folders.some(f => f.keys.includes(key));

  // 候補：チャンネル名に含まれる＝nameScore点、最近の動画タイトルに含まれる＝1本につき titleScore点
  // 候補：名前・タイトル・概要欄（＋チャンネルの説明）・文字起こしにキーワードが何回出るかで点数
  const normCache = new Map();
  function textsOf(c) {
    const R = st.rules, e = st.titles[c.key] || {};
    const sig = [e.at, R.fuzzy, R.titleCount, R.useDesc, R.descCount, R.useTr, R.trCount].join('|');
    const hit = normCache.get(c.key);
    if (hit && hit.sig === sig) return hit;
    const o = {
      sig, name: norm(c.name),
      titles: (e.t || []).slice(0, R.titleCount).map(norm),
      descs: R.useDesc ? [...(e.d || []).slice(0, R.descCount), e.cd || ''].filter(Boolean).map(norm) : [],
      trs: R.useTr ? (e.tr || []).slice(0, R.trCount).filter(Boolean).map(norm) : []
    };
    normCache.set(c.key, o);
    return o;
  }
  function suggest(c) {
    const R = st.rules;
    const { name, titles, descs, trs } = textsOf(c);
    const all = [name, ...titles, ...descs, ...trs];
    const res = [];
    for (const f of st.folders) {
      if (!R.subfolder && f.parent) continue;
      const { inc, exc } = kwOf(f);
      if (exc.some(k => all.some(t => t.includes(k)))) continue;
      const by = { n: 0, t: 0, d: 0, r: 0 };
      for (const k of inc) {
        if (name.includes(k)) by.n += R.nameScore;
        by.t += titles.filter(t => t.includes(k)).length * R.titleScore;
        by.d += descs.filter(t => t.includes(k)).length * R.descScore;
        by.r += trs.filter(t => t.includes(k)).length * R.trScore;
      }
      const sc = by.n + by.t + by.d + by.r;
      if (sc >= R.minScore && sc > 0) res.push({ f, sc, by });
    }
    return res.sort((a, b) => b.sc - a.sc).slice(0, R.maxSugg);
  }

  // ---------- 振り分け補助の設定画面 ----------
  function openAssistCfg() {
    const anchor = setAnchor();
    const R = st.rules;
    const num = (k, label, min, max, note = '') => `<label class="ar-row"><span>${label}${note ? `<em>${note}</em>` : ''}</span><input type="number" data-r="${k}" min="${min}" max="${max}" value="${R[k]}"></label>`;
    const chk = (k, label) => `<label class="bk-check"><input type="checkbox" data-r="${k}" ${R[k] ? 'checked' : ''}><span>${label}</span></label>`;
    const folders = TG.tree(st.folders).map(({ f, depth }) =>
      `<label class="ar-kw" style="padding-left:${depth * 14}px"><span><i style="background:${esc(f.color)}"></i>${esc(f.name)}</span>
        <input data-kw="${f.id}" value="${esc((f.kw || []).join(', '))}" placeholder="${esc((st.rules.useDict ? defaultKw(f.name) : []).slice(0, 8).join(', ') || 'キーワード')}${st.rules.useDict && defaultKw(f.name).length > 8 ? '…' : ''}"></label>`).join('');
    showPop(anchor, settingsShell('assist', `<div class="bk ar">
      <div class="bk-h">🪄 振り分け補助の設定</div>
      <p class="bk-note">未分類のチャンネルごとに、チャンネル名と最近の動画タイトルにフォルダのキーワードが何回出てくるかで点数をつけ、点数の高いフォルダを候補に出します。</p>
      <div class="bk-sub">点数のつけ方</div>
      ${num('nameScore', 'チャンネル名に入っている', 0, 20, '1語につき')}
      ${num('titleScore', '動画タイトルに入っている', 0, 20, '1本・1語につき')}
      ${num('titleCount', '見る動画タイトルの本数', 3, 30, '最近の動画から')}
      <div class="bk-sub">候補の出し方</div>
      ${num('minScore', '候補に出す最低点', 1, 50)}
      ${num('bulkMin', '「まとめて適用」の最低点', 1, 50, '一番上の候補だけ')}
      ${num('maxSugg', '候補の数', 1, 6)}
      ${chk('useDict', 'キーワード未設定のフォルダは、フォルダ名から自動でキーワードを作る（例：食べ物→グルメ・ラーメン…）')}
      ${chk('fuzzy', 'ひらがな／カタカナ・全角／半角・大文字／小文字を区別しない')}
      ${chk('useShorts', '動画が無いチャンネルはショートのタイトルを見る')}
      ${chk('subfolder', '中のフォルダ（サブフォルダ）も候補にする')}
      <div class="bk-sub">概要欄・文字起こし</div>
      ${chk('useDesc', '動画の概要欄とチャンネルの説明文も見る')}
      ${num('descScore', '概要欄・説明文に入っている', 0, 20, '1本・1語につき')}
      ${num('descCount', '見る概要欄の本数', 1, 10, '最近の動画から')}
      ${chk('useTr', '動画の文字起こし（字幕）も見る<em>字幕がある動画だけ。1チャンネルごとに時間がかかります</em>')}
      ${num('trScore', '文字起こしに入っている', 0, 20, '1本・1語につき')}
      ${num('trCount', '見る文字起こしの本数', 1, 5, '最近の動画から')}
      <div class="bk-sub">フォルダごとのキーワード</div>
      <p class="bk-note">カンマ区切り。空欄なら薄く表示された自動のキーワードを使います。<b>-言葉</b> と書くと除外（例：<code>ゲーム, 実況, -ポケカ</code>）。</p>
      <div class="ar-kws">${folders || '<p class="bk-note">フォルダがありません</p>'}</div>
      <div class="bk-row"><button data-act="assist-reset">点数・出し方を初期値に戻す</button></div>
    </div>`), { ...SET_OPTS, anchor });
    const p = q('.pop');
    p.querySelectorAll('[data-r]').forEach(inp => inp.addEventListener('change', () => {
      const k = inp.dataset.r;
      st.rules[k] = inp.type === 'checkbox' ? inp.checked : Math.max(+inp.min, Math.min(+inp.max, Math.round(+inp.value || RULES_DEF[k])));
      if (inp.type !== 'checkbox') inp.value = st.rules[k];
      saveRules();
    }));
    p.querySelectorAll('[data-kw]').forEach(inp => inp.addEventListener('change', () => {
      const f = st.folders.find(x => x.id === inp.dataset.kw);
      if (!f) return;
      f.kw = inp.value.split(/[,、，\n]/).map(x => x.trim()).filter(Boolean);
      if (!f.kw.length) delete f.kw;
      persist();
      refreshSugg();
    }));
    ['keydown', 'keyup', 'keypress'].forEach(t => p.addEventListener(t, e => e.stopPropagation()));
  }
  function saveRules() {
    const diff = Object.fromEntries(Object.entries(st.rules).filter(([k, v]) => RULES_DEF[k] !== v));
    chrome.storage.local.set({ assistRules: diff });
    refreshSugg();
    if (st.assist) observeSugg(); // 概要欄・文字起こしをオンにしたら、見えている行から取り直す
  }
  function refreshSugg() {
    $.querySelectorAll('.sugg').forEach(el => { const c = st.channels[el.dataset.k]; if (c) el.innerHTML = suggHtml(c); });
    updateBulkAssist();
  }
  function suggHtml(c) {
    const has = !!st.titles[c.key];
    const list = suggest(c);
    const chips = list.map(({ f, sc, by }) =>
      `<button class="sg" data-act="accept" data-f="${f.id}" style="--c:${esc(f.color)}" title="一致度 ${sc}（名前 ${by.n}・タイトル ${by.t}・概要欄 ${by.d}・字幕 ${by.r}）">＋${esc(TG.pathName(st.folders, f))}${sc >= st.rules.bulkMin * 1.5 ? ' ★' : ''}</button>`).join('');
    return `<span class="sg-lb">🪄 候補</span>${chips || `<span class="sg-none">${has ? '候補なし（🏷でフォルダのキーワードを足すと出やすくなります）' : '動画タイトルを確認中…'}</span>`}`;
  }
  function bulkPlan() {
    return st.shown.filter(k => !inAnyFolder(k) && st.channels[k]).map(k => {
      const top = suggest(st.channels[k])[0];
      return top && top.sc >= st.rules.bulkMin ? { key: k, f: top.f } : null;
    }).filter(Boolean);
  }
  let bulkT = null;
  function updateBulkAssist() {
    clearTimeout(bulkT);
    bulkT = setTimeout(() => {
      const b = host && q('.bulkassist');
      if (!b) return;
      const n = st.assist ? bulkPlan().length : 0;
      b.hidden = !n;
      b.textContent = `🪄 一括適用 ${n}`;
      b.title = `一致度の高い候補（${st.rules.bulkMin}点以上）を ${n} チャンネルにまとめて適用`;
    }, 400);
  }

  // 見えている未分類の行だけ、最近の動画タイトルを取得（14日キャッシュ）
  let suggIO = null, titleQ = [], titleBusy = 0, titleSaveT = null;
  function observeSugg() {
    suggIO?.disconnect();
    if (!st.assist) return;
    suggIO = new IntersectionObserver(ents => {
      for (const en of ents) {
        if (!en.isIntersecting) continue;
        suggIO.unobserve(en.target);
        const key = en.target.dataset.k;
        const e = st.titles[key];
        if (!e || Date.now() - e.at > 14 * 864e5 || (st.rules.useDesc && !e.dv) || (st.rules.useTr && !e.trv)) { titleQ.push(key); pumpTitles(); }
      }
    }, { root: q('main'), rootMargin: '300px' });
    $.querySelectorAll('.sugg').forEach(x => suggIO.observe(x));
  }
  function pumpTitles() {
    while (titleBusy < 3 && titleQ.length) {
      const key = titleQ.shift();
      const c = st.channels[key];
      if (!c) continue;
      titleBusy++;
      (async () => {
        let t = [], vids = [];
        const R = st.rules;
        const rec = { at: Date.now(), t };
        try {
          const id = await ensureId(c);
          if (id) vids = (await YTAPI.channelTab(id, 'video')).slice(0, 30);
          if (!vids.length && id && R.useShorts) vids = (await YTAPI.channelTab(id, 'short')).slice(0, 30);
          rec.t = vids.map(x => x.t).filter(Boolean);
          // 概要欄・チャンネルの説明・文字起こし（設定でオンのとき）
          const shrink = s => String(s || '').replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').slice(0, 3000);
          if (R.useDesc) {
            rec.dv = true;
            rec.cd = id ? shrink(await YTAPI.channelDesc(id)) : '';
            rec.d = [];
            for (const v of vids.slice(0, R.descCount)) rec.d.push(shrink((await YTAPI.videoText(v.v)).desc));
          }
          if (R.useTr) {
            rec.trv = true;
            rec.tr = [];
            for (const v of vids.filter(x => !x.short).slice(0, R.trCount)) rec.tr.push(String((await YTAPI.videoText(v.v, { transcript: true })).tr || '').slice(0, 8000));
          }
        } catch { /* 取れなければ取れた分だけで判定 */ }
        st.titles[key] = rec;
        if (host) {
          const el = [...$.querySelectorAll('.sugg')].find(x => x.dataset.k === key);
          if (el) el.innerHTML = suggHtml(c);
          updateBulkAssist();
        }
        clearTimeout(titleSaveT);
        titleSaveT = setTimeout(() => chrome.storage.local.set({ chTitles: st.titles }), 2000);
      })().finally(() => { titleBusy--; if (host) pumpTitles(); });
    }
  }

  function renderBulk() {
    const b = q('.bulk');
    b.hidden = st.sel.size === 0;
    if (b.hidden) return;
    if (!folder(st.bulkFolder)) st.bulkFolder = st.folders[0]?.id || null;
    const opts = TG.tree(st.folders).map(({ f, depth }) =>
      `<option value="${f.id}" ${f.id === st.bulkFolder ? 'selected' : ''}>${'　'.repeat(depth)}${esc(f.name)}</option>`).join('');
    b.innerHTML = `<strong>${st.sel.size} 件選択中</strong>
      ${st.folders.length ? `<select>${opts}</select>
      <button data-act="bulk-add" class="primary">フォルダに追加</button>
      <button data-act="bulk-remove">フォルダから外す</button>` : '<span class="muted">フォルダを作ると一括で振り分けできます</span>'}
      <button data-act="bulk-hide">非表示</button>
      <button data-act="bulk-show">表示に戻す</button>
      <button data-act="bulk-clear">選択解除</button>`;
  }

  // ---------- ポップアップ（カラーパレット・登録メニュー） ----------
  function showPop(anchor, html, data) {
    const p = q('.pop');
    p.innerHTML = html;
    p.hidden = false;
    p.classList.toggle('wide', !!data.wide);
    p.classList.toggle('settings', !!data.settings);
    p.classList.remove('picker');
    st.pop = data;
    const r = anchor.getBoundingClientRect();
    const w = p.offsetWidth, h = p.offsetHeight;
    let x = data.alignRight ? r.right - w : r.left;
    let y = r.bottom + 6;
    if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 6);
    x = Math.min(Math.max(8, x), innerWidth - w - 8);
    p.style.left = x + 'px';
    p.style.top = y + 'px';
  }
  function hidePop() {
    const p = q('.pop');
    p.hidden = true;
    p.innerHTML = '';
    st.pop = null;
  }

  // 親フォルダのまとまりを、行数が揃うように3列へ振り分ける（上から下へ縦にスクロール）
  function pkColumns(groups, row) {
    const cols = [[], [], []], h = [0, 0, 0];
    for (const g of groups) {
      const i = h.indexOf(Math.min(...h));
      cols[i].push(g);
      h[i] += g.length + 1;
    }
    return cols.map(c => `<div class="pk-col">${c.map(g => `<div class="pk-g">${g.map(row).join('')}</div>`).join('')}</div>`).join('');
  }

  // フォルダの選択一覧（親フォルダごとにまとめて、段組みで表示）
  function openPicker(btn, key) {
    const c = st.channels[key];
    const tree = TG.tree(st.folders);
    const groups = [];
    for (const n of tree) { if (n.depth === 0) groups.push([n]); else groups[groups.length - 1]?.push(n); }
    const row = ({ f, depth }) => `<label class="pk-row" style="padding-left:${4 + depth * 16}px" data-name="${esc(TG.pathName(st.folders, f).toLowerCase())}">
        <input type="checkbox" data-act="pk" data-f="${f.id}" ${f.keys.includes(key) ? 'checked' : ''}><i class="pk-dot" style="background:${esc(f.color)}"></i><span>${esc(f.name)}</span></label>`;
    showPop(btn, `<div class="pk-head"><b>${esc(c?.name || key)}</b><input class="pk-q" placeholder="フォルダ名で絞り込み"></div>
      <div class="pk">${pkColumns(groups, row)}</div>`, { kind: 'picker', key, wide: true, alignRight: false });
    const p = q('.pop');
    p.classList.add('picker');
    const input = p.querySelector('.pk-q');
    input.focus();
    input.addEventListener('input', () => {
      const v = input.value.trim().toLowerCase();
      p.querySelectorAll('.pk-row').forEach(r => { r.hidden = !!v && !r.dataset.name.includes(v); });
      p.querySelectorAll('.pk-g').forEach(g => { g.hidden = !g.querySelector('.pk-row:not([hidden])'); });
    });
  }

  function openPalette(btn, f) {
    const sw = PALETTE.map(c => `<button class="sw ${c === f.color ? 'cur' : ''}" data-act="pickcolor" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('');
    const ic = TG.ICON_SET.map(e => `<button class="ic ${e === f.icon && !f.iconImg ? 'cur' : ''}" data-act="pickicon" data-e="${esc(e)}">${e}</button>`).join('');
    showPop(btn, `<div class="pal-title">「${esc(f.name)}」の色</div><div class="pal">${sw}</div>
      <label class="custom">カスタム <input type="color" value="${esc(/^#[0-9a-f]{6}$/i.test(f.color) ? f.color : '#888888')}"></label>
      <div class="pal-title">アイコン</div><div class="icons">${ic}</div>
      <div class="ic-row"><input class="ic-text" maxlength="4" placeholder="絵文字・文字" value="${esc(f.iconImg ? '' : f.icon || '')}"><button data-act="pickicon-text">決定</button></div>
      <div class="ic-row"><button data-act="pickicon-img">🖼 画像を選ぶ</button><button data-act="pickicon-none">標準に戻す</button></div>`, { kind: 'palette', f: f.id, wide: true });
    const p = q('.pop');
    p.querySelector('.ic-text').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') p.querySelector('[data-act=pickicon-text]').click(); });
  }

  const notifIcon = (label, i) => /なし|オフ|none/i.test(label) ? I.bellOff : /すべて|all/i.test(label) || i === 0 ? I.bellRing : I.bell;

  async function openSubMenu(btn, key) {
    showPop(btn, '<div class="mi muted">通知設定を読み込み中…</div>', { kind: 'sub', key, alignRight: true });
    let info = { options: [] };
    try { info = await YTAPI.channelSubInfo(key); } catch { /* 取得失敗時は登録解除のみ */ }
    if (st.pop?.key !== key) return;
    st.pop.options = info.options;
    const items = info.options.map((o, i) =>
      `<button class="mi" data-act="notif" data-i="${i}">${notifIcon(o.label, i)}<span>${esc(o.label)}</span>${o.selected ? `<span class="ck">${I.check}</span>` : ''}</button>`).join('');
    showPop(btn, `${items || '<div class="mi muted">通知設定を取得できませんでした</div>'}
      <button class="mi" data-act="unsubscribe">${I.unsub}<span>登録解除</span></button>`, { ...st.pop });
  }

  async function ensureId(c) {
    if (c.id) return c.id;
    c.id = c.key.startsWith('channel/') ? c.key.slice(8) : await YTAPI.resolveId(c.key);
    return c.id;
  }

  // ---------- 操作 ----------
  async function onClick(e) {
    const el = e.target.closest('[data-act]');
    const act = el?.dataset.act;
    if (st.pop && !e.target.closest('.pop') && !['palette', 'submenu', 'backup', 'picker', 'settings'].includes(act)) hidePop();
    if (!el) return;
    const key = el.closest('.row')?.dataset.key;
    const f = el.dataset.f ? folder(el.dataset.f) : null;
    if (['collapse', 'palette', 'subfolder', 'rename', 'delfolder', 'notify', 'kw'].includes(act)) e.stopPropagation();

    switch (act) {
      case 'close': return close();
      case 'import': return importSubs();
      case 'refresh': return abort ? abort.abort() : refreshMeta(true);
      case 'missing':
        if (abort) return setProgress('取得中です。終わってから押してください');
        return refreshMeta('missing');
      case 'assist':
        st.assist = !st.assist;
        chrome.storage.local.set({ assistOn: st.assist });
        renderHeader();
        return renderList();
      case 'accept': {
        const key = el.closest('.sugg').dataset.k;
        const af = folder(el.dataset.f);
        if (!af) return;
        if (!af.keys.includes(key)) af.keys.push(key);
        persist(); renderRow(key); renderAside(); updateBulkAssist();
        return;
      }
      case 'bulkassist': {
        const plan = bulkPlan();
        if (!plan.length) return;
        const sample = plan.slice(0, 8).map(p => `・${st.channels[p.key]?.name} → ${TG.pathName(st.folders, p.f)}`).join('\n');
        if (!confirm(`候補の一番上のフォルダに、${plan.length} チャンネルをまとめて振り分けますか？\n\n${sample}${plan.length > 8 ? '\n…ほか ' + (plan.length - 8) + ' 件' : ''}`)) return;
        plan.forEach(p => { if (!p.f.keys.includes(p.key)) p.f.keys.push(p.key); });
        persist(); renderAll();
        return setProgress(`${plan.length} チャンネルを振り分けました`);
      }
      case 'settings':
        if (st.pop?.kind === 'settings') return hidePop();
        return openSettings();
      case 'settab': return openSettings(el.dataset.tab);
      case 'fc-addslot': case 'fc-delslot': case 'fc-type': case 'fc-relock': {
        const F = await TG.focusCfg();
        if (act === 'fc-addslot') F.slots.push({ days: [0, 6], from: '10:00', to: '12:00' });
        if (act === 'fc-delslot') F.slots.splice(+el.dataset.si, 1);
        if (act === 'fc-type') F.type = el.dataset.v;
        if (act === 'fc-relock') F.unlockUntil = 0;
        await chrome.storage.local.set({ focus: F });
        return openFocusCfg();
      }
      case 'nt-test': {
        const r = await chrome.runtime.sendMessage({ type: 'tg-notify-test', level: el.dataset.lv });
        return setProgress(r?.ok ? 'テスト通知を出しました' : 'テスト通知を出せませんでした');
      }
      case 'pickset':
        await chrome.storage.local.set({ pickMode: el.dataset.v });
        return openCommentCfg();
      case 'cmtset': {
        const { cmt = {} } = await chrome.storage.local.get('cmt');
        await chrome.storage.local.set({ cmt: { ...cmt, [el.dataset.k]: el.dataset.k === 'speed' ? +el.dataset.v : el.dataset.v } });
        return openCommentCfg();
      }
      case 'assist-reset':
        st.rules = { ...RULES_DEF };
        saveRules();
        return openAssistCfg();
      case 'kw': {
        const cur = (f.kw?.length ? f.kw : defaultKw(f.name)).join(', ');
        const v = prompt(`「${f.name}」の振り分け補助キーワード（カンマ区切り）\nチャンネル名や動画タイトルにこの言葉が入っていると候補に出ます。\n「-言葉」と書くと除外（その言葉があると候補に出さない）。\n空にすると初期値に戻ります。点数などは右上の ⚙ →「振り分け補助」で設定できます。`, cur);
        if (v === null) return;
        f.kw = v.split(/[,、，\n]/).map(x => x.trim()).filter(Boolean);
        if (!f.kw.length) delete f.kw;
        persist();
        return renderList();
      }
      case 'thumbcount':
        st.thumbCount = +el.dataset.n;
        chrome.storage.local.set({ mgrThumbCount: st.thumbCount });
        renderHeader();
        return renderList();
      case 'thumbmode':
        st.thumbMode = el.dataset.m;
        chrome.storage.local.set({ mgrThumbs: st.thumbMode });
        renderHeader();
        return renderList();
      case 'view':
        st.view = el.dataset.v; st.bucket = null; st.sel.clear(); st.rendered = 0;
        q('main').scrollTop = 0;
        return renderAll();
      case 'bucket':
        st.bucket = st.bucket === el.dataset.b ? null : el.dataset.b;
        st.rendered = 0;
        renderStats(); return renderList();
      case 'notify': {
        if (st.notify.has(f.id)) st.nrules.folders[f.id] = { ...(st.nrules.folders[f.id] || {}), mode: 'off' };
        else st.nrules.folders[f.id] = { level: 'normal', ...(st.nrules.folders[f.id] || {}), mode: 'now' };
        await saveNotify();
        setProgress(st.notify.has(f.id) ? `「${f.name}」の新着を通知します` : `「${f.name}」の通知をオフにしました`);
        return renderAside();
      }
      case 'checknow': {
        setProgress('新着を確認中…');
        const r = await chrome.runtime.sendMessage({ type: 'tg-check-now' }).catch(e => ({ ok: false, error: e.message }));
        if (r?.busy) return setProgress('ほかのタブで確認中です。少し待ってから見てください');
        return setProgress(r?.ok ? `新着を確認しました（直近3日の新着 ${r.count ?? 0} 本）` : '確認できませんでした：' + (r?.error || '不明なエラー'));
      }
      case 'collapse':
        f.collapsed = !f.collapsed;
        persist(); return renderAside();
      case 'palette':
        if (st.pop?.kind === 'palette' && st.pop.f === f.id) return hidePop();
        return openPalette(el, f);
      case 'pickicon': case 'pickicon-text': case 'pickicon-none': {
        const pf = folder(st.pop?.f);
        if (!pf) return hidePop();
        delete pf.iconImg;
        if (act === 'pickicon') pf.icon = el.dataset.e;
        if (act === 'pickicon-text') { const v = q('.pop .ic-text').value.trim(); if (v) pf.icon = v; else delete pf.icon; }
        if (act === 'pickicon-none' || pf.icon === '📁') delete pf.icon;
        persist(); renderAside(); renderList();
        return hidePop();
      }
      case 'pickicon-img': {
        const pf = folder(st.pop?.f);
        if (!pf) return;
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*';
        inp.addEventListener('change', async () => {
          const file = inp.files[0];
          if (!file) return;
          try {
            // 64×64 に縮めて保存（Drive同期でも軽いように）
            const bmp = await createImageBitmap(file);
            const c = document.createElement('canvas'); c.width = c.height = 64;
            const g = c.getContext('2d');
            const s = Math.min(bmp.width, bmp.height);
            g.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, 64, 64);
            pf.iconImg = c.toDataURL('image/png');
            delete pf.icon;
            persist(); renderAside(); renderList(); hidePop();
          } catch (e) { setProgress('画像を読み込めませんでした：' + e.message); }
        });
        inp.click();
        return;
      }
      case 'pickcolor': {
        const pf = folder(st.pop?.f);
        if (pf) { pf.color = el.dataset.c; persist(); renderAside(); renderList(); }
        return hidePop();
      }
      case 'subfolder': {
        const n = prompt(`「${f.name}」の中に作るフォルダ名`);
        if (!n || !n.trim()) return;
        st.folders.push(TG.newFolder(n.trim(), st.folders.length, f.id));
        f.collapsed = false;
        persist(); return renderAll();
      }
      case 'rename': {
        const n = prompt('フォルダ名', f.name);
        if (n && n.trim()) { f.name = n.trim(); persist(); renderAll(); }
        return;
      }
      case 'delfolder': {
        const kids = TG.hasChildren(st.folders, f.id);
        if (!confirm(`フォルダ「${f.name}」を削除しますか？\n（チャンネル自体は削除されません${kids ? '。中のフォルダは1つ上の階層に移ります' : ''}）`)) return;
        st.folders.forEach(x => { if (x.parent === f.id) x.parent = f.parent ?? null; });
        st.folders = st.folders.filter(x => x !== f);
        if (st.view === f.id) st.view = 'all';
        persist(); return renderAll();
      }
      case 'picker':
        if (st.pop?.kind === 'picker' && st.pop.key === key) return hidePop();
        return openPicker(el, key);
      case 'pk': {
        const pf = folder(el.dataset.f);
        const k = st.pop?.key;
        if (!pf || !k) return;
        const i = pf.keys.indexOf(k);
        i >= 0 ? pf.keys.splice(i, 1) : pf.keys.push(k);
        el.checked = pf.keys.includes(k);
        persist(); renderRow(k); renderAside();
        return;
      }
      case 'toggle': {
        const i = f.keys.indexOf(key);
        i >= 0 ? f.keys.splice(i, 1) : f.keys.push(key);
        persist(); renderRow(key); return renderAside();
      }
      case 'hide': {
        const c = st.channels[key];
        c.hidden = !c.hidden;
        persist(); renderRow(key); renderAside(); return renderStats();
      }
      case 'sel':
        el.checked ? st.sel.add(key) : st.sel.delete(key);
        el.closest('.row').classList.toggle('selected', el.checked);
        return renderBulk();
      case 'bulk-add':
      case 'bulk-remove': {
        const bf = folder(st.bulkFolder);
        if (!bf) return;
        const set = new Set(bf.keys);
        st.sel.forEach(k => (act === 'bulk-add' ? set.add(k) : set.delete(k)));
        bf.keys = [...set];
        st.sel.clear(); persist(); return renderAll();
      }
      case 'bulk-hide':
      case 'bulk-show':
        st.sel.forEach(k => { if (st.channels[k]) st.channels[k].hidden = act === 'bulk-hide'; });
        st.sel.clear(); persist(); return renderAll();
      case 'bulk-clear':
        st.sel.clear(); renderList(); return renderBulk();

      // ----- バックアップ・同期 -----
      case 'backup': return openSettings('backup');
      case 'exp': return exportFile();
      case 'imp': return importFile();
      case 'copy-redirect':
        navigator.clipboard.writeText(el.dataset.v).then(() => setProgress('リダイレクトURIをコピーしました'));
        return;
      case 'drv-saveid': {
        const v = q('.pop .cid')?.value.trim();
        if (!v) return;
        await drive('setClient', { clientId: v });
        return openBackup();
      }
      case 'drv-connect': return driveAction('connect', 'Google Drive に接続しました');
      case 'drv-push': return driveAction('push', 'Google Drive に保存しました');
      case 'drv-pull': {
        setProgress('Google Drive の内容を確認中…');
        const r = await drive('peek');
        if (!r?.ok) return setProgress('Google Drive：' + (r?.error || '確認できませんでした'));
        if (r.none) return setProgress('Google Drive にまだ保存されていません');
        const older = (r.savedAt || 0) < (st.savedAt || 0);
        const msg = `Google Drive の内容（${fmt(r.savedAt)}・フォルダ ${r.folders}・チャンネル ${r.channels}）で置き換えますか？\n` +
          `このPC：${st.savedAt ? fmt(st.savedAt) : '—'}・フォルダ ${st.folders.length}・チャンネル ${Object.keys(st.channels).length}\n\n` +
          (older ? '⚠ Drive の方が古いデータです。このPCでのそれ以降の変更は消えます。\n' : '') +
          '（今の状態はバックアップに残るので、あとで戻せます）';
        if (!confirm(msg)) return setProgress('');
        return driveAction('pull', 'Google Drive から読み込みました');
      }
      case 'restore': {
        const { backups = [] } = await chrome.storage.local.get('backups');
        const b = backups[+el.dataset.i];
        if (!b || !confirm(`${fmt(b.at)} のバックアップ（${b.reason}・フォルダ ${b.folders}・チャンネル ${b.channelCount}）に戻しますか？\n（今の状態もバックアップに残ります）`)) return;
        flush();
        await TG.restoreBackup(+el.dataset.i);
        TG.log('データ', `バックアップから復元：${fmt(b.at)}（${b.reason}）`);
        await reloadState();
        setProgress('バックアップから戻しました');
        return openBackup();
      }
      case 'open-log': return chrome.runtime.sendMessage({ type: 'openPage', page: 'log' });
      case 'drv-disconnect': return driveAction('disconnect', 'Google Drive との接続を解除しました');

      // ----- チャンネル登録・通知 -----
      case 'submenu':
        if (st.pop?.kind === 'sub' && st.pop.key === key) return hidePop();
        return openSubMenu(el, key);
      case 'notif': {
        const o = st.pop?.options?.[+el.dataset.i];
        const name = st.channels[st.pop.key]?.name;
        hidePop();
        if (!o) return;
        try { await YTAPI.setNotification(o.params); setProgress(`「${name}」の通知を「${o.label}」にしました`); TG.log('登録', `通知設定：${name} → ${o.label}`); }
        catch (err) { setProgress('通知設定の変更に失敗しました：' + err.message); TG.log('登録', `通知設定に失敗：${name}：${err.message}`, 'error'); }
        return;
      }
      case 'unsubscribe': {
        const k = st.pop?.key;
        const c = st.channels[k];
        hidePop();
        if (!c || !confirm(`「${c.name}」のチャンネル登録を解除しますか？`)) return;
        try {
          const id = await ensureId(c);
          if (!id) throw new Error('チャンネルIDを取得できませんでした');
          await YTAPI.setSubscribed(id, false);
          c.unsub = true;
          persist(); renderRow(k);
          setProgress(`「${c.name}」の登録を解除しました`);
          TG.log('登録', `登録解除：${c.name}`);
        } catch (err) { setProgress('登録解除に失敗しました：' + err.message); TG.log('登録', `登録解除に失敗：${c.name}：${err.message}`, 'error'); }
        return;
      }
      case 'subscribe': {
        const c = st.channels[key];
        try {
          const id = await ensureId(c);
          if (!id) throw new Error('チャンネルIDを取得できませんでした');
          await YTAPI.setSubscribed(id, true);
          c.unsub = false;
          persist(); renderRow(key);
          setProgress(`「${c.name}」をチャンネル登録しました`);
          TG.log('登録', `チャンネル登録：${c.name}`);
        } catch (err) { setProgress('チャンネル登録に失敗しました：' + err.message); TG.log('登録', `チャンネル登録に失敗：${c.name}：${err.message}`, 'error'); }
        return;
      }
    }
  }

  // ---------- バックアップ・同期 ----------
  const drive = (op, extra = {}) => chrome.runtime.sendMessage({ type: 'drive', op, ...extra });
  const kb = n => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`;

  async function reloadState() {
    const d = await TG.load();
    const { savedAt = null } = await chrome.storage.local.get('savedAt');
    Object.assign(st, { channels: structuredClone(d.channels), folders: structuredClone(d.folders), meta: d.meta, savedAt, view: 'all', sel: new Set() });
    renderAll();
  }

  async function exportFile() {
    const data = await TG.exportData(true);
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const d = new Date();
    a.download = `TubeFolio-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
    q('.app').appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setProgress(`エクスポートしました（${kb(blob.size)}）`);
    TG.log('データ', `ファイルにエクスポート（${kb(blob.size)}）`);
  }

  function importFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!confirm(`「${file.name}」の内容で、今のフォルダ設定を置き換えますか？`)) return;
        flush();
        const r = await TG.importData(data);
        await reloadState();
        setProgress(`インポートしました（チャンネル ${r.channels} 件・フォルダ ${r.folders} 件）`);
      } catch (e) {
        setProgress('インポートに失敗しました：' + e.message);
      }
    });
    input.click();
  }

  async function driveAction(op, okMsg) {
    setProgress('Google Drive と通信中…');
    flush();
    const r = await drive(op);
    if (!r?.ok) { setProgress('Google Drive：' + (r?.error || '失敗しました')); }
    else {
      let msg = okMsg;
      if (op === 'push') msg += `（${kb(r.bytes)}）`;
      if (op === 'pull') { await reloadState(); msg += `（チャンネル ${r.channels} 件・フォルダ ${r.folders} 件）`; }
      if (op === 'connect' && r.hasRemote) msg += '。Drive に保存済みのデータがあります（読み込みで反映できます）';
      setProgress(msg);
    }
    if (st.pop?.kind === 'settings' && st.setTab === 'backup') openBackup();
  }

  async function backupList() {
    const { backups = [] } = await chrome.storage.local.get('backups');
    if (!backups.length) return '<p class="bk-note">まだありません。Driveやファイルから読み込む前に自動で残ります。</p>';
    return '<div class="bk-list">' + backups.map((b, i) =>
      `<div class="bk-item"><span><b>${fmt(b.at)}</b> ${esc(b.reason)}<br><small>保存時刻 ${b.savedAt ? fmt(b.savedAt) : '—'}・フォルダ ${b.folders}・チャンネル ${b.channelCount}</small></span>
        <button data-act="restore" data-i="${i}">戻す</button></div>`).join('') + '</div>';
  }

  // ---------- 設定（右上の ⚙）：バックアップ・同期／振り分け補助／コメント ----------
  const SET_TABS = [['backup', '☁ 同期・バックアップ'], ['notify', '🔔 通知'], ['focus', '🎯 集中モード'], ['assist', '🪄 振り分け'], ['cmt', '💬 再生画面']];
  // ---------- 集中モードの設定 ----------
  const DAYS = ['日', '月', '火', '水', '木', '金', '土'];
  async function openFocusCfg() {
    const F = await TG.focusCfg();
    const stt = TG.focusState(F);
    const hm = t => new Date(t).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    const now = !F.on ? 'オフ' : stt.active ? `🔒 集中モード中（${hm(stt.until)} まで）` : stt.unlocked ? `一時解除中（${hm(F.unlockUntil)} まで）` : '待機中（時間帯の外）';
    const slots = F.slots.map((sl, i) => `<div class="fc-slot" data-si="${i}">
      <div class="fc-days">${DAYS.map((d, k) => `<label class="${sl.days.includes(k) ? 'on' : ''}"><input type="checkbox" data-fd="${k}" ${sl.days.includes(k) ? 'checked' : ''}>${d}</label>`).join('')}</div>
      <span class="nt-win"><input type="time" data-ft="from" value="${esc(sl.from)}">〜<input type="time" data-ft="to" value="${esc(sl.to)}"></span>
      <button class="icon" data-act="fc-delslot" data-si="${i}" title="この時間帯を消す">✕</button></div>`).join('');
    const list = F.type === 'allow' ? F.allow : F.lock;
    const tops = st.folders.filter(f => !f.parent || !st.folders.some(x => x.id === f.parent));
    const fchk = (id, name, color) => `<label class="fc-f ${list.includes(id) ? 'on' : ''}"><input type="checkbox" data-ff="${esc(id)}" ${list.includes(id) ? 'checked' : ''}><i style="background:${esc(color || '#888')}"></i>${esc(name)}</label>`;
    showPop(setAnchor(), settingsShell('focus', `<div class="bk nt fc">
      <div class="bk-h">🎯 集中モード</div>
      <p class="bk-note">決めた曜日・時間帯は、選んだフォルダの動画を見えなくします（通知とは別）。つい関係ない動画を見てしまうのを防ぎます。</p>
      <label class="bk-check"><input type="checkbox" data-fg="on" ${F.on ? 'checked' : ''}><span><b>集中モードを使う</b><em>いまの状態：${now}</em></span></label>
      <div class="bk-sub">時間帯</div>
      <div class="fc-slots">${slots}</div>
      <div class="bk-row"><button data-act="fc-addslot">＋ 時間帯を追加</button></div>
      <div class="bk-sub">見えなくするフォルダ</div>
      <div class="cm-row"><span>やり方</span><div class="cm-seg">
        <button data-act="fc-type" data-v="lock" class="${F.type !== 'allow' ? 'on' : ''}">選んだフォルダを隠す</button>
        <button data-act="fc-type" data-v="allow" class="${F.type === 'allow' ? 'on' : ''}">選んだフォルダだけ見られる</button></div></div>
      <p class="bk-note">${F.type === 'allow' ? '✅ を付けたフォルダ（例：学習・ビジネス）だけ見られます。ほかのフォルダ・登録していないチャンネルは見えなくなります。' : '✅ を付けたフォルダ（例：エンタメ・ゲーム）が見えなくなります。中のフォルダも一緒に隠れます。'}</p>
      <div class="fc-fs">${tops.map(f => fchk(f.id, f.name, f.color)).join('')}${fchk('__unsorted', '未分類', '#888')}</div>
      <div class="bk-sub">隠す場所</div>
      <label class="bk-check"><input type="checkbox" checked disabled><span>登録チャンネル画面（フォルダ・すべて・新着）</span></label>
      <label class="bk-check"><input type="checkbox" data-fg="hideHome" ${F.hideHome ? 'checked' : ''}><span>ホーム・検索・再生画面の横の動画もぼかす</span></label>
      <label class="bk-check"><input type="checkbox" data-fg="blockWatch" ${F.blockWatch ? 'checked' : ''}><span>見えないチャンネルの動画を開いたらロック画面を出す</span></label>
      <div class="bk-sub">一時解除</div>
      <div class="ar-row"><span>「少しだけ解除」の長さ<em>押してから10秒待つと解除できます</em></span><select data-fg="unlockMin">${opt([['5', '5分'], ['15', '15分'], ['30', '30分'], ['60', '60分']], String(F.unlockMin))}</select></div>
      ${stt.unlocked ? '<div class="bk-row"><button data-act="fc-relock">今すぐ集中モードに戻す</button></div>' : ''}
    </div>`), SET_OPTS);
    const p = q('.pop');
    const save = async patch => { const cur = await TG.focusCfg(); await chrome.storage.local.set({ focus: { ...cur, ...patch } }); TG.log('集中モード', '設定を変更'); };
    p.querySelectorAll('[data-fg]').forEach(inp => inp.addEventListener('change', async () => {
      const k = inp.dataset.fg;
      await save({ [k]: inp.type === 'checkbox' ? inp.checked : +inp.value });
      openFocusCfg();
    }));
    p.querySelectorAll('.fc-slot').forEach(row => row.addEventListener('change', async e => {
      const i = +row.dataset.si;
      const cur = await TG.focusCfg();
      const sl = cur.slots[i];
      if (e.target.dataset.fd != null) { const d = +e.target.dataset.fd; sl.days = e.target.checked ? [...new Set([...sl.days, d])].sort() : sl.days.filter(x => x !== d); }
      if (e.target.dataset.ft) sl[e.target.dataset.ft] = e.target.value;
      await save({ slots: cur.slots });
      openFocusCfg();
    }));
    p.querySelectorAll('[data-ff]').forEach(inp => inp.addEventListener('change', async () => {
      const cur = await TG.focusCfg();
      const k = cur.type === 'allow' ? 'allow' : 'lock';
      const set = new Set(cur[k]);
      inp.checked ? set.add(inp.dataset.ff) : set.delete(inp.dataset.ff);
      await save({ [k]: [...set] });
      openFocusCfg();
    }));
    ['keydown', 'keyup', 'keypress'].forEach(t => p.addEventListener(t, e => e.stopPropagation()));
  }

  // ---------- 通知の設定 ----------
  function syncNotifySet() {
    st.notify = new Set(st.folders.filter(f => (st.nrules.folders[f.id]?.mode || 'off') !== 'off').map(f => f.id));
  }
  async function saveNotify() {
    syncNotifySet();
    await chrome.storage.local.set({ notifyRules: st.nrules, notifyFolders: [...st.notify] });
  }
  const MODE_LB = [['inherit', '親に合わせる'], ['off', 'オフ'], ['now', 'すぐ'], ['window', '時間帯だけ'], ['kw', 'キーワードだけ']];
  const LV_LB = [['high', '高'], ['normal', '中'], ['low', '低']];
  const opt = (list, v) => list.map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${l}</option>`).join('');
  function openNotifyCfg() {
    const R = st.nrules;
    const rows = TG.tree(st.folders).map(({ f, depth }) => {
      const own = R.folders[f.id];
      const mode = own?.mode || (f.parent ? 'inherit' : 'off');
      const eff = TG.ruleFor(R, st.folders, f.id);
      const lv = own?.level || 'normal';
      return `<div class="nt-row" data-nf="${f.id}" style="--d:${depth}">
        <span class="nt-name"><i style="background:${esc(f.color)}"></i>${esc(f.name)}</span>
        <select data-nk="mode" title="通知のタイミング">${opt(f.parent ? MODE_LB : MODE_LB.slice(1), mode)}</select>
        <select data-nk="level" title="重要度" ${mode === 'inherit' || mode === 'off' ? 'disabled' : ''}>${opt(LV_LB, lv)}</select>
        <span class="nt-win" ${mode === 'window' ? '' : 'hidden'}><input type="time" data-nk="from" value="${esc(own?.from || '19:00')}">〜<input type="time" data-nk="to" value="${esc(own?.to || '23:00')}"></span>
        ${mode === 'inherit' ? `<span class="nt-eff">→ ${esc(MODE_LB.find(x => x[0] === eff.mode)?.[1] || 'オフ')}</span>` : ''}
      </div>`;
    }).join('');
    showPop(setAnchor(), settingsShell('notify', `<div class="bk nt">
      <div class="bk-h">🔔 通知</div>
      <details class="acc" ${st.ntHelp ? 'open' : ''} data-acc="ntHelp"><summary>通知する動画の選び方（おすすめ）</summary>
        <ul class="nt-help">
          <li><b>すぐ見たいフォルダだけ「すぐ」</b>（ニュース・推しの配信者など）。重要度「高」は閉じるまで残ります。</li>
          <li><b>まとめて見るフォルダは「時間帯だけ」</b>（エンタメ・ゲーム等を 19:00〜23:00 など）。時間外の新着は時間帯の始めにまとめて届きます。</li>
          <li><b>数が多いフォルダは「キーワードだけ」</b>にして、下の例外キーワード（LIVE・生配信・速報など）を含む動画だけ知らせると、通知が増えすぎません。</li>
          <li><b>登録チャンネルの配信</b>はフォルダと別に「配信」でオン（見逃したくない人向け）。</li>
          <li>それ以外のフォルダは「オフ」のままでOK。新着はサイドバーの「新着動画」でまとめて見られます。</li>
        </ul></details>
      <div class="bk-sub">知らせ方</div>
      <div class="ar-row"><span>表示</span><select data-ng="show">${opt([['both', 'PCの通知＋YouTube画面の右下'], ['pc', 'PCの通知（Windowsの右下）'], ['page', 'YouTube画面の右下からスライド']], R.show)}</select></div>
      <div class="ar-row"><span>新着の確認の間隔<em>YouTubeのタブを開いている間</em></span><select data-ng="interval">${opt([['5', '5分'], ['10', '10分'], ['15', '15分'], ['30', '30分']], String(R.interval))}</select></div>
      <div class="bk-sub">フォルダごと</div>
      <div class="nt-rows">${rows || '<p class="bk-note">フォルダがありません</p>'}</div>
      <div class="bk-sub">例外キーワード</div>
      <p class="bk-note">タイトルにこの言葉を含む動画は、フォルダが「時間帯だけ」「キーワードだけ」でも<b>すぐ</b>知らせます（カンマ区切り）。</p>
      <div class="ar-row"><input class="nt-kw" data-ng="kw" value="${esc(R.kw)}" placeholder="LIVE, 生配信, 速報"></div>
      <div class="ar-row"><span>キーワードの重要度</span><select data-ng="kwLevel">${opt(LV_LB, R.kwLevel)}</select></div>
      <label class="bk-check"><input type="checkbox" data-ng="kwAll" ${R.kwAll ? 'checked' : ''}><span>通知オフのフォルダ・未分類の登録チャンネルにも使う</span></label>
      <div class="bk-sub">登録チャンネルの配信</div>
      <label class="bk-check"><input type="checkbox" data-nl="on" ${R.live.on ? 'checked' : ''}><span>配信が始まったら知らせる</span></label>
      <div class="ar-row"><span>対象</span><select data-nl="scope">${opt([['all', 'すべての登録チャンネル'], ['notify', '通知オンのフォルダのチャンネルだけ']], R.live.scope)}</select></div>
      <label class="bk-check"><input type="checkbox" data-nl="upcoming" ${R.live.upcoming ? 'checked' : ''}><span>配信予定（待機所）ができたときも知らせる</span></label>
      <div class="ar-row"><span>配信の重要度</span><select data-nl="level">${opt(LV_LB, R.live.level)}</select></div>
      <div class="bk-row"><button data-act="nt-test" data-lv="normal">テスト通知（中）</button><button data-act="nt-test" data-lv="high">テスト通知（高）</button><button data-act="checknow">今すぐ新着を確認</button></div>
      <p class="bk-note">新着の確認は YouTube のタブを開いている間に行います。「時間帯だけ」の通知は、時間になるとバックグラウンドから届きます。</p>
    </div>`), SET_OPTS);
    const p = q('.pop');
    p.querySelectorAll('.acc[data-acc]').forEach(d => d.addEventListener('toggle', () => { st[d.dataset.acc] = d.open; }));
    p.querySelectorAll('[data-nk]').forEach(inp => inp.addEventListener('change', async () => {
      const id = inp.closest('[data-nf]').dataset.nf;
      const k = inp.dataset.nk;
      if (k === 'mode' && inp.value === 'inherit') delete R.folders[id];
      else R.folders[id] = { level: 'normal', from: '19:00', to: '23:00', ...(R.folders[id] || {}), [k]: inp.value };
      await saveNotify();
      if (k === 'mode') { openNotifyCfg(); renderAside(); }
    }));
    p.querySelectorAll('[data-ng]').forEach(inp => inp.addEventListener('change', async () => {
      const k = inp.dataset.ng;
      R[k] = inp.type === 'checkbox' ? inp.checked : k === 'interval' ? +inp.value : inp.value;
      await saveNotify();
    }));
    p.querySelectorAll('[data-nl]').forEach(inp => inp.addEventListener('change', async () => {
      R.live = { ...R.live, [inp.dataset.nl]: inp.type === 'checkbox' ? inp.checked : inp.value };
      await saveNotify();
    }));
    ['keydown', 'keyup', 'keypress'].forEach(t => p.addEventListener(t, e => e.stopPropagation()));
  }
  const setAnchor = () => q('.setbtn');
  function settingsShell(tab, inner) {
    st.setTab = tab;
    return `<div class="set"><div class="set-tabs">${SET_TABS.map(([k, l]) => `<button class="set-tab ${k === tab ? 'on' : ''}" data-act="settab" data-tab="${k}">${l}</button>`).join('')}</div>
      <div class="set-body">${inner}</div></div>`;
  }
  const SET_OPTS = { kind: 'settings', alignRight: true, wide: true, settings: true };
  function openSettings(tab = st.setTab || 'backup') {
    if (tab === 'assist') return openAssistCfg();
    if (tab === 'cmt') return openCommentCfg();
    if (tab === 'notify') return openNotifyCfg();
    if (tab === 'focus') return openFocusCfg();
    return openBackup();
  }
  async function openCommentCfg() {
    const DEF = { side: 'right', speed: 2, width: 'normal', sort: 'top', end: 'hide', mode: 'cmt' };
    const cfg = { ...DEF, ...((await chrome.storage.local.get('cmt')).cmt || {}) };
    const pick = (await chrome.storage.local.get('pickMode')).pickMode || 'auto';
    const row = (label, key, opts) => `<div class="cm-row"><span>${label}</span><div class="cm-seg">${opts.map(([v, t]) =>
      `<button data-act="cmtset" data-k="${key}" data-v="${v}" class="${String(cfg[key]) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div></div>`;
    showPop(setAnchor(), settingsShell('cmt', `<div class="bk">
      <div class="bk-h">💬 再生画面のコメント・文字起こし</div>
      <p class="bk-note">動画の横にコメントを下から上へ流します。「文字起こし」にすると、字幕の文を再生位置に合わせて流します（行を押すとその位置へ）。再生画面の操作バーの 💬 からも変えられます。設定はすべての動画で共通です。</p>
      ${row('内容', 'mode', [['cmt', 'コメント'], ['tr', '文字起こし']])}
      ${row('表示', 'side', [['right', '右側'], ['left', '左側'], ['off', 'オフ']])}
      ${row('速さ', 'speed', [[1, '遅い'], [2, '普通'], [3, '速い']])}
      ${row('幅', 'width', [['narrow', '狭い'], ['normal', '普通'], ['wide', '広い']])}
      ${row('並び', 'sort', [['top', '評価順'], ['new', '新しい順']])}
      ${row('最後まで流れたら', 'end', [['hide', '隠す'], ['loop', 'ループ'], ['stay', 'そのまま']])}
      <div class="bk-h" style="margin-top:16px">⏭ 次に見る動画</div>
      <p class="bk-note">動画が終わる30秒前に4本出します。1本目は連続再生・YouTubeの再生リストの次の動画、2本目からはTubeFolioの「後で見る」からランダム（無ければYouTubeのおすすめ）。</p>
      <div class="cm-row"><span>出す場面</span><div class="cm-seg">${[['auto', '連続再生・再生リストのとき'], ['always', 'いつも'], ['off', '出さない']].map(([v, t]) => `<button data-act="pickset" data-v="${v}" class="${pick === v ? 'on' : ''}">${t}</button>`).join('')}</div></div>
      <div class="bk-h" style="margin-top:16px">🔖 ブックマーク</div>
      <p class="bk-note">再生中に <b>B</b> キーを押すと、その瞬間の時間を保存します（サイドバーの「ブックマーク」で一覧）。</p>
    </div>`), SET_OPTS);
  }

  async function openBackup(anchor) {
    anchor = setAnchor();
    const s = (await drive('status')) || {};
    const data = await TG.exportData(true);
    const sz = o => new Blob([JSON.stringify(o || {})]).size;
    const total = sz(data);
    const size = {
      base: sz({ channels: data.channels, folders: data.folders }),
      meta: sz(data.meta), history: sz(data.aux.history), later: sz(data.aux.later), prefs: sz(data.aux.prefs)
    };
    const chk = (cls, key, label, n) => `<label class="bk-check"><input type="checkbox" class="${cls}" ${s[key] !== false ? 'checked' : ''}><span>${label}<small>${kb(n)}</small></span></label>`;
    const last = s.lastSyncAt ? `最終同期 ${fmt(s.lastSyncAt)}${s.lastBytes ? `（${kb(s.lastBytes)}）` : ''}` : 'まだ同期していません';
    let drv;
    if (!s.clientId) {
      drv = `<p class="bk-note">はじめに Google Cloud で OAuth クライアントID（ウェブアプリケーション）を作成し、承認済みのリダイレクトURIに次を登録してください。</p>
        <div class="bk-uri"><code>${esc(s.redirect || '')}</code><button data-act="copy-redirect" data-v="${esc(s.redirect || '')}">コピー</button></div>
        <div class="bk-row"><input class="cid" placeholder="クライアントID（～.apps.googleusercontent.com）"><button class="primary" data-act="drv-saveid">保存</button></div>`;
    } else if (!s.connected) {
      drv = `<p class="bk-note">クライアントID設定済み。接続するとGoogleのログイン画面が開きます。</p>
        <div class="bk-row"><button class="primary" data-act="drv-connect">${I.cloud}<span>Google Drive に接続</span></button></div>
        <details class="bk-adv"><summary>クライアントIDを変更</summary>
          <div class="bk-uri"><code>${esc(s.redirect || '')}</code><button data-act="copy-redirect" data-v="${esc(s.redirect || '')}">コピー</button></div>
          <div class="bk-row"><input class="cid" value="${esc(s.clientId)}"><button data-act="drv-saveid">保存</button></div></details>`;
    } else {
      drv = `<p class="bk-note">接続済み・${last}${s.lastError ? `<br><span class="bk-err">${esc(s.lastError)}</span>` : ''}</p>
        ${s.needReauth ? `<div class="bk-row"><button class="primary" data-act="drv-connect">${I.cloud}<span>Google Drive に再接続</span></button></div><p class="bk-note">Googleの認証の期限が切れました。押すとGoogleの画面が開きます（同じアカウントを選んでください）。</p>` : ''}
        <label class="bk-check"><input type="checkbox" class="drv-auto" ${s.auto ? 'checked' : ''}> 自動で同期する（変更を随時保存・開いたときに新しい方へ合わせる）</label>
        <details class="acc" ${st.accOpen ? 'open' : ''}><summary>Driveに保存するもの<small>（フォルダとチャンネルの振り分けは常に保存）</small></summary>
        ${chk('drv-meta', 'includeMeta', '更新情報（最終投稿日など）', size.meta)}
        ${chk('drv-hist', 'incHistory', '視聴記録・視聴済み<em>30分ごと＋YouTubeを閉じたとき</em>', size.history)}
        ${chk('drv-later', 'incLater', `後で見る<em>このPCに ${(data.aux.later?.later || []).length} 本</em>`, size.later)}
        ${chk('drv-prefs', 'incPrefs', 'その他の設定<em>通知するフォルダ・コメント表示・振り分け補助など</em>', size.prefs)}
        <p class="bk-note">視聴記録・視聴済み・後で見るは、Driveから読み込むとき置き換えずに合体します（このPCで見た分は消えません）。</p></details>
        <div class="bk-row"><button data-act="drv-push">${I.ul}<span>今すぐ保存</span></button><button data-act="drv-pull">${I.dl}<span>Driveから読み込み</span></button></div>
        <div class="bk-row"><button data-act="open-log">📝 動作ログ（同期の記録）</button><button class="ghostlink" data-act="drv-disconnect">接続を解除</button></div>`;
    }
    showPop(anchor, settingsShell('backup', '') .replace('<div class="set-body"></div>', '<div class="set-body">' + `<div class="bk">
      <div class="bk-h">ファイル</div>
      <div class="bk-row"><button data-act="exp">${I.dl}<span>エクスポート（ダウンロード）</span></button><button data-act="imp">${I.ul}<span>インポート</span></button></div>
      <p class="bk-note">データ量：全部で ${kb(total)}（フォルダ・チャンネル ${kb(size.base)}／更新情報 ${kb(size.meta)}／視聴記録 ${kb(size.history)}／後で見る ${kb(size.later)}／設定 ${kb(size.prefs)}）。ファイルのエクスポートには全部入ります。</p>
      <div class="bk-h">Google Drive</div>${drv}
      <div class="bk-h">バックアップ（置き換え前の控え）</div>${await backupList()}</div>` + '</div>'), { ...SET_OPTS, anchor });
    if (st.pop?.kind !== 'settings') return;
    const p = q('.pop');
    p.querySelector('.acc')?.addEventListener('toggle', e => { st.accOpen = e.target.open; });
    p.querySelector('.drv-auto')?.addEventListener('change', e => drive('setOpt', { patch: { auto: e.target.checked } }));
    const opt = (cls, key) => p.querySelector(cls)?.addEventListener('change', e => drive('setOpt', { patch: { [key]: e.target.checked } }));
    opt('.drv-meta', 'includeMeta');
    opt('.drv-hist', 'incHistory');
    opt('.drv-later', 'incLater');
    opt('.drv-prefs', 'incPrefs');
  }

  // 登録チャンネルを一括読み込み（既存のフォルダ分けは維持）
  async function importSubs() {
    if (st.busy) return;
    st.busy = true;
    renderHeader();
    setProgress('登録チャンネルを取得中…');
    try {
      const list = await YTAPI.fetchSubscriptions(n => setProgress(`登録チャンネルを取得中… ${n} 件`));
      if (!list.length) throw new Error('登録チャンネルが見つかりませんでした（ログイン状態を確認してください）');
      const ids = new Set(list.map(s => s.id));
      const byId = {};
      Object.values(st.channels).forEach(c => { if (c.id) byId[c.id] = c; });
      const next = {};
      let added = 0;
      for (const s of list) {
        const old = byId[s.id] || st.channels[s.key];
        if (!old) added++;
        if (old && old.key !== s.key) {
          st.folders.forEach(f => { const i = f.keys.indexOf(old.key); if (i >= 0) f.keys[i] = s.key; });
          if (st.meta[old.key]) st.meta[s.key] = st.meta[old.key];
        }
        next[s.key] = { key: s.key, id: s.id, name: s.name || old?.name || s.key, thumb: s.thumb || old?.thumb || '', hidden: !!old?.hidden, unsub: false };
      }
      const inAny = new Set(st.folders.flatMap(f => f.keys));
      let removed = 0;
      for (const c of Object.values(st.channels)) {
        if ((c.id && ids.has(c.id)) || next[c.key]) continue;
        if (inAny.has(c.key)) next[c.key] = { ...c, unsub: true };
        else removed++;
      }
      st.channels = next;
      clearTimeout(saveT);
      saveT = null;
      await writeNow();
      await chrome.storage.local.set({ meta: st.meta });
      setProgress(`読み込み完了：${list.length} 件（新規 ${added}・解除 ${removed}）`);
      TG.log('登録', `登録チャンネルを読み込み：${list.length}件（新規 ${added}・解除 ${removed}）`);
      renderAll();
      refreshMeta(false);
    } catch (err) {
      setProgress('読み込みに失敗しました：' + err.message);
      TG.log('登録', '登録チャンネルの読み込みに失敗：' + err.message, 'error');
    } finally {
      st.busy = false;
      renderHeader();
    }
  }

  // 最終投稿・投稿頻度を取得（RSS、6時間キャッシュ）
  // mode: true=全部 / false=古いものだけ / 'missing'=未取得・失敗だけ
  async function refreshMeta(force) {
    if (abort) return;
    abort = new AbortController();
    const { signal } = abort;
    renderHeader();
    const STALE = 6 * 3600e3;
    const queue = Object.values(st.channels).filter(c => {
      const m = st.meta[c.key];
      if (force === 'missing') return isMissing(m);
      return force || !m || Date.now() - (m.at || 0) > STALE;
    });
    const total = queue.length;
    let done = 0, unsaved = 0, lastPaint = 0, idChanged = false;
    if (!total) { abort = null; renderHeader(); return; }
    setProgress(`更新情報を取得中… 0/${total}`);

    const worker = async () => {
      while (queue.length && !signal.aborted) {
        const c = queue.shift();
        try {
          const r = await YTAPI.fetchMeta(c, signal);
          if (r.id && !c.id) { c.id = r.id; idChanged = true; }
          const old = st.meta[c.key];
          if (!r.last && old?.last && !r.shortsOnly) {
            // 取り直して日付が読めなかったときは、前の値を残す（悪化させない）
            st.meta[c.key] = { ...old, at: Date.now(), ...(r.error || r.nodate ? { retry: true } : {}) };
          } else {
            st.meta[c.key] = { last: r.last, interval: r.interval, count: r.count, at: Date.now(),
              ...(r.shortsOnly ? { shortsOnly: true, v2: true } : {}), ...(r.error ? { error: true } : {}), ...(r.nodate ? { nodate: true } : {}) };
          }
        } catch {
          if (signal.aborted) break;
          st.meta[c.key] = { ...(st.meta[c.key] || {}), at: Date.now(), error: true };
        }
        done++;
        if (!host) continue;
        updateRowMeta(c.key);
        if (Date.now() - lastPaint > 700) {
          lastPaint = Date.now();
          setProgress(`更新情報を取得中… ${done}/${total}`);
          renderStats();
        }
        if (++unsaved >= 30) { unsaved = 0; chrome.storage.local.set({ meta: st.meta }); }
      }
    };
    await Promise.all(Array.from({ length: force === 'missing' ? 3 : 5 }, worker));
    await chrome.storage.local.set({ meta: st.meta });
    if (idChanged) {
      const tmp = { channels: st.channels, folders: st.folders };
      if (TG.dedupe(tmp)) { st.channels = tmp.channels; st.folders = tmp.folders; renderAll(); }
      persist();
    }
    abort = null;
    const errs = Object.values(st.meta).filter(m => m?.error && Date.now() - (m.at || 0) < 3600e3).length;
    TG.log('更新情報', `${force === 'missing' ? '未取得だけ' : force ? '全部' : '古いもの'}を取得：${done}/${total}件${signal.aborted ? '（中止）' : ''}${errs ? `、失敗 ${errs}件` : ''}`, errs ? 'warn' : 'info');
    if (!host) return;
    setProgress(signal.aborted ? `取得を中止しました（${done}/${total}）` : `更新情報を取得しました（${done} 件）`);
    renderHeader();
    renderStats();
    renderList();
  }

  // ---------- スタイル ----------
  const CSS = `
  :host{all:initial}
  .app{--bg:#0f0f0f;--panel:#131313;--card:#1c1c1c;--card2:#272727;--line:#2c2c2c;--fg:#f1f1f1;--muted:#a3a3a3;--accent:#3ea6ff;
    position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;background:var(--bg);color:var(--fg);
    font:14px Roboto,"Noto Sans JP","Hiragino Sans",Meiryo,sans-serif;-webkit-font-smoothing:antialiased}
  .app.light{--bg:#fff;--panel:#f8f8f8;--card:#f2f2f2;--card2:#e5e5e5;--line:#e3e3e3;--fg:#0f0f0f;--muted:#606060;--accent:#065fd4}
  svg{width:20px;height:20px;fill:currentColor;flex:none}
  button{font:inherit;color:inherit;cursor:pointer;border:1px solid var(--line);background:var(--card);border-radius:18px;padding:7px 14px;display:inline-flex;align-items:center;gap:6px}
  button:hover{background:var(--card2)}
  button:disabled{opacity:.4;cursor:default}
  button.primary{background:var(--fg);color:var(--bg);border-color:transparent;font-weight:600}
  button.primary:hover{opacity:.88}
  button.big{padding:11px 22px;font-size:15px}
  button.icon{border:none;background:transparent;border-radius:50%;padding:8px}
  button.icon:hover{background:var(--card2)}
  input,select{font:inherit;color:inherit;background:var(--card);border:1px solid var(--line);border-radius:20px;padding:8px 14px;outline:none}
  select option{background:var(--card);color:var(--fg)}
  input:focus,select:focus{border-color:var(--accent)}
  input[type=checkbox]{accent-color:var(--accent);width:16px;height:16px;margin:0;padding:0}
  .muted{color:var(--muted)}
  header{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--line);flex:none;flex-wrap:wrap}
  header h1{font-size:18px;margin:0 0 0 4px;font-weight:700;display:flex;align-items:center;gap:8px}
  .spacer{flex:1}
  .progress{color:var(--muted);font-size:12px;max-width:420px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .status{color:var(--muted);font-size:12px;min-width:150px;text-align:right}
  .status.warn{color:#ffb74d}
  .body{flex:1;display:flex;min-height:0}
  aside{width:260px;flex:none;border-right:1px solid var(--line);padding:16px 10px;overflow-y:auto;background:var(--panel)}
  .aside-title{font-weight:700;padding:4px 10px 10px}
  .vi{display:flex;align-items:center;gap:8px;padding:8px 8px;border-radius:10px;cursor:pointer;user-select:none;min-height:22px;position:relative}
  .vi:hover{background:var(--card)}
  .vi.on{background:var(--card2);font-weight:700}
  .vi .nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .vi .ct{font-size:12px;color:var(--muted)}
  .vi .fi{display:flex}
  .vi[draggable=true]{cursor:grab}
  .caret,.caret-sp{width:18px;height:18px;flex:none}
  .caret{padding:0;border:none;background:transparent;border-radius:4px;display:grid;place-items:center;color:var(--muted)}
  .caret svg{width:18px;height:18px;transition:transform .15s}
  .caret.open svg{transform:rotate(90deg)}
  .vi .ops{display:none;gap:1px;align-items:center}
  .vi:hover .ops{display:flex}
  .vi:has(.ops):hover .ct{display:none}
  .vi .ops button{padding:3px;border:none;background:transparent;border-radius:6px}
  .vi .ops button:hover{background:var(--card2)}
  .vi .ops svg{width:16px;height:16px}
  .vi .ops .fdot{width:16px;height:16px;border-radius:5px;padding:0;margin:0 4px;border:2px solid var(--line)}
  .vi.drop-inside{outline:2px solid var(--accent);outline-offset:-2px;background:color-mix(in srgb,var(--accent) 15%,transparent)}
  .vi.drop-before::before,.vi.drop-after::after{content:"";position:absolute;left:8px;right:8px;height:3px;border-radius:2px;background:var(--accent)}
  .vi.drop-before::before{top:-2px}
  .vi.drop-after::after{bottom:-2px}
  .rootdrop{display:none;margin:6px 4px;padding:10px;border:2px dashed var(--line);border-radius:10px;text-align:center;font-size:12px;color:var(--muted)}
  .dragging-folder .rootdrop{display:block}
  .rootdrop.over{border-color:var(--accent);color:var(--fg)}
  .dragging-keys .vi[data-f]{background:color-mix(in srgb,var(--card2) 60%,transparent)}
  hr{border:none;border-top:1px solid var(--line);margin:10px 4px}
  .newfolder{display:flex;gap:6px;margin:0 4px 10px}
  .notifybox{margin:14px 4px 4px;padding:10px;border:1px solid var(--line);border-radius:10px}
  .nb-title{font-weight:700;font-size:13px}
  .notifybox .help{margin:6px 0 8px}
  .notifybox button{font-size:12px;padding:5px 12px}
  .newfolder input{flex:1;min-width:0;padding:8px 12px;border-radius:10px}
  .newfolder button{border-radius:10px}
  .help{color:var(--muted);font-size:12px;line-height:1.7;margin:10px 6px}
  main{flex:1;overflow-y:auto;padding:16px 20px 60px;min-width:0}
  .stats{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
  .card{width:108px;min-height:76px;border-radius:10px;padding:10px 12px;flex-direction:column;align-items:stretch;justify-content:space-between;text-align:left}
  .card.on{border-color:var(--fg)}
  .card .lb{font-size:11px;color:var(--muted);display:flex;gap:6px;align-items:flex-start;line-height:1.35}
  .dot{display:inline-block;width:8px;height:8px;border-radius:50%;flex:none;margin-top:3px}
  .card .n{font-size:22px;font-weight:700}
  .card .sub{font-size:10px;color:var(--muted);margin-top:2px;line-height:1.3}
  .card:has(.sub){width:150px}
  .toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px}
  .search{width:300px}
  .toolbar label{display:flex;gap:6px;align-items:center;font-size:13px;cursor:pointer}
  .shown{color:var(--muted);font-size:13px}
  .bulk{display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:8px 12px;margin-bottom:10px}
  .bulk[hidden]{display:none}
  .bulk button,.bulk select{padding:5px 12px}
  .row{display:flex;align-items:flex-start;gap:14px;padding:12px;border-bottom:1px solid var(--line)}
  .row:hover{background:var(--panel)}
  .row.selected{background:var(--card)}
  .row.is-hidden .av,.row.is-hidden .name{opacity:.45}
  .row>input[type=checkbox]{margin-top:18px}
  .av{width:40px;height:40px;border-radius:50%;object-fit:cover;flex:none;background:var(--card2)}
  .av.ph{display:grid;place-items:center;font-weight:700;color:var(--muted)}
  .info{flex:1;min-width:0}
  .name{color:var(--fg);font-weight:700;text-decoration:none}
  .name:hover{text-decoration:underline}
  .meta{display:flex;gap:10px;align-items:center;font-size:12px;color:var(--muted);margin:5px 0 8px;flex-wrap:wrap}
  .badge{display:inline-flex;align-items:center;gap:5px;background:var(--card2);color:var(--fg);border-radius:6px;padding:2px 8px;font-weight:600}
  .badge .dot{margin:0}
  .fq{color:#9ec5ff}
  .app.light .fq{color:#065fd4}
  .unsubtag{color:#ff6b6b;font-weight:600}
  .errtxt{color:#ff8a65}
  .seg{display:flex;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:2px}
  .seg-lb{font-size:12px;color:var(--muted);padding:0 6px 0 10px}
  .seg button{border:none;background:transparent;padding:5px 10px;font-size:12px;border-radius:14px}
  .seg button.on{background:var(--fg);color:var(--bg);font-weight:600}
  .strip{display:flex;gap:6px;flex:none;align-self:center}
  .th{display:flex;flex-direction:column;gap:4px;width:172px;flex:none;color:var(--fg);text-decoration:none}
  .tp{display:block;aspect-ratio:16/9;border-radius:6px;overflow:hidden;background:var(--card2)}
  .tp img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .15s}
  .th:hover img{transform:scale(1.06)}
  .th:hover .tt{text-decoration:underline}
  .tt{font-size:12px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.7em;color:var(--fg)}
  .tt.sk{background:var(--card2);border-radius:4px;min-height:1.8em}
  .sk{animation:pulse 1.2s ease-in-out infinite}
  .sticky{position:sticky;top:-16px;z-index:4;background:var(--bg);margin:0 -20px;padding:10px 20px 2px;border-bottom:1px solid var(--line)}
  .sticky .toolbar{margin-bottom:8px}
  .toolbar.row2{gap:10px}
  .assistcfg{padding:6px 9px}
  .seg[hidden]{display:none}
  .assign{padding:6px 12px;font-size:13px}
  .assistbtn{font-size:12px;padding:6px 12px}
  .assistbtn.on{background:#5b3fd6;color:#fff;border-color:transparent;font-weight:600}
  .bulkassist{font-size:12px;padding:6px 12px;background:#5b3fd6;color:#fff;border-color:transparent}
  .bulkassist[hidden]{display:none}
  .sugg{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px;padding:6px 8px;border:1px dashed color-mix(in srgb,#8b6cff 60%,transparent);border-radius:8px}
  .sg-lb{font-size:12px;color:#b9a6ff;font-weight:600}
  .sg{--c:#888;font-size:12px;padding:3px 10px;border-radius:7px;border:1px dashed var(--c);background:transparent;color:var(--fg)}
  .sg:hover{background:color-mix(in srgb,var(--c) 30%,transparent);border-style:solid}
  .sg-none{font-size:12px;color:var(--muted)}
  .app.light .sg-lb{color:#5b3fd6}
  @keyframes pulse{50%{opacity:.45}}
  .strip-msg{font-size:12px;color:var(--muted);min-width:180px;text-align:center}
  @media (max-width:1500px){.th{width:144px}}
  @media (max-width:1200px){.th{width:112px}}
  .chips{display:flex;flex-wrap:wrap;gap:6px}
  .chip{--c:#888;padding:3px 11px;border-radius:7px;font-size:12px;background:transparent;color:var(--muted)}
  .chip.on{background:color-mix(in srgb,var(--c) 28%,transparent);border-color:var(--c);color:var(--fg);font-weight:600;gap:6px}
  .chip.on .x{font-size:10px;opacity:0;width:0;overflow:hidden;transition:opacity .15s,width .15s}
  .chip.on:hover .x{opacity:.8;width:10px}
  .chip.on:hover{filter:brightness(1.15)}
  .chip.add{border-style:dashed;color:var(--muted)}
  .chip.add:hover{color:var(--fg);border-color:var(--fg)}
  .chip.add.first{color:#9ec5ff;border-color:#3ea6ff}
  .app.light .chip.add.first{color:#065fd4;border-color:#065fd4}
  .pop.wide.picker{width:min(680px,calc(100vw - 32px));max-width:none;padding:12px;max-height:none;overflow:visible}
  .pk-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}
  .pk-head b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .pk-q{width:200px;padding:6px 12px;font-size:13px}
  .pk{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0 14px;align-items:start;max-height:60vh;overflow-x:hidden;overflow-y:auto;padding-right:4px}
  .pk-col{min-width:0}
  .pk-g{padding:4px 0 6px;margin-bottom:6px;border-bottom:1px solid var(--line)}
  .pk-row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
  .pk-g[hidden],.pk-row[hidden]{display:none}
  .pk-row{display:flex;align-items:center;gap:8px;padding:4px;border-radius:6px;cursor:pointer;font-size:13px}
  .pk-row:hover{background:var(--card2)}
  .pk-row:first-child span{font-weight:700}
  .pk-dot{width:9px;height:9px;border-radius:3px;flex:none}
  .nofolder{font-size:12px;color:var(--muted)}
  .right{display:flex;flex-direction:column;align-items:flex-end;gap:6px;margin-top:2px;flex:none}
  .subbtn{border:none;background:var(--card2);padding:7px 10px 7px 12px;font-weight:600;font-size:13px}
  .subbtn svg{width:18px;height:18px}
  .subbtn:hover{filter:brightness(1.15)}
  .subbtn.join{background:var(--fg);color:var(--bg);padding:7px 16px}
  .eye{color:var(--muted)}
  .eye.off{color:#f5b942}
  .empty{text-align:center;padding:70px 20px;color:var(--muted)}
  .empty h2{color:var(--fg);font-size:18px;margin:0 0 6px}
  .empty button{margin-top:16px}
  .pop{position:fixed;z-index:10;min-width:200px;max-width:300px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:8px;box-shadow:0 10px 30px rgba(0,0,0,.45)}
  .pop[hidden]{display:none}
  .pop.wide{max-width:440px;width:440px;padding:14px}
  .bk-h{font-weight:700;margin:4px 2px 8px}
  .bk-h:not(:first-child){margin-top:16px;padding-top:12px;border-top:1px solid var(--line)}
  .bk-row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
  .bk-row button{padding:7px 12px;font-size:13px}
  .bk-row input{flex:1;min-width:0;font-size:12px;padding:7px 10px;border-radius:8px}
  .bk-note{font-size:12px;color:var(--muted);line-height:1.6;margin:6px 2px}
  .bk-err{color:#ff6b6b}
  .bk-uri{display:flex;gap:6px;align-items:center;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:6px 8px}
  .bk-uri code{flex:1;font-size:11px;word-break:break-all;color:var(--fg)}
  .bk-uri button{padding:4px 10px;font-size:12px}
  .bk-check{display:flex;gap:8px;align-items:flex-start;font-size:13px;margin:8px 2px;cursor:pointer;line-height:1.5}
  .bk-check input{margin-top:2px}
  .bk-check span{display:flex;flex-wrap:wrap;gap:2px 8px;align-items:baseline}
  .bk-check small{color:var(--muted);font-size:11px}
  .bk-check em{flex-basis:100%;font-style:normal;color:var(--muted);font-size:11px}
  .bk-sub{font-size:12px;font-weight:600;margin:10px 2px 2px}
  .bk-adv{font-size:12px;color:var(--muted);margin-top:8px}
  .bk-adv summary{cursor:pointer}
  .bk-list{max-height:200px;overflow-y:auto;border:1px solid var(--line);border-radius:8px}
  .bk-item{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:6px 8px;font-size:12px;border-bottom:1px solid var(--line)}
  .bk-item:last-child{border-bottom:none}
  .bk-item small{color:var(--muted)}
  .bk-item button{padding:4px 10px;font-size:12px;flex:none}
  .pop.wide{max-height:80vh;overflow-y:auto}
  .icons{display:grid;grid-template-columns:repeat(10,1fr);gap:3px;margin:4px 0 8px}
  .icons .ic{padding:0;width:32px;height:32px;justify-content:center;border-radius:8px;font-size:18px;border:1px solid transparent;background:transparent}
  .icons .ic:hover{background:var(--card2)}
  .icons .ic.cur{border-color:var(--accent);background:var(--card2)}
  .ic-row{display:flex;gap:6px;margin-top:6px}
  .ic-row input{flex:1;min-width:0;padding:6px 10px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--fg);font:inherit}
  .tg-ficon-emo{display:inline-flex;width:20px;height:20px;align-items:center;justify-content:center;font-size:16px;line-height:1}
  .tg-ficon-img{width:20px;height:20px;border-radius:5px;object-fit:cover;display:block}
  .fc-slots{display:flex;flex-direction:column;gap:8px;margin:6px 0}
  .fc-slot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px;border:1px solid var(--line);border-radius:10px}
  .fc-days{display:flex;gap:3px}
  .fc-days label{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;border:1px solid var(--line);font-size:12px;cursor:pointer;user-select:none}
  .fc-days label.on{background:var(--accent);color:#fff;border-color:var(--accent);font-weight:700}
  .fc-days input,.fc-f input{display:none}
  .fc-slot .icon{margin-left:auto;padding:4px 8px}
  .fc-fs{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 4px}
  .fc-f{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:16px;border:1px solid var(--line);font-size:12px;cursor:pointer;user-select:none}
  .fc-f i{width:9px;height:9px;border-radius:3px}
  .fc-f.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 20%,transparent);font-weight:700}
  .fc-f.on::before{content:"✅";font-size:11px}
  .nt-rows{display:flex;flex-direction:column;gap:4px;margin:6px 0 4px}
  .nt-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px;padding:3px 0 3px calc(var(--d) * 14px)}
  .nt-name{flex:1;min-width:100px;display:flex;align-items:center;gap:6px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
  .nt-name i{width:9px;height:9px;border-radius:3px;flex:none}
  .nt select,.nt input{padding:4px 6px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--fg);font:inherit;font-size:12px}
  .nt select:disabled{opacity:.4}
  .nt-win{display:inline-flex;align-items:center;gap:3px}
  .nt-win[hidden]{display:none}
  .nt-eff{color:var(--muted);font-size:11px}
  .ar-row input.nt-kw{flex:1;width:100%;text-align:left}
  .nt-help{margin:0 0 8px;padding-left:18px;font-size:12px;line-height:1.7;color:var(--muted)}
  .nt-help b{color:var(--fg)}
  .pop.settings{width:min(600px,calc(100vw - 24px));max-width:none;padding:0;max-height:min(84vh,860px);overflow-y:auto}
  .set-tabs{position:sticky;top:0;z-index:2;display:flex;gap:2px;padding:10px 10px 0;background:var(--card);border-bottom:1px solid var(--line)}
  .set-tab{white-space:nowrap;border:1px solid transparent;border-bottom:none;border-radius:10px 10px 0 0;background:transparent;padding:8px 11px;font-size:13px;color:var(--muted);margin-bottom:-1px}
  .set-tab:hover{background:var(--card2)}
  .set-tab.on{background:var(--bg);color:var(--fg);font-weight:700;border-color:var(--line);border-bottom:1px solid var(--bg)}
  .set-body{padding:14px 16px 16px;background:var(--bg)}
  .acc{border:1px solid var(--line);border-radius:10px;padding:2px 12px;margin:10px 0}
  .acc summary{cursor:pointer;font-size:13px;font-weight:600;padding:9px 0;list-style:none;display:flex;align-items:center;gap:6px}
  .acc summary::-webkit-details-marker{display:none}
  .acc summary::before{content:"▸";transition:transform .15s;display:inline-block}
  .acc[open] summary::before{transform:rotate(90deg)}
  .acc summary small{font-weight:400;color:var(--muted);font-size:11px}
  .cm-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 2px;font-size:13px}
  .cm-seg{display:flex;gap:4px}
  .cm-seg button{padding:5px 12px;border-radius:8px;font-size:12px}
  .cm-seg button.on{background:var(--fg);color:var(--bg);font-weight:700;border-color:var(--fg)}
  .setbtn{margin-left:4px}
  .toolbar select.thumbsel,.toolbar select.cntsel{min-width:0}
  .ar .bk-sub{margin-top:12px}
  .ar-row{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13px;margin:6px 2px}
  .ar-row span{display:flex;flex-direction:column}
  .ar-row em{font-style:normal;color:var(--muted);font-size:11px}
  .ar-row input{width:64px;padding:5px 8px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--fg);font:inherit;text-align:right}
  .ar-kws{display:flex;flex-direction:column;gap:6px;margin:6px 0 10px}
  .ar-kw{display:grid;grid-template-columns:120px 1fr;gap:8px;align-items:center;font-size:12px}
  .ar-kw span{display:flex;align-items:center;gap:6px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
  .ar-kw i{width:9px;height:9px;border-radius:3px;flex:none}
  .ar-kw input{min-width:0;padding:5px 8px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--fg);font:inherit}
  .ar code{background:var(--card2);padding:0 4px;border-radius:4px}
  .ghostlink{border:none;background:transparent;color:var(--muted);font-size:12px;padding:4px 2px;text-decoration:underline}
  .pal-title{font-size:12px;color:var(--muted);padding:2px 4px 8px}
  .pal{display:grid;grid-template-columns:repeat(8,26px);gap:6px}
  .sw{width:26px;height:26px;padding:0;border-radius:7px;border:2px solid rgba(128,128,128,.35)}
  .sw:hover{transform:scale(1.12);filter:none}
  .sw.cur{outline:2px solid var(--fg);outline-offset:1px}
  .custom{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;padding:6px 4px 2px;border-top:1px solid var(--line);font-size:13px}
  .custom input{width:48px;height:28px;padding:0;border-radius:6px;cursor:pointer}
  .mi{display:flex;width:100%;align-items:center;gap:14px;border:none;background:transparent;border-radius:8px;padding:9px 12px;text-align:left}
  .mi:hover{background:var(--card2)}
  .mi span{flex:1}
  .mi .ck{flex:none;display:flex}
  div.mi{cursor:default}
  @media (max-width:860px){aside{width:200px}.search{width:100%}.progress{display:none}}
  `;

  return { open, close, isOpen: () => !!host };
})();

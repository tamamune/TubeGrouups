// 視聴記録画面
(async () => {
  const $ = s => document.querySelector(s);
  const esc = TG.esc;
  const PAGE = 50;
  let period = 7, rows = [], shown = 0, D = null;

  const fmtDur = sec => {
    sec = Math.round(sec || 0);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    if (h) return `${h}時間${m}分`;
    if (m) return `${m}分`;
    return `${sec}秒`;
  };
  const clock = sec => {
    sec = Math.round(sec || 0);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  };
  const num = n => (n ? n.toLocaleString('ja-JP') : '—');
  const when = t => {
    const d = new Date(t);
    const today = TG.dayKey() === TG.dayKey(t);
    return today ? `今日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  async function loadAll() {
    const [d, st] = await Promise.all([
      TG.load(),
      chrome.storage.local.get(['history', 'daily', 'statsPeriod', 'rydOn', 'rydCache', 'ytHistOn', 'lastHistImport'])
    ]);
    period = st.statsPeriod ?? 7;
    D = { ...d, history: st.history || {}, daily: st.daily || {}, ryd: !!st.rydOn, rydCache: st.rydCache || {} };
    D.fmap = TG.folderMap(D.channels, D.folders);
    D.roots = new Map(D.folders.map(f => [f.id, TG.rootOf(D.folders, f.id)]));
    $('#ryd').checked = D.ryd;
    $('#ythOn').checked = st.ytHistOn !== false;
    if (st.lastHistImport && !$('#ythMsg').dataset.busy) $('#ythMsg').textContent = `最終取り込み ${when(st.lastHistImport)}`;
    document.body.classList.toggle('ryd', D.ryd);
    try { render(); $('#err')?.remove(); }
    catch (e) { showErr(e); }
  }
  // 表示できなかったときは画面と動作ログに原因を残す
  function showErr(e) {
    console.error(e);
    TG.log('視聴記録', '表示エラー：' + (e?.stack || e?.message || e), 'error');
    let box = $('#err');
    if (!box) { box = document.createElement('div'); box.id = 'err'; box.className = 'errbox'; document.querySelector('main').prepend(box); }
    box.textContent = '視聴記録を表示できませんでした：' + (e?.message || e) + '（動作ログに詳細を残しました）';
  }
  window.addEventListener('error', e => showErr(e.error || e.message));
  window.addEventListener('unhandledrejection', e => showErr(e.reason));

  const startOf = () => {
    if (!period) return 0;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (period - 1));
    return d.getTime();
  };

  function render() {
    document.querySelectorAll('#period button').forEach(b => b.classList.toggle('on', +b.dataset.p === period));
    const start = startOf();
    const hist = Object.entries(D.history).map(([v, h]) => ({ v, ...h })).filter(h => (h.last || 0) >= start && (h.sec || 0) >= 5);

    // ---------- 集計 ----------
    const days = Object.entries(D.daily).filter(([k]) => !period || new Date(k + 'T00:00:00').getTime() >= start);
    const total = days.reduce((a, [, s]) => a + s, 0);
    const nDays = period || Math.max(1, days.length);
    const liked = hist.filter(h => h.rate === 'like').length;
    const disliked = hist.filter(h => h.rate === 'dislike').length;
    const finished = hist.filter(h => h.d && h.sec >= h.d * 0.9).length;
    $('#kpis').innerHTML = [
      ['視聴時間', fmtDur(total), period === 1 ? '今日' : `1日平均 ${fmtDur(total / nDays)}`],
      ['見た動画', `${hist.length} 本`, `最後まで見た ${finished} 本`],
      ['ショート', `${hist.filter(h => h.short).length} 本`, `通常の動画 ${hist.filter(h => !h.short).length} 本`],
      ['あなたの評価', `👍 ${liked}　👎 ${disliked}`, '高評価・低評価した動画'],
      ['チャンネル', `${new Set(hist.map(h => h.k || h.ch)).size}`, '見たチャンネルの数']
    ].map(([lb, v, s]) => `<div class="kpi"><div class="lb">${lb}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');

    renderDaily(start);
    renderFolders(hist);
    renderChannels(hist);
    renderVideos(hist, keepRows);
    keepRows = 0;
  }
  let keepRows = 0;

  function renderDaily(start) {
    const n = period || 90;
    const end = new Date(); end.setHours(0, 0, 0, 0);
    const cols = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(end); d.setDate(d.getDate() - i);
      if (period && d.getTime() < start) continue;
      const k = TG.dayKey(d.getTime());
      cols.push({ k, d, s: D.daily[k] || 0 });
    }
    const max = Math.max(60, ...cols.map(c => c.s));
    const today = TG.dayKey();
    $('#daily').innerHTML = cols.map(c => `<div class="col ${c.k === today ? 'today' : ''}">
        <span class="tip">${c.d.getMonth() + 1}/${c.d.getDate()}　${fmtDur(c.s)}</span>
        <div class="b" style="height:${(c.s / max) * 100}%"></div></div>`).join('');
    const step = Math.ceil(cols.length / 15);
    let axis = document.querySelector('.daily-axis');
    if (!axis) { axis = document.createElement('div'); axis.className = 'daily-axis'; $('#daily').after(axis); }
    axis.innerHTML = cols.map((c, i) => `<span>${i % step === 0 ? `${c.d.getMonth() + 1}/${c.d.getDate()}` : ''}</span>`).join('');
    $('#dailyNote').textContent = period ? '' : '直近90日';
  }

  // 動画のチャンネルが入っているフォルダ（トップ階層でまとめる）
  function topFolders(h) {
    const fs = D.fmap.get(h.k) || [];
    return [...new Map(fs.map(f => { const r = D.roots.get(f.id) || f; return [r.id, r]; })).values()];
  }

  function hbars(el, list, emptyMsg) {
    if (!list.length) { el.innerHTML = `<p class="muted">${emptyMsg}</p>`; return; }
    const max = Math.max(...list.map(x => x.sec));
    el.innerHTML = list.map(x => `<div class="hb">
      <span class="nm">${x.color ? `<i class="dot" style="background:${esc(x.color)}"></i>` : ''}${x.href ? `<a href="${esc(x.href)}" target="_blank">${esc(x.name)}</a>` : esc(x.name)}</span>
      <span class="track"><span class="fill" style="width:${(x.sec / max) * 100}%;${x.color ? `background:${esc(x.color)}` : ''}"></span></span>
      <span class="val">${fmtDur(x.sec)}・${x.n}本</span></div>`).join('');
  }

  function renderFolders(hist) {
    const m = new Map();
    for (const h of hist) {
      const fs = topFolders(h);
      const keys = fs.length ? fs.map(f => [f.id, f.name, f.color]) : [['__none', '未分類', '#888']];
      for (const [id, name, color] of keys) {
        const e = m.get(id) || { name, color, sec: 0, n: 0 };
        e.sec += h.sec; e.n++;
        m.set(id, e);
      }
    }
    hbars($('#folders'), [...m.values()].sort((a, b) => b.sec - a.sec), 'まだ記録がありません');
  }

  function renderChannels(hist) {
    const m = new Map();
    for (const h of hist) {
      const key = h.k || h.ch;
      if (!key) continue;
      const e = m.get(key) || { name: D.channels[h.k]?.name || h.ch || h.k, href: h.k ? TG.channelUrl(h.k) : '', sec: 0, n: 0 };
      e.sec += h.sec; e.n++;
      m.set(key, e);
    }
    hbars($('#channels'), [...m.values()].sort((a, b) => b.sec - a.sec).slice(0, 10), 'まだ記録がありません');
  }

  // ---------- 動画一覧 ----------
  function renderVideos(hist, keep = 0) {
    const q = $('#q').value.trim().toLowerCase();
    const sort = $('#sort').value;
    const pctOf = h => (h.d ? Math.min(100, (h.sec / h.d) * 100) : 0);
    const fp = +$('#fPct').value, fv = +$('#fViews').value, [l0, l1] = ($('#fLen').value || '-').split('-');
    rows = hist.filter(h => !q || (h.t || '').toLowerCase().includes(q) || (h.ch || '').toLowerCase().includes(q));
    // 絞り込み：見た割合・再生数・長さ（長さの分からない動画は長さの絞り込みで除く）
    if (fp > 0) rows = rows.filter(h => h.d && pctOf(h) >= fp); else if (fp < 0) rows = rows.filter(h => h.d && pctOf(h) < -fp);
    if (fv > 0) rows = rows.filter(h => (h.views || 0) >= fv); else if (fv < 0) rows = rows.filter(h => h.views && h.views < -fv);
    if (l0 || l1) rows = rows.filter(h => h.d && h.d >= (+l0 || 0) && (!l1 || h.d < +l1));
    $('#fReset').hidden = !(fp || fv || l0 || l1);
    if (sort === 'rate') rows = rows.filter(h => h.rate);
    const by = { last: h => h.last || 0, sec: h => h.sec || 0, views: h => h.views || 0, likes: h => h.likes || 0, rate: h => h.last || 0, pct: pctOf, dur: h => h.d || 0 }[sort];
    rows.sort((a, b) => by(b) - by(a));
    shown = 0;
    $('#videos tbody').innerHTML = '';
    $('#count').textContent = `${rows.length} 本`;
    $('#empty').hidden = rows.length > 0;
    more(Math.max(PAGE, keep));
  }

  function rowHtml(h) {
    const pct = h.d ? Math.min(100, Math.round((h.sec / h.d) * 100)) : 0;
    const tags = (D.fmap.get(h.k) || []).map(f => `<span class="tag" style="--c:${esc(f.color)}">${esc(f.name)}</span>`).join('');
    const r = D.rydCache[h.v];
    const url = h.short ? `https://www.youtube.com/shorts/${h.v}` : `https://www.youtube.com/watch?v=${h.v}`;
    return `<tr data-v="${esc(h.v)}">
      <td class="c-when">${h.src === 'yt' ? `${new Date(h.last).getMonth() + 1}/${new Date(h.last).getDate()}` : when(h.last)}</td>
      <td><div class="vid"><a href="${url}" target="_blank"><img src="https://i.ytimg.com/vi/${esc(h.v)}/mqdefault.jpg" loading="lazy" alt=""></a>
        <div><a class="t" href="${url}" target="_blank">${esc(h.t || h.v)}</a>
        <div class="c">${h.src === 'yt' || h.src === 'mix' ? '<span class="src-yt" title="YouTubeの履歴から取り込み（視聴時間は推定）">📱 履歴</span>' : ''}${h.short ? '<span class="short-tag">ショート</span>' : ''}${esc(h.ch || '')}${tags}</div></div></div></td>
      <td><div class="prog">${h.src === 'yt' ? '約' : ''}${fmtDur(h.sec)}${h.d ? ` / ${clock(h.d)}` : ''}${h.d ? `<div class="bar"><i style="width:${pct}%"></i></div>` : ''}</div></td>
      <td class="num">${num(h.views)}</td>
      <td class="num">${num(h.likes || r?.likes)}</td>
      <td class="num ryd-col" data-ryd>${r ? num(r.dislikes) : D.ryd ? '…' : ''}</td>
      <td class="c-rate">${h.rate === 'like' ? '👍' : h.rate === 'dislike' ? '👎' : ''}</td></tr>`;
  }

  function more(n = PAGE) {
    const part = rows.slice(shown, shown + (typeof n === 'number' ? n : PAGE));
    $('#videos tbody').insertAdjacentHTML('beforeend', part.map(rowHtml).join(''));
    shown += part.length;
    $('#more').hidden = shown >= rows.length;
    if (D.ryd) fetchRyd(part.map(h => h.v));
  }

  // ---------- 低評価数（Return YouTube Dislike の推定値） ----------
  let rydSaveT = null;
  async function fetchRyd(ids) {
    const need = ids.filter(v => !D.rydCache[v] || Date.now() - D.rydCache[v].at > 864e5);
    let i = 0;
    const worker = async () => {
      while (i < need.length) {
        const v = need[i++];
        try {
          const r = await fetch(`https://returnyoutubedislikeapi.com/votes?videoId=${encodeURIComponent(v)}`);
          if (!r.ok) continue;
          const j = await r.json();
          D.rydCache[v] = { at: Date.now(), dislikes: j.dislikes || 0, likes: j.likes || 0 };
          const cell = document.querySelector(`tr[data-v="${CSS.escape(v)}"] [data-ryd]`);
          if (cell) cell.textContent = num(j.dislikes);
        } catch { /* 取得できないものは空欄 */ }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    clearTimeout(rydSaveT);
    rydSaveT = setTimeout(() => chrome.storage.local.set({ rydCache: D.rydCache }), 1000);
    document.querySelectorAll('[data-ryd]').forEach(c => { if (c.textContent === '…') c.textContent = '—'; });
  }

  // ---------- 操作 ----------
  $('#period').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    period = +b.dataset.p;
    chrome.storage.local.set({ statsPeriod: period });
    render();
  });
  $('#q').addEventListener('input', () => render());
  $('#sort').addEventListener('change', () => render());
  ['#fPct', '#fViews', '#fLen'].forEach(s => $(s).addEventListener('change', () => render()));
  $('#fReset').addEventListener('click', () => { $('#fPct').value = '0'; $('#fViews').value = '0'; $('#fLen').value = ''; render(); });
  $('#more').addEventListener('click', more);
  $('#ryd').addEventListener('change', async e => {
    D.ryd = e.target.checked;
    document.body.classList.toggle('ryd', D.ryd);
    await chrome.storage.local.set({ rydOn: D.ryd });
    if (D.ryd) fetchRyd(rows.slice(0, shown).map(h => h.v));
  });
  $('#ythOn').addEventListener('change', e => chrome.storage.local.set({ ytHistOn: e.target.checked }));
  $('#ythNow').addEventListener('click', async () => {
    const b = $('#ythNow'), m = $('#ythMsg');
    b.disabled = true; m.dataset.busy = '1'; m.textContent = 'YouTubeの履歴を読み込み中…';
    const r = await chrome.runtime.sendMessage({ type: 'tg-hist-now' }).catch(e => ({ ok: false, error: e.message }));
    b.disabled = false; delete m.dataset.busy;
    m.textContent = r?.ok ? `取り込みました：新しく ${r.added} 本（PCで記録済み ${r.skippedPc} 本は重複しないよう除外）` : '取り込めませんでした：' + (r?.error || '不明なエラー');
  });
  $('#clear').addEventListener('click', async () => {
    if (!confirm('視聴記録（視聴時間・見た動画の一覧）をすべて消去しますか？\n（視聴済みの表示やフォルダ設定は消えません）')) return;
    await chrome.storage.local.remove(['history', 'daily', 'ytHistSeen', 'lastHistImport', 'dayCh', 'dayHr', 'dayYt']);
    loadAll();
  });
  // 別のタブで再生中は記録が数秒ごとに増えるので、まとめて15秒ごとに更新（表示中の行数とスクロール位置は保つ）
  let liveT = null;
  chrome.storage.onChanged.addListener(ch => {
    if (!(ch.history || ch.daily || ch.folders)) return;
    clearTimeout(liveT);
    liveT = setTimeout(() => { keepRows = shown; const y = scrollY; loadAll().then(() => scrollTo(0, y)); }, 15000);
  });

  loadAll().catch(showErr);
})();

document.getElementById('openLog')?.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'openPage', page: 'log' }));

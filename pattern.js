// 視聴パターン（視聴記録画面のタブ）
//   dayCh: { 'YYYY-MM-DD': { チャンネルキー: 秒 } }
//   dayHr: { 'YYYY-MM-DD': { 0〜23: 秒, f: 集中モードの時間帯の秒, x: そのうち見えなくしたフォルダの秒 } }
//   v4.23 より前の日は history の「最後に見た日時」から推定する
(() => {
  const $ = s => document.querySelector(s);
  const esc = TG.esc;
  const W = ['月', '火', '水', '木', '金', '土', '日'];
  const NONE = { id: '__none', name: '未分類', color: '#8a8a8a' };
  const OTHER = { id: '__other', name: '登録外・おすすめ', color: '#5c5c5c' };
  const MORE = { id: '__more', name: 'その他のフォルダ', color: '#b0b0b0' };
  let P = 'w0', D = null, editGoals = false;

  const fmt = sec => {
    sec = Math.round(sec || 0);
    const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    if (h) return `${h}時間${m ? ` ${String(m).padStart(2, '0')}分` : ''}`;
    if (m) return `${m}分`;
    return sec ? `${sec}秒` : '0分';
  };
  const short = sec => {
    const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    return h ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`;
  };
  const dayStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d; };
  const monday = t => { const d = dayStart(t); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const md = d => `${d.getMonth() + 1}/${d.getDate()}`;

  // ---------- 読み込み ----------
  async function load() {
    const [d, st] = await Promise.all([
      TG.load(),
      chrome.storage.local.get(['history', 'daily', 'dayCh', 'dayHr', 'dayYt', 'folderGoals', 'statsPat', 'focus', 'sleepWin'])
    ]);
    P = st.statsPat || P;
    D = { ...d, history: st.history || {}, daily: st.daily || {}, dayCh: st.dayCh || {}, dayHr: st.dayHr || {}, dayYt: st.dayYt || {}, sleep: { on: true, from: '23:00', to: '07:00', ...(st.sleepWin || {}) }, goals: st.folderGoals || {}, focus: { ...TG.FOCUS_DEF, ...(st.focus || {}) } };
    const fmap = TG.folderMap(D.channels, D.folders);
    const byName = new Map(Object.values(D.channels).map(c => [c.name, c.key]));
    // チャンネル → トップのフォルダ（複数なら等分）
    const cache = new Map();
    D.rootsOf = key => {
      if (cache.has(key)) return cache.get(key);
      let k = key;
      if (k?.startsWith('#')) k = byName.get(k.slice(1)) || null;
      let out;
      if (!k || !(D.channels[k] || fmap.has(k))) out = [OTHER];
      else {
        const fs = fmap.get(k) || [];
        out = fs.length ? [...new Map(fs.map(f => { const r = TG.rootOf(D.folders, f.id) || f; return [r.id, r]; })).values()] : [NONE];
      }
      cache.set(key, out);
      return out;
    };
    // 細かい記録が無い日は、視聴記録の「最後に見た日時」から推定（📱＝YouTubeの履歴から取り込んだ分）
    D.fb = {}; D.fbHr = {};
    D.names = new Map(Object.values(D.channels).map(c => [c.key, c.name]));
    for (const h of Object.values(D.history)) {
      if (h.k && h.ch && !D.names.has(h.k)) D.names.set(h.k, h.ch);
      if (!h.last || !(h.sec > 0)) continue;
      const k = TG.dayKey(h.last), yt = h.src === 'yt';
      const o = (D.fb[k] ||= { pc: {}, yt: {}, spc: 0, syt: 0 });
      const ck = h.k || (h.ch ? '#' + h.ch : '');
      o[yt ? 'yt' : 'pc'][ck] = (o[yt ? 'yt' : 'pc'][ck] || 0) + h.sec;
      if (h.short) o[yt ? 'syt' : 'spc'] += h.sec;
      if (!yt && !D.dayHr[k]) { const x = (D.fbHr[k] ||= {}); const hr = new Date(h.last).getHours(); x[hr] = (x[hr] || 0) + h.sec; }
    }
    D.dd = new Map();
  }

  // その日の記録 { pc:{チャンネル:秒}, yt:{…}, short:秒, rest:秒（日ごとの合計との差） }
  function dayData(k) {
    if (D.dd.has(k)) return D.dd.get(k);
    const fb = D.fb[k] || { pc: {}, yt: {}, spc: 0, syt: 0 };
    const pc = D.dayCh[k] || fb.pc;
    const ytRaw = D.dayYt[k];
    const yt = ytRaw ? Object.fromEntries(Object.entries(ytRaw).filter(([c]) => c !== '~s')) : fb.yt;
    const short = (D.dayHr[k] ? D.dayHr[k].s || 0 : fb.spc) + (ytRaw ? ytRaw['~s'] || 0 : fb.syt);
    const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
    const pcSum = sum(pc), ytSum = sum(yt);
    const rest = Math.max(0, (D.daily[k] || 0) - pcSum - ytSum);
    const out = { pc, yt, short, pcSum: pcSum + (rest > 60 ? rest : 0), ytSum, rest: rest > 60 ? rest : 0 };
    D.dd.set(k, out);
    return out;
  }
  // その日のフォルダ別の秒 { フォルダID: 秒 }（日ごとの合計のほうが多い分は未分類に）
  function dayFolders(k) {
    const x = dayData(k), out = {};
    for (const src of [x.pc, x.yt]) for (const [ck, sec] of Object.entries(src)) {
      const rs = D.rootsOf(ck);
      rs.forEach(r => { out[r.id] = (out[r.id] || 0) + sec / rs.length; });
    }
    if (x.rest) out[NONE.id] = (out[NONE.id] || 0) + x.rest;
    return out;
  }
  const chName = ck => ck.startsWith('#') ? ck.slice(1) : D.names.get(ck) || ck || '（不明）';
  const hoursOf = k => D.dayHr[k] || D.fbHr[k] || {};
  const daysOf = R => { const t = dayStart(Date.now()); return R.cols.flatMap(c => c.days).filter(d => d <= t).map(d => TG.dayKey(d.getTime())); };
  const infoOf = id => id === NONE.id ? NONE : id === OTHER.id ? OTHER : id === MORE.id ? MORE : D.folders.find(f => f.id === id) || { id, name: '（消したフォルダ）', color: '#777' };

  // ---------- 期間 ----------
  function range(p = P) {
    const today = dayStart(Date.now());
    if (/^w\d$/.test(p)) {
      const s = addDays(monday(Date.now()), -7 * +p[1]);
      const cols = W.map((w, i) => { const d = addDays(s, i); return { label: w, sub: md(d), days: [d], future: d > today }; });
      return { from: s, to: addDays(s, 6), cols, weeks: 1, title: '曜日 × フォルダ' };
    }
    if (p === '4w') {
      const s = addDays(monday(Date.now()), -21);
      const cols = [0, 1, 2, 3].map(i => { const a = addDays(s, i * 7); return { label: `${md(a)}〜`, days: Array.from({ length: 7 }, (_, j) => addDays(a, j)) }; });
      return { from: s, to: addDays(s, 27), cols, weeks: 4, title: '週 × フォルダ' };
    }
    const now = new Date();
    const cols = [5, 4, 3, 2, 1, 0].map(i => {
      const a = new Date(now.getFullYear(), now.getMonth() - i, 1), b = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const days = [];
      for (let d = a; d <= b && d <= today; d = addDays(d, 1)) days.push(d);
      return { label: `${a.getMonth() + 1}月`, days };
    });
    const from = cols[0].days[0];
    return { from, to: today, cols, weeks: Math.max(1, (today - from) / 864e5 / 7), title: '月 × フォルダ' };
  }

  // ---------- 描画 ----------
  function render() {
    document.querySelectorAll('#pPeriod button').forEach(b => b.classList.toggle('on', b.dataset.p === P));
    const R = range();
    const today = dayStart(Date.now());
    $('#pRange').textContent = `${md(R.from)}〜${md(R.to)}`;
    // 列ごと・フォルダごとの秒
    const tot = {};
    R.cols.forEach(c => {
      c.f = {};
      c.days.forEach(d => { if (d <= today) for (const [id, s] of Object.entries(dayFolders(TG.dayKey(d.getTime())))) c.f[id] = (c.f[id] || 0) + s; });
      c.sum = Object.values(c.f).reduce((a, b) => a + b, 0);
      for (const [id, s] of Object.entries(c.f)) tot[id] = (tot[id] || 0) + s;
    });
    // 表示するフォルダ（多い順に7つまで、残りは「その他のフォルダ」）
    let order = Object.entries(tot).filter(([, s]) => s >= 30).sort((a, b) => b[1] - a[1]).map(([id]) => id);
    const special = [NONE.id, OTHER.id];
    let main = order.filter(id => !special.includes(id));
    const rest = main.slice(7);
    main = main.slice(0, 7);
    if (rest.length) {
      R.cols.forEach(c => { rest.forEach(id => { if (c.f[id]) { c.f[MORE.id] = (c.f[MORE.id] || 0) + c.f[id]; delete c.f[id]; } }); });
      tot[MORE.id] = rest.reduce((a, id) => a + tot[id], 0);
      rest.forEach(id => delete tot[id]);
      main.push(MORE.id);
    }
    order = [...main, ...special.filter(id => tot[id] >= 30)];
    const total = order.reduce((a, id) => a + tot[id], 0);
    const elapsed = R.cols.flatMap(c => c.days).filter(d => d <= today);
    // 1週あたりの平均は、記録がある最初の日から数える
    if (R.weeks > 1) {
      const first = elapsed.find(d => sumDay(d) > 0);
      if (first) R.weeks = Math.max(1, Math.min(R.weeks, (Math.round((today - first) / 864e5) + 1) / 7));
    }

    renderKpis(R, total, tot, order, elapsed);
    renderStack(R, order, tot, total);
    renderMix(R, total);
    renderTop(R, total);
    renderGoals(R, tot);
    renderHeat(R);
  }

  function renderKpis(R, total, tot, order, elapsed) {
    const nDays = Math.max(1, elapsed.length);
    // 比べる相手：今週は「先週の同じ曜日まで」、ほかは1つ前の同じ長さ
    let prev = 0, prevLabel = '';
    if (P === 'w0' || P === 'w1') {
      const pr = range(P === 'w0' ? 'w1' : 'w2');
      const days = P === 'w0' ? pr.cols.slice(0, nDays).flatMap(c => c.days) : pr.cols.flatMap(c => c.days);
      prev = days.reduce((a, d) => a + sumDay(d), 0);
      prevLabel = P === 'w0' ? '先週の同じ曜日まで' : '先々週';
    } else {
      const len = Math.round((dayStart(Date.now()) - R.from) / 864e5) + 1;
      for (let i = 1; i <= len; i++) prev += sumDay(addDays(R.from, -i));
      prevLabel = 'その前の同じ日数';
    }
    const diff = total - prev;
    const best = elapsed.map(d => [d, sumDay(d)]).sort((a, b) => b[1] - a[1])[0];
    const top = order.filter(id => id !== NONE.id && id !== OTHER.id && id !== MORE.id)[0] || order[0];
    let f = 0, x = 0;
    elapsed.forEach(d => { const h = hoursOf(TG.dayKey(d.getTime())); f += h.f || 0; x += h.x || 0; });
    const usesFocus = D.focus.on || f > 0 || (D.focus.tempUntil || 0) > Date.now();
    const per = { w0: '今週', w1: '先週', '4w': '4週間', m: '6か月' }[P];
    const card = (lb, v, s) => `<div class="kpi"><div class="lb">${lb}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
    $('#pKpis').innerHTML = [
      card(`${per}の視聴時間`, fmt(total), prev ? `<span class="${diff > 0 ? 'up' : 'dn'}">${diff >= 0 ? '▲' : '▼'} ${prevLabel}より ${diff >= 0 ? '+' : '−'}${fmt(Math.abs(diff))}</span>` : `${prevLabel}の記録はありません`),
      card('1日平均', fmt(total / nDays), best && best[1] ? `いちばん多い日：${md(best[0])}（${W[(best[0].getDay() + 6) % 7]}） ${fmt(best[1])}` : ''),
      card('いちばん見たフォルダ', top ? esc(infoOf(top).name) : '—', top && total ? `全体の ${Math.round((tot[top] / total) * 100)}%` : ''),
      card('🎯 集中モードの時間帯', usesFocus ? fmt(f) : '—', usesFocus ? (f ? `そのうち見えなくしたフォルダ ${fmt(x)}` : 'この期間は見ていません') : '集中モードは使っていません')
    ].join('');
  }
  const sumDay = d => Object.values(dayFolders(TG.dayKey(d.getTime()))).reduce((a, b) => a + b, 0);

  function renderStack(R, order, tot, total) {
    $('#pStackTitle').textContent = R.title;
    const max = Math.max(600, ...R.cols.map(c => c.sum));
    $('#pStack').innerHTML = R.cols.map(c => `<div class="pcol${c.future ? ' fut' : ''}" title="${esc(c.label)}${c.sub ? ' ' + c.sub : ''}　${fmt(c.sum)}">
        <span class="ptot">${c.sum >= 60 ? (c.sum / 3600).toFixed(1) + 'h' : ''}</span>
        <div class="pbar" style="height:${(c.sum / max) * 100}%">${order.slice().reverse().map(id => c.f[id] ? `<i style="flex:${c.f[id]};background:${esc(infoOf(id).color)}" title="${esc(infoOf(id).name)} ${fmt(c.f[id])}"></i>` : '').join('')}</div>
        <span class="plab">${esc(c.label)}${c.sub ? `<small>${c.sub}</small>` : ''}</span></div>`).join('');
    $('#pLegend').innerHTML = order.map(id => `<span><i style="background:${esc(infoOf(id).color)}"></i>${esc(infoOf(id).name)}${total ? ` <b>${Math.round((tot[id] / total) * 100)}%</b>` : ''}</span>`).join('');
  }

  // ドーナツ（parts: [{ name, color, sec }]）
  function donut(parts, center, sub) {
    const total = parts.reduce((a, x) => a + x.sec, 0);
    const cx = 80, cy = 80, R1 = 72, R2 = 46;
    let a = -Math.PI / 2, paths = '';
    const pt = (r, t) => `${(cx + r * Math.cos(t)).toFixed(2)} ${(cy + r * Math.sin(t)).toFixed(2)}`;
    parts.forEach(x => {
      const v = total ? x.sec / total : 0;
      if (v <= 0) return;
      const b = a + Math.min(v, 0.9999) * 2 * Math.PI, lg = v > 0.5 ? 1 : 0;
      paths += `<path d="M${pt(R1, a)} A${R1} ${R1} 0 ${lg} 1 ${pt(R1, b)} L${pt(R2, b)} A${R2} ${R2} 0 ${lg} 0 ${pt(R2, a)}Z" fill="${x.color}" stroke="var(--card)" stroke-width="2"><title>${esc(x.name)} ${Math.round(v * 100)}%</title></path>`;
      a = b;
    });
    if (!paths) paths = `<circle cx="${cx}" cy="${cy}" r="${(R1 + R2) / 2}" fill="none" stroke="var(--chip)" stroke-width="${R1 - R2}"/>`;
    return `<svg viewBox="0 0 160 160" width="150" height="150">${paths}<text x="80" y="80" text-anchor="middle" class="pc1">${center}</text><text x="80" y="98" text-anchor="middle" class="pc2">${sub}</text></svg>
      <div class="plist">${parts.map(x => `<div><i style="background:${x.color}"></i><span>${esc(x.name)}</span><b>${total ? Math.round((x.sec / total) * 100) : 0}%</b><small>${fmt(x.sec)}</small></div>`).join('')}</div>`;
  }
  // 見かたの内訳：ショートと通常の動画 ／ このPCとほかの端末
  function renderMix(R, total) {
    let short = 0, pc = 0, yt = 0;
    daysOf(R).forEach(k => { const x = dayData(k); short += x.short; pc += x.pcSum; yt += x.ytSum; });
    short = Math.min(short, total);
    const sr = total ? short / total : 0;
    $('#pMix').innerHTML = total ? `
      <div class="pmix"><div class="pmix-h">形式</div>${donut([{ name: 'ショート', color: '#ff4e45', sec: short }, { name: '通常の動画', color: '#3ea6ff', sec: total - short }], `${Math.round(sr * 100)}%`, 'ショート')}</div>
      <div class="pmix"><div class="pmix-h">端末</div>${donut([{ name: 'このPC', color: '#7e57c2', sec: pc }, { name: '📱 ほかの端末', color: '#26a69a', sec: yt }], `${pc + yt ? Math.round((yt / (pc + yt)) * 100) : 0}%`, 'ほかの端末')}</div>
      ${sr >= 0.3 ? `<div class="pnote warn pmix-note">⚠ 視聴時間の ${Math.round(sr * 100)}% がショートです。ショートは次々に流れて止めどきが無いので、気づかないうちに時間を使いがちです。</div>` : ''}
      <p class="muted pmix-foot">ほかの端末＝YouTubeの履歴から取り込んだ分（スマホ・テレビなど。視聴時間は推定）</p>`
      : '<p class="muted">この期間の記録はまだありません。</p>';
  }
  // 時間を使ったチャンネル TOP3
  function renderTop(R, total) {
    const m = new Map();
    daysOf(R).forEach(k => { const x = dayData(k); for (const src of [x.pc, x.yt]) for (const [ck, sec] of Object.entries(src)) if (ck) m.set(ck, (m.get(ck) || 0) + sec); });
    // 「#名前」（ショートで名前だけ分かったもの）は同じ名前のチャンネルにまとめる
    const merged = new Map();
    for (const [ck, sec] of m) {
      const key = ck.startsWith('#') ? ([...D.names].find(([, n]) => n === ck.slice(1))?.[0] || ck) : ck;
      merged.set(key, (merged.get(key) || 0) + sec);
    }
    const top = [...merged].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const lock = D.focus.type !== 'allow' ? new Set(D.focus.lock || []) : null;
    $('#pTop').innerHTML = top.length ? top.map(([ck, sec], i) => {
      const rs = D.rootsOf(ck).filter(r => r.id !== NONE.id && r.id !== OTHER.id);
      const href = ck.startsWith('#') ? '' : 'https://www.youtube.com/' + ck.replace(/^channel\//, 'channel/');
      const locked = lock && rs.length && rs.every(r => lock.has(r.id));
      return `<div class="ptop"><span class="rk rk${i + 1}">${i + 1}</span>
        <span class="nm">${href ? `<a href="${esc(href)}" target="_blank">${esc(chName(ck))}</a>` : esc(chName(ck))}${rs.map(r => `<em style="--c:${esc(r.color)}">${esc(r.name)}</em>`).join('')}</span>
        <span class="tm"><b>${(sec / 3600).toFixed(1)}h</b><small>${total ? Math.round((sec / total) * 100) : 0}%</small></span>
        ${lock && rs.length ? (locked ? '<span class="lk">🔒 集中モードで隠す設定済み</span>' : `<button class="small" data-plock="${esc(rs.map(r => r.id).join(','))}" title="集中モードの時間帯に、このチャンネルが入っているフォルダを見えなくします">🔒 集中モードで隠す</button>`) : ''}</div>`;
    }).join('') : '<p class="muted">この期間の記録はまだありません。</p>';
  }

  // ---------- 目安と実績 ----------
  function renderGoals(R, tot) {
    const roots = D.folders.filter(f => !f.parent);
    const perWeek = id => (tot[id] || 0) / R.weeks;
    $('#pGoalNote').textContent = R.weeks === 1 ? '白い線が目安' : '1週あたりの平均・白い線が目安';
    $('#pGoalEdit').textContent = editGoals ? '保存' : '目安を変更';
    if (editGoals) {
      $('#pGoals').innerHTML = `<p class="muted">1週間に見てもいい時間（空欄＝目安なし）</p>` + roots.map(f => `<label class="pgrow edit"><span class="n"><i style="background:${esc(f.color)}"></i>${esc(f.name)}</span>
          <input type="number" min="0" step="0.5" data-goal="${esc(f.id)}" value="${D.goals[f.id] ? +(D.goals[f.id] / 60).toFixed(1) : ''}" placeholder="—"> 時間 / 週</label>`).join('');
      $('#pAdvice').innerHTML = '';
      return;
    }
    const ids = roots.map(f => f.id).filter(id => D.goals[id] || perWeek(id) >= 60).sort((a, b) => perWeek(b) - perWeek(a));
    [NONE.id, OTHER.id].forEach(id => { if (perWeek(id) >= 60) ids.push(id); });
    if (!ids.length) { $('#pGoals').innerHTML = '<p class="muted">この期間の記録はまだありません。</p>'; }
    else {
      const max = Math.max(...ids.map(id => Math.max(perWeek(id), (D.goals[id] || 0) * 60))) * 1.1;
      $('#pGoals').innerHTML = ids.map(id => {
        const f = infoOf(id), sec = perWeek(id), g = (D.goals[id] || 0) * 60, over = g && sec > g;
        return `<div class="pgrow"><span class="n"><i style="background:${esc(f.color)}"></i>${esc(f.name)}</span>
          <span class="tr"><span class="fl" style="width:${(sec / max) * 100}%;background:${esc(f.color)}"></span>${g ? `<span class="gl" style="left:${(g / max) * 100}%"></span>` : ''}</span>
          <span class="v${over ? ' over' : ''}">${short(sec)}${g ? ' / ' + short(g) : ''}</span></div>`;
      }).join('');
    }
    renderAdvice(R, perWeek, roots);
  }

  function renderAdvice(R, perWeek, roots) {
    const now = Date.now();
    const F = D.focus;
    const tempOn = (F.tempUntil || 0) > now;
    const until = t => new Date(t).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    let html = '';
    if (tempOn) {
      const names = (F.tempAllow || []).map(id => infoOf(id).name).join('・');
      html += `<div class="pnote ok">🎯 いま「${esc(names)}」だけに集中中（〜${until(F.tempUntil)}）　<button class="small" data-pend>終了する</button></div>`;
    }
    const goals = roots.filter(f => D.goals[f.id]);
    if (!goals.length) {
      html += `<div class="pnote">「目安を変更」でフォルダごとに1週間の目安を決めると、超えたときにここでお知らせします。</div>`;
    } else {
      const over = goals.map(f => [f, perWeek(f.id) - D.goals[f.id] * 60]).filter(([, d]) => d > 60).sort((a, b) => b[1] - a[1]);
      const under = goals.map(f => [f, D.goals[f.id] * 60 - perWeek(f.id)]).filter(([, d]) => d > 60).sort((a, b) => b[1] - a[1]);
      const wk = R.weeks === 1 ? (P === 'w0' ? '今週' : '先週') : '1週あたり';
      if (over.length) html += `<div class="pnote warn">⚠ ${over.map(([f, d]) => `「${esc(f.name)}」が${wk}の目安を ${fmt(d)}`).join('、')} 超えています。</div>`;
      else html += `<div class="pnote ok">✓ ${wk}はどのフォルダも目安の中です。</div>`;
      if (under.length && !tempOn) {
        const [f, d] = under[0];
        html += `<div class="pfocus">まだ見られる：「${esc(f.name)}」あと ${fmt(d)}
          <span class="pfbtns"><select id="pMin"><option value="30">30分</option><option value="60" selected>1時間</option><option value="120">2時間</option></select>
          <button class="pbtn" data-pfocus="${esc(f.id)}">🎯 「${esc(f.name)}」だけに集中して見る</button></span></div>`;
      }
    }
    if (!tempOn && roots.length && !html.includes('data-pfocus')) {
      html += `<div class="pfocus">フォルダを選んで集中：<span class="pfbtns"><select id="pFold">${roots.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}</select>
        <select id="pMin"><option value="30">30分</option><option value="60" selected>1時間</option><option value="120">2時間</option></select>
        <button class="pbtn" data-pfocus="">🎯 集中して見る</button></span></div>`;
    }
    $('#pAdvice').innerHTML = html;
  }

  // ---------- 時間帯（就寝時間・作業時間を重ねて表示） ----------
  const hm = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) + (m || 0) / 60; };
  const inWin = (h, from, to) => { const a = hm(from), b = hm(to); return a <= b ? h + 0.5 > a && h + 0.5 < b : h + 0.5 > a || h + 0.5 < b; };
  // 曜日 w（月=0）の h 時が作業時間（集中モードの時間帯）か。日をまたぐ時間帯は始まった日の曜日で
  function isWork(w, h) {
    if (!D.focus.on) return false;
    const jsDay = (w + 1) % 7;
    return (D.focus.slots || []).some(sl => {
      const a = hm(sl.from), b = hm(sl.to), x = h + 0.5;
      if (a <= b) return sl.days?.includes(jsDay) && x > a && x < b;
      return (sl.days?.includes(jsDay) && x > a) || (sl.days?.includes((jsDay + 6) % 7) && x < b);
    });
  }
  const isSleep = h => D.sleep.on && inWin(h, D.sleep.from, D.sleep.to);
  function renderHeat(R) {
    const today = dayStart(Date.now());
    const grid = W.map(() => Array(24).fill(0));
    R.cols.flatMap(c => c.days).forEach(d => {
      if (d > today) return;
      const h = hoursOf(TG.dayKey(d.getTime())), w = (d.getDay() + 6) % 7;
      for (let i = 0; i < 24; i++) grid[w][i] += h[i] || 0;
    });
    const max = Math.max(1, ...grid.flat());
    let sleepSec = 0, workSec = 0;
    grid.forEach((r, w) => r.forEach((v, i) => { if (isSleep(i)) sleepSec += v; else if (isWork(w, i)) workSec += v; }));
    const bins = Array(24).fill(0);
    grid.forEach(r => r.forEach((v, i) => { bins[i] += v; }));
    const peak = bins.indexOf(Math.max(...bins));
    $('#pHeatNote').textContent = Math.max(...bins) ? `いちばん多いのは ${peak}〜${peak + 1}時` : '';
    const cls = (w, i) => (isSleep(i) ? 'sl' : isWork(w, i) ? 'wk' : '') + (grid[w][i] >= 60 && (isSleep(i) || isWork(w, i)) ? ' hit' : '');
    $('#pHeat').innerHTML = `<div class="hm">${grid.map((r, w) => `<span class="hw">${W[w]}</span>${r.map((v, i) => `<i class="${cls(w, i)}" style="--a:${v ? (0.15 + 0.85 * v / max).toFixed(2) : 0}" title="${W[w]} ${i}〜${i + 1}時　${fmt(v)}${isSleep(i) ? '（就寝時間）' : isWork(w, i) ? '（作業時間）' : ''}"></i>`).join('')}`).join('')}
      <span></span>${Array.from({ length: 24 }, (_, i) => `<span class="hx">${i % 6 === 0 ? i + '時' : ''}</span>`).join('')}</div>
      <div class="hleg"><span><i class="sl"></i>就寝時間 <input type="time" data-sleep="from" value="${esc(D.sleep.from)}">〜<input type="time" data-sleep="to" value="${esc(D.sleep.to)}">
        <label><input type="checkbox" data-sleep="on" ${D.sleep.on ? 'checked' : ''}>表示</label></span>
        <span><i class="wk"></i>作業時間＝集中モードの時間帯${D.focus.on ? '' : '（集中モードがオフのため表示なし）'}</span></div>
      <div class="hsum">${D.sleep.on ? `<span class="${sleepSec >= 1800 ? 'bad' : ''}">🌙 就寝時間に見た：<b>${fmt(sleepSec)}</b></span>` : ''}${D.focus.on ? `<span class="${workSec >= 1800 ? 'bad' : ''}">💼 作業時間に見た：<b>${fmt(workSec)}</b></span>` : ''}</div>`;
  }

  // ---------- 操作 ----------
  document.addEventListener('click', async e => {
    const pb = e.target.closest('#pPeriod button');
    if (pb) { P = pb.dataset.p; chrome.storage.local.set({ statsPat: P }); render(); return; }
    if (e.target.closest('#pGoalEdit')) {
      if (editGoals) {
        const g = {};
        document.querySelectorAll('[data-goal]').forEach(i => { const h = parseFloat(i.value); if (h > 0) g[i.dataset.goal] = Math.round(h * 60); });
        D.goals = g;
        await chrome.storage.local.set({ folderGoals: g, prefsAt: Date.now() });
      }
      editGoals = !editGoals;
      render();
      return;
    }
    const fb = e.target.closest('[data-pfocus]');
    if (fb) {
      const id = fb.dataset.pfocus || $('#pFold')?.value;
      const min = +($('#pMin')?.value || 60);
      if (!id) return;
      const F = await TG.focusCfg();
      F.tempUntil = Date.now() + min * 60e3; F.tempAllow = [id]; F.unlockUntil = 0;
      await chrome.storage.local.set({ focus: F, activeGroup: id, feedType: 'video', prefsAt: Date.now() });
      TG.log('集中モード', `「${infoOf(id).name}」だけに ${min} 分集中（視聴パターンから）`);
      D.focus = F;
      render();
      window.open('https://www.youtube.com/feed/subscriptions', '_blank');
      return;
    }
    const lk = e.target.closest('[data-plock]');
    if (lk) {
      const F = await TG.focusCfg();
      F.lock = [...new Set([...(F.lock || []), ...lk.dataset.plock.split(',')])];
      await chrome.storage.local.set({ focus: F, prefsAt: Date.now() });
      TG.log('集中モード', `視聴パターンから「${lk.dataset.plock.split(',').map(id => infoOf(id).name).join('・')}」を隠すフォルダに追加`);
      D.focus = F;
      render();
      if (!F.on) alert('隠すフォルダに追加しました。\n集中モードはまだオフです。YouTube の ⚙ →「🎯 集中モード」で時間帯を決めてオンにしてください。');
      return;
    }
    if (e.target.closest('[data-pend]')) {
      const F = await TG.focusCfg();
      F.tempUntil = 0; F.tempAllow = [];
      await chrome.storage.local.set({ focus: F, prefsAt: Date.now() });
      TG.log('集中モード', '一時的な集中を終了');
      D.focus = F;
      render();
    }
  });

  document.addEventListener('change', async e => {
    const i = e.target.closest?.('[data-sleep]');
    if (!i) return;
    D.sleep = { ...D.sleep, [i.dataset.sleep]: i.type === 'checkbox' ? i.checked : i.value };
    await chrome.storage.local.set({ sleepWin: D.sleep, prefsAt: Date.now() });
    render();
  });

  // ---------- タブ（記録 / 視聴パターン） ----------
  let view = 'log';
  async function setView(v) {
    view = v;
    document.querySelectorAll('#view button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    $('#v-pat').hidden = v !== 'pat';
    $('#v-log').hidden = v === 'pat';
    document.body.classList.toggle('pat', v === 'pat');
    if (v === 'pat') { try { await load(); render(); } catch (e) { console.error(e); TG.log('視聴パターン', '表示エラー：' + (e?.stack || e), 'error'); } }
  }
  document.querySelectorAll('#view button').forEach(b => b.addEventListener('click', () => { chrome.storage.local.set({ statsView: b.dataset.v }); setView(b.dataset.v); }));
  const qv = new URLSearchParams(location.search).get('view');
  chrome.storage.local.get('statsView').then(({ statsView }) => setView(qv || statsView || 'log'));
  // 再生中の記録・フォルダ分けの変更を反映（15秒ごとにまとめて）
  let t = null;
  chrome.storage.onChanged.addListener(ch => {
    if (view !== 'pat' || editGoals) return;
    if (!(ch.dayCh || ch.dayHr || ch.daily || ch.folders || ch.channels || ch.folderGoals || ch.focus || ch.dayYt)) return;
    clearTimeout(t);
    t = setTimeout(async () => { await load(); render(); }, ch.focus || ch.folderGoals ? 300 : 15000);
  });
})();

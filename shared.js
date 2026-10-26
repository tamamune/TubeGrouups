// 共通ヘルパー（content / manager / feed / popup で共有）
// 保存形式:
//   channels: { [key]: { key, id, name, thumb, hidden, unsub } }   key = "@handle" または "channel/UCxxxx"
//   folders:  [ { id, name, color, parent, collapsed, keys: [key...] } ]   parent=親フォルダID（null=トップ）
//   meta:     { [key]: { last, interval, count, at } }
//   activeGroup: null(すべて) / "__unsorted" / フォルダID
//   feedType: "video" | "live" | "short"     cols: 3 | 4 | 5
const TG = {
  // ---------- 動作ログ ----------
  // TG.log('カテゴリ', 'メッセージ', 'info'|'warn'|'error')
  // 保存はバックグラウンドだけが行う（同時書き込みで消えないように）。ページ側は2秒ごとにまとめて送る
  LOG_MAX: 2000,
  _logBuf: [], _logT: null,
  log(cat, msg, level = 'info') {
    const src = typeof window === 'undefined' ? 'bg' : location.protocol === 'chrome-extension:' ? 'page' : 'yt';
    TG._logBuf.push({ t: Date.now(), c: cat, m: String(msg), l: level, s: src });
    if (!TG._logT) TG._logT = setTimeout(TG._flushLog, src === 'bg' ? 500 : 2000);
  },
  async _flushLog() {
    TG._logT = null;
    const items = TG._logBuf.splice(0);
    if (!items.length) return;
    if (typeof window === 'undefined') return TG.writeLog(items);
    try { await chrome.runtime.sendMessage({ type: 'tg-log', items }); } catch { /* 拡張機能の更新直後など */ }
  },
  _logChain: Promise.resolve(),
  writeLog(items) {
    TG._logChain = TG._logChain.then(async () => {
      const { tgLog = [] } = await chrome.storage.local.get('tgLog');
      await chrome.storage.local.set({ tgLog: tgLog.concat(items).slice(-TG.LOG_MAX) });
    }).catch(() => {});
    return TG._logChain;
  },

  // ---------- 通知のルール ----------
  //   folders: { フォルダID: { mode: 'off'|'now'|'window'|'kw', level: 'high'|'normal'|'low', from: 'HH:MM', to: 'HH:MM' } }
  //   mode … now＝すぐ ／ window＝決めた時間帯だけ（時間外の新着は時間帯の始めにまとめて）／ kw＝キーワードを含むときだけすぐ
  //   kw: 例外キーワード（カンマ区切り）… 含む動画はフォルダの設定に関係なくすぐ通知（kwAll=true なら通知オフ・未分類も）
  //   live: 登録チャンネルの配信 { on, scope: 'all'|'notify', upcoming, level }
  //   show: 'pc'（Windowsの通知）|'page'（YouTube画面の右下からスライド）|'both'   interval: 確認の間隔（分）
  NOTIFY_DEF: {
    folders: {}, kw: 'LIVE, 生配信, 配信中, 速報', kwLevel: 'high', kwAll: false,
    live: { on: true, scope: 'all', upcoming: false, level: 'high' },
    show: 'both', interval: 15
  },
  async notifyRules() {
    const { notifyRules, notifyFolders = [] } = await chrome.storage.local.get(['notifyRules', 'notifyFolders']);
    const D = TG.NOTIFY_DEF;
    if (!notifyRules) { // 旧版の🔔（通知するフォルダ）を引き継ぐ
      const folders = {};
      notifyFolders.forEach(id => { folders[id] = { mode: 'now', level: 'normal' }; });
      return { ...structuredClone(D), folders };
    }
    return { ...structuredClone(D), ...notifyRules, live: { ...D.live, ...(notifyRules.live || {}) }, folders: notifyRules.folders || {} };
  },
  // フォルダの設定（無ければ親フォルダの設定を引き継ぐ）
  ruleFor(rules, folders, id) {
    const byId = new Map(folders.map(f => [f.id, f]));
    let f = byId.get(id), g = 0;
    while (f && g++ < 50) {
      const r = rules.folders[f.id];
      if (r && r.mode) return { level: 'normal', from: '19:00', to: '23:00', ...r, from_: f.id };
      f = byId.get(f.parent);
    }
    return { mode: 'off', level: 'normal' };
  },
  inWindow(from, to, t = new Date()) {
    const m = s => { const [h, mi] = String(s || '0:0').split(':').map(Number); return (h || 0) * 60 + (mi || 0); };
    const a = m(from), b = m(to), x = t.getHours() * 60 + t.getMinutes();
    return a <= b ? x >= a && x < b : x >= a || x < b; // 22:00〜6:00 のような日またぎも可
  },
  // 次に時間帯が始まる時刻
  nextWindowStart(from, t = Date.now()) {
    const [h, mi] = String(from || '19:00').split(':').map(Number);
    const d = new Date(t); d.setHours(h || 0, mi || 0, 0, 0);
    if (d.getTime() <= t) d.setDate(d.getDate() + 1);
    return d.getTime();
  },
  kwList: s => String(s || '').split(/[,、，\n]/).map(x => x.trim()).filter(Boolean),

  // フォルダ名に含まれる言葉ごとの初期キーワード
  KW_DICT: {
    '食': ['グルメ', '飯', 'めし', 'ランチ', 'ディナー', 'ラーメン', '寿司', '焼肉', '大食い', '爆食', '料理', 'レシピ', '食レポ', '食べ', 'うどん', 'カレー', '定食', 'mukbang', 'food', 'cooking'],
    'グルメ': ['グルメ', '飯', 'ランチ', 'ラーメン', '寿司', '焼肉', '食べ', '食レポ', '料理', 'cooking', 'food'],
    '大食': ['大食い', '爆食', 'デカ盛り', '完食', 'mukbang'],
    '食レポ': ['食レポ', 'グルメ', '食べ歩き', '名店', '老舗'],
    'ゲーム': ['ゲーム', '実況', 'プレイ', '攻略', 'switch', 'ps5', 'steam', 'マイクラ', 'マインクラフト', 'ポケモン', 'gaming', 'game'],
    'レトロ': ['レトロ', 'ファミコン', 'スーファミ', 'メガドライブ', '昭和', '平成'],
    'ゲームセンター': ['ゲーセン', 'クレーンゲーム', 'ufoキャッチャー', 'メダルゲーム'],
    '音楽': ['歌', 'mv', 'cover', 'カバー', '歌ってみた', '弾いてみた', 'ピアノ', 'ギター', 'ライブ', 'music', 'official'],
    'アイドル': ['アイドル', 'idol', 'ダンス', 'dance', '推し'],
    'アニメ': ['アニメ', 'anime', '声優', '漫画', 'マンガ', 'まんが', 'pv'],
    '心霊': ['心霊', '怖い', 'ホラー', '怪談', '廃墟', '都市伝説', 'ミステリー', '事故物件', 'オカルト', '呪'],
    '怪談': ['怪談', '怖い話', '実話'],
    '海外': ['海外', '外国人', '反応', '移住', '在住', '留学', 'アメリカ', '韓国', '中国', '台湾'],
    '韓国': ['韓国', 'korea', 'ソウル', '釜山', '한국'],
    '中国': ['中国', 'china', '中国人', '上海', '北京'],
    'アメリカ': ['アメリカ', 'usa', 'america', 'ニューヨーク', 'ハワイ', 'ロサンゼルス'],
    '国内': ['旅行', '観光', '日本', '温泉', '散歩', '街歩き'],
    '沖縄': ['沖縄', '那覇', '石垣', '宮古'],
    '函館': ['函館', '北斗', '五稜郭', '道南'],
    '札幌': ['札幌', 'すすきの', '北海道'],
    'ガジェット': ['ガジェット', 'レビュー', '開封', 'スマホ', 'iphone', 'pixel', 'android', 'pc', '自作', 'キーボード', 'カメラ'],
    'vlog': ['vlog', '日常', 'ルーティン', '暮らし'],
    'キャンプ': ['キャンプ', 'ソロキャン', '車中泊', 'アウトドア', '焚き火', '登山'],
    'お笑い': ['お笑い', '芸人', 'コント', '漫才', 'ドッキリ', '爆笑'],
    'スポーツ': ['スポーツ', 'サッカー', '野球', '陸上', 'バスケ', '格闘', '試合'],
    'ダンス': ['ダンス', 'dance', '踊って'],
    'モデル': ['モデル', 'グラビア', '撮影', 'ファッション']
  },
  defaultKw(name) {
    const n = (name || '').toLowerCase();
    const out = n.split(/[・\/／,、\s]+/).filter(x => x.length >= 2);
    for (const [k, v] of Object.entries(TG.KW_DICT)) if (n.includes(k.toLowerCase())) out.push(...v);
    return [...new Set(out.map(x => x.toLowerCase()))];
  },
  // フォルダの振り分け補助キーワード（未設定ならフォルダ名から自動。「-言葉」は除外語）
  folderKw(f) { const src = f.kw?.length ? f.kw : TG.defaultKw(f.name); return { inc: src.filter(x => !/^[-－ー]/.test(x.trim())).map(x => x.trim()).filter(Boolean), exc: src.filter(x => /^[-－ー]/.test(x.trim())).map(x => x.trim().slice(1)).filter(Boolean) }; },

  // 「お気に入り以外を検索」の検索語：自由入力＋フォルダのキーワード（いずれか）＋除外語
  searchQuery(folders, fid, text) {
    const f = folders.find(x => x.id === fid);
    const parts = [];
    if (text) parts.push(text.trim());
    if (f) {
      const { inc, exc } = TG.folderKw(f);
      const words = [...new Set([f.name, ...inc])].filter(Boolean).slice(0, 6);
      if (words.length) parts.push(words.map(w => (/\s/.test(w) ? `"${w}"` : w)).join(' | '));
      exc.slice(0, 5).forEach(w => parts.push('-' + w));
    }
    return parts.join(' ').trim();
  },

  // ---------- 集中モード（曜日・時間帯でフォルダを見えなくする） ----------
  //   focus: { on, slots:[{ days:[0-6], from, to }], type:'lock'|'allow', lock:[フォルダID], allow:[フォルダID],
  //            hideHome, blockWatch, unlockMin, unlockUntil }
  //   type … lock＝選んだフォルダを見えなくする ／ allow＝選んだフォルダだけ見られる（ほかは全部見えなくする）
  FOCUS_DEF: { on: false, slots: [{ days: [1, 2, 3, 4, 5], from: '09:00', to: '18:00' }], type: 'lock', lock: [], allow: [], hideHome: true, blockWatch: true, unlockMin: 15, unlockUntil: 0 },
  async focusCfg() {
    const { focus } = await chrome.storage.local.get('focus');
    return { ...structuredClone(TG.FOCUS_DEF), ...(focus || {}) };
  },
  // いま集中モードか。戻り値 { active, until（終わる時刻）, slot, unlocked（一時解除中） }
  focusState(F, t = Date.now()) {
    if (!F?.on) return { active: false };
    const d = new Date(t);
    for (const s of F.slots || []) {
      const [fh, fm] = String(s.from || '0:0').split(':').map(Number);
      const [th, tm] = String(s.to || '0:0').split(':').map(Number);
      const a = (fh || 0) * 60 + (fm || 0), b = (th || 0) * 60 + (tm || 0), x = d.getHours() * 60 + d.getMinutes();
      // 日をまたぐ時間帯（22:00〜6:00）は、始まった日の曜日で判定
      const inToday = a <= b ? x >= a && x < b : x >= a;
      const inYesterday = a > b && x < b;
      const day = inYesterday ? (d.getDay() + 6) % 7 : d.getDay();
      if ((inToday || inYesterday) && (s.days || []).includes(day)) {
        const end = new Date(t); end.setHours(th || 0, tm || 0, 0, 0);
        if (end.getTime() <= t) end.setDate(end.getDate() + 1);
        const unlocked = (F.unlockUntil || 0) > t;
        return { active: !unlocked, unlocked, until: end.getTime(), slot: s };
      }
    }
    return { active: false };
  },
  // フォルダが見えない状態か（トップのフォルダで判定）
  folderLocked(F, folders, id) {
    const root = TG.rootOf(folders, id)?.id || id;
    if (id === '__unsorted') return F.type === 'allow' && !(F.allow || []).includes('__unsorted');
    return F.type === 'allow' ? !(F.allow || []).includes(root) : (F.lock || []).includes(root);
  },
  // チャンネルが見えない状態か（fs＝そのチャンネルが入っているフォルダ、null＝登録外・不明）
  channelLocked(F, folders, fs) {
    if (F.type === 'allow') return !(fs?.length ? fs.some(f => !TG.folderLocked(F, folders, f.id)) : (F.allow || []).includes('__unsorted') && fs);
    return !!fs?.length && fs.some(f => TG.folderLocked(F, folders, f.id));
  },

  COLORS: ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#00acc1', '#1e88e5', '#8e24aa', '#ec407a', '#6d4c41', '#757575'],

  async load() {
    let { channels, folders, groups, meta, activeGroup, feedType, cols, homeCols, homeShortCols, hideWatched, recKind, newOff, recMode, sFolder, sText } =
      await chrome.storage.local.get(['channels', 'folders', 'groups', 'meta', 'activeGroup', 'feedType', 'cols', 'homeCols', 'homeShortCols', 'hideWatched', 'recKind', 'newOff', 'recMode', 'sFolder', 'sText']);
    if (!folders && Array.isArray(groups)) {
      channels = {};
      folders = groups.map(g => {
        (g.channels || []).forEach(c => {
          channels[c.key] ??= { key: c.key, id: null, name: c.name || c.key, thumb: '', hidden: false };
        });
        return { id: g.id, name: g.name, color: g.color, parent: null, keys: (g.channels || []).map(c => c.key) };
      });
      await chrome.storage.local.set({ channels, folders });
      await chrome.storage.local.remove('groups');
    }
    return {
      channels: channels || {},
      folders: folders || [],
      meta: meta || {},
      activeGroup: activeGroup ?? null,
      feedType: ['new', 'video', 'live', 'short', 'rec', 'later'].includes(feedType) ? feedType : 'video',
      cols: cols >= 3 && cols <= 7 ? cols : 4,
      // 未設定なら 動画3列・ショート5列。「自動」を選ぶと null が保存される
      homeCols: homeCols === null ? null : homeCols >= 3 && homeCols <= 7 ? homeCols : 3,
      homeShortCols: homeShortCols === null ? null : homeShortCols >= 3 && homeShortCols <= 7 ? homeShortCols : 5,
      hideWatched: !!hideWatched,
      recKind: recKind === 'short' ? 'short' : 'video',
      recMode: recMode === 'search' ? 'search' : 'rec', sFolder: sFolder || '', sText: sText || '',
      newOff: Array.isArray(newOff) ? newOff : [] // 新着動画で隠すカテゴリ（トップのフォルダID / '__unsorted'）
    };
  },

  // ---------- バックアップ（エクスポート / インポート） ----------
  SYNC_KEYS: ['channels', 'folders', 'meta', 'savedAt', 'cols', 'feedType', 'homeCols', 'homeShortCols', 'hideWatched'],

  // 保存の種類（Drive・ファイル共通）
  AUX: {
    history: ['history', 'daily', 'watched', 'ytHistSeen'], // 視聴記録・視聴済み（履歴の取り込み済み印も）
    later: ['later', 'laterRemoved'],                      // 後で見る（外した記録も）
    prefs: ['notifyFolders', 'cmt', 'assistOn', 'mgrThumbs', 'mgrThumbCount', 'statsPeriod', 'rydOn', 'ytHistOn', 'assistRules', 'recKind', 'statsTheme', 'wlSort', 'newOff', 'notifyRules', 'focus', 'prefsAt'] // その他の設定（prefsAt＝最後に変えた時刻）
  },

  // opts: { meta, history, later, prefs }（省略時はすべて含める）
  async exportData(opts = {}) {
    if (typeof opts === 'boolean') opts = { meta: opts };
    const inc = k => opts[k] !== false;
    const auxKeys = Object.entries(TG.AUX).filter(([k]) => inc(k)).flatMap(([, v]) => v);
    const d = await chrome.storage.local.get([...TG.SYNC_KEYS, ...auxKeys]);
    const out = {
      app: 'TubeGroups', format: 3, exportedAt: Date.now(), savedAt: d.savedAt || Date.now(),
      channels: d.channels || {}, folders: d.folders || [],
      settings: { cols: d.cols, feedType: d.feedType, homeCols: d.homeCols, homeShortCols: d.homeShortCols, hideWatched: d.hideWatched },
      aux: {}
    };
    if (inc('meta')) out.meta = d.meta || {};
    for (const [k, keys] of Object.entries(TG.AUX)) {
      if (!inc(k)) continue;
      out.aux[k] = Object.fromEntries(keys.map(x => [x, d[x]]).filter(([, v]) => v !== undefined));
    }
    return out;
  },

  // 視聴記録・視聴済み・後で見るは置き換えずに合体（このPCの分が消えない）。設定は上書き
  async mergeAux(aux) {
    if (!aux) return;
    const keys = Object.values(TG.AUX).flat();
    const L = await chrome.storage.local.get(keys);
    const set = {};
    const h = aux.history;
    if (h) {
      if (h.history) {
        const out = { ...(L.history || {}) };
        for (const [id, r] of Object.entries(h.history)) {
          const l = out[id];
          if (!l) { out[id] = r; continue; }
          const newer = (r.last || 0) > (l.last || 0) ? r : l;
          out[id] = { ...l, ...newer, sec: Math.max(l.sec || 0, r.sec || 0), first: Math.min(l.first || Infinity, r.first || Infinity), last: Math.max(l.last || 0, r.last || 0) };
        }
        set.history = out;
      }
      if (h.daily) {
        const out = { ...(L.daily || {}) };
        for (const [d, sec] of Object.entries(h.daily)) out[d] = Math.max(out[d] || 0, sec);
        set.daily = out;
      }
      if (h.ytHistSeen) set.ytHistSeen = { ...(L.ytHistSeen || {}), ...h.ytHistSeen };
      if (h.watched) {
        const out = { ...(L.watched || {}) };
        for (const [id, w] of Object.entries(h.watched)) {
          const l = out[id];
          if (!l || (w.p || 0) > (l.p || 0)) out[id] = { p: Math.max(w.p || 0, l?.p || 0), at: Math.max(w.at || 0, l?.at || 0) };
        }
        set.watched = out;
      }
    }
    const lt = aux.later;
    if (lt) {
      const removed = { ...(L.laterRemoved || {}) };
      for (const [v, at] of Object.entries(lt.laterRemoved || {})) removed[v] = Math.max(removed[v] || 0, at);
      const map = new Map();
      for (const x of [...(L.later || []), ...(lt.later || [])]) {
        const cur = map.get(x.v);
        if (!cur || (x.at || 0) < (cur.at || 0)) map.set(x.v, x);
      }
      set.later = [...map.values()].filter(x => !(removed[x.v] > (x.at || 0))).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 1000);
      // 外した記録は90日で消す
      const cut = Date.now() - 90 * 864e5;
      set.laterRemoved = Object.fromEntries(Object.entries(removed).filter(([, at]) => at > cut));
    }
    // 設定は、Drive側の方が新しく変更されているときだけ反映（このPCで変えたばかりの設定を古い値で戻さない）
    let prefsApplied = false;
    if (aux.prefs && (aux.prefs.prefsAt || 0) >= (L.prefsAt || 0)) {
      Object.assign(set, aux.prefs);
      set.prefsAt = aux.prefs.prefsAt || L.prefsAt || 0;
      prefsApplied = true;
    }
    if (Object.keys(set).length) await chrome.storage.local.set(set);
    const n = o => Object.keys(o || {}).length;
    const sum = [];
    if (set.history) sum.push(`視聴記録 ${n(L.history)}→${n(set.history)}本`);
    if (set.later) sum.push(`後で見る ${(L.later || []).length}→${set.later.length}本（Drive側 ${(lt.later || []).length}本）`);
    if (prefsApplied) sum.push('設定を反映');
    else if (aux.prefs) sum.push('設定はこのPCの方が新しいので維持');
    TG.log('同期', '合体：' + (sum.join('、') || '対象なし'));
    return sum;
  },

  // 読み込み→変更→保存を1つずつ順番に行う（続けて操作しても前の変更が消えない）
  _chain: Promise.resolve(),
  update(fn) {
    const run = TG._chain.then(async () => {
      const d = await TG.load();
      if ((await fn(d)) === false) return d;
      TG.dedupe(d);
      await TG.saveData({ folders: d.folders, channels: d.channels });
      return d;
    });
    TG._chain = run.catch(() => {});
    return run;
  },

  // 同じチャンネルID の重複（@ハンドル と channel/UC… など）を1つにまとめる。変更があれば true
  dedupe(d) {
    const byId = new Map();
    for (const c of Object.values(d.channels)) {
      if (!c.id) continue;
      if (!byId.has(c.id)) byId.set(c.id, []);
      byId.get(c.id).push(c);
    }
    let changed = false;
    for (const group of byId.values()) {
      if (group.length < 2) continue;
      // 残す方：登録チャンネルから読み込んだもの（アイコンあり）を優先
      group.sort((a, b) => (!!b.thumb - !!a.thumb) || (!!a.unsub - !!b.unsub));
      const keep = group[0];
      for (const c of group.slice(1)) {
        keep.hidden = keep.hidden || c.hidden;
        if (!keep.thumb && c.thumb) keep.thumb = c.thumb;
        for (const f of d.folders) {
          if (!f.keys.includes(c.key)) continue;
          f.keys = f.keys.filter(k => k !== c.key);
          if (!f.keys.includes(keep.key)) f.keys.push(keep.key);
        }
        delete d.channels[c.key];
        changed = true;
      }
    }
    return changed;
  },

  // フォルダ・チャンネルの保存は必ずここを通す（保存時刻を更新 → Driveにも自動で保存される）
  async saveData(patch) {
    const savedAt = Date.now();
    await chrome.storage.local.set({ ...patch, savedAt });
    return savedAt;
  },

  // 置き換え前の控え（最大10件）。reason は表示用の説明
  async backup(reason) {
    const { channels = {}, folders = [], savedAt = 0, backups = [] } = await chrome.storage.local.get(['channels', 'folders', 'savedAt', 'backups']);
    if (!folders.length && !Object.keys(channels).length) return;
    backups.unshift({ at: Date.now(), reason, savedAt, folders: folders.length, channelCount: Object.keys(channels).length, data: { channels, folders } });
    await chrome.storage.local.set({ backups: backups.slice(0, 10) });
    TG.log('データ', `自動バックアップ：${reason}（フォルダ ${folders.length}）`);
  },

  async restoreBackup(i) {
    const { backups = [] } = await chrome.storage.local.get('backups');
    const b = backups[i];
    if (!b) throw new Error('バックアップが見つかりません');
    await TG.backup('復元する前の状態');
    await TG.saveData({ channels: b.data.channels, folders: b.data.folders });
    return b;
  },

  async importData(data) {
    if (!data || data.app !== 'TubeGroups' || typeof data.channels !== 'object' || !Array.isArray(data.folders)) {
      throw new Error('TubeGroupsのバックアップファイルではありません');
    }
    await TG.backup(data._reason || '読み込む前の状態');
    TG.log('データ', `読み込み：フォルダ ${data.folders.length}・チャンネル ${Object.keys(data.channels).length}（${data._reason || 'ファイル'}）`);
    const set = { channels: data.channels, folders: data.folders.map(f => ({ parent: null, collapsed: false, keys: [], ...f })), savedAt: data.savedAt || Date.now() };
    if (data.meta) set.meta = data.meta;
    for (const [k, v] of Object.entries(data.settings || {})) if (v !== undefined && v !== null) set[k] = v;
    await chrome.storage.local.set(set);
    await TG.mergeAux(data.aux);
    return { channels: Object.keys(set.channels).length, folders: set.folders.length };
  },

  // チャンネルキー（@handle / channel/ID）→ 直接入っているフォルダ
  folderMap(channels, folders) {
    const m = new Map();
    for (const f of folders) {
      for (const k of f.keys) {
        const add = key => { if (!m.has(key)) m.set(key, []); m.get(key).push(f); };
        add(k);
        const id = channels[k]?.id;
        if (id) add('channel/' + id);
      }
    }
    return m;
  },

  setActive(id) {
    return chrome.storage.local.set({ activeGroup: id });
  },

  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  newFolder(name, index = 0, parent = null) {
    return { id: TG.uid(), name, color: TG.COLORS[index % TG.COLORS.length], parent, collapsed: false, keys: [] };
  },

  // ---------- フォルダの木構造 ----------
  // 表示順の配列 [{ f, depth, hidden }]（hidden = 親が折りたたまれている）
  tree(folders) {
    const ids = new Set(folders.map(f => f.id));
    const out = [];
    const seen = new Set();
    const rec = (pid, depth, hidden) => {
      for (const f of folders) {
        const p = f.parent && ids.has(f.parent) ? f.parent : null;
        if (p !== pid || seen.has(f.id)) continue;
        seen.add(f.id);
        out.push({ f, depth, hidden });
        rec(f.id, depth + 1, hidden || !!f.collapsed);
      }
    };
    rec(null, 0, false);
    folders.forEach(f => { if (!seen.has(f.id)) out.push({ f, depth: 0, hidden: false }); }); // 壊れたデータ対策
    return out;
  },

  hasChildren(folders, id) {
    return folders.some(f => f.parent === id);
  },

  // 自分と子孫のフォルダID
  subtreeIds(folders, id) {
    const s = new Set([id]);
    let added = true;
    while (added) {
      added = false;
      for (const f of folders) {
        if (f.parent && s.has(f.parent) && !s.has(f.id)) { s.add(f.id); added = true; }
      }
    }
    return s;
  },

  // 子孫フォルダも含めたチャンネルキー
  folderKeys(folders, id) {
    const ids = TG.subtreeIds(folders, id);
    const k = new Set();
    folders.forEach(f => { if (ids.has(f.id)) f.keys.forEach(x => k.add(x)); });
    return k;
  },

  rootOf(folders, id) {
    let f = folders.find(x => x.id === id);
    let guard = 0;
    while (f?.parent && guard++ < 50) {
      const p = folders.find(x => x.id === f.parent);
      if (!p) break;
      f = p;
    }
    return f || null;
  },

  pathName(folders, f) {
    const parts = [f.name];
    let p = folders.find(x => x.id === f.parent);
    let guard = 0;
    while (p && guard++ < 50) {
      parts.unshift(p.name);
      p = folders.find(x => x.id === p.parent);
    }
    return parts.join(' / ');
  },

  // フォルダ移動。mode: 'before' | 'after' | 'inside' | 'root'
  moveFolder(folders, id, targetId, mode) {
    const f = folders.find(x => x.id === id);
    if (!f) return folders;
    if (mode !== 'root' && TG.subtreeIds(folders, id).has(targetId)) return folders; // 自分の中には入れない
    const rest = folders.filter(x => x !== f);
    if (mode === 'root') {
      f.parent = null;
      rest.push(f);
      return rest;
    }
    const t = rest.find(x => x.id === targetId);
    if (!t) return folders;
    if (mode === 'inside') {
      f.parent = t.id;
      t.collapsed = false;
      rest.push(f);
      return rest;
    }
    f.parent = t.parent ?? null;
    const i = rest.indexOf(t);
    rest.splice(mode === 'before' ? i : i + 1, 0, f);
    return rest;
  },

  // ---------- チャンネルキー ----------
  channelKey(href) {
    if (!href) return null;
    try {
      const u = new URL(href, 'https://www.youtube.com');
      if (!/(^|\.)youtube\.com$/.test(u.hostname)) return null;
      const m = u.pathname.match(/^\/(@[^/?#]+|channel\/[^/?#]+|c\/[^/?#]+|user\/[^/?#]+)/);
      if (!m) return null;
      const k = decodeURIComponent(m[1]);
      return k.startsWith('channel/') ? k : k.toLowerCase();
    } catch {
      return null;
    }
  },

  channelUrl(key) {
    return 'https://www.youtube.com/' + key;
  },

  // ページ上のリンクと照合するためのキー集合（@handle と channel/ID の両方）
  matchSet(channels, keys) {
    const s = new Set();
    for (const k of keys) {
      s.add(k);
      const id = channels[k]?.id;
      if (id) s.add('channel/' + id);
    }
    return s;
  },

  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  rel(t) {
    const m = (Date.now() - t) / 6e4;
    if (m < 60) return `${Math.max(1, Math.round(m))} 分前`;
    const h = m / 60;
    if (h < 24) return `${Math.round(h)} 時間前`;
    const d = h / 24;
    if (d < 30) return `${Math.round(d)} 日前`;
    if (d < 365) return `${Math.round(d / 30)} か月前`;
    return `${Math.floor(d / 365)} 年前`;
  },

  // 「12万」「3.4K」「1,234」などを数値に
  parseCount(t) {
    if (!t) return 0;
    const s = String(t).replace(/[,\s]/g, '');
    let m = s.match(/([\d.]+)(万|億|千)?/);
    if (m && /[万億千]/.test(s)) return Math.round(+m[1] * ({ '万': 1e4, '億': 1e8, '千': 1e3 }[m[2]] || 1));
    m = s.match(/([\d.]+)([KMB])?/i);
    return m ? Math.round(+m[1] * ({ k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1)) : 0;
  },

  dayKey(t = Date.now()) {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  views(n) {
    if (!n) return '';
    const f = (v, u) => (v < 10 ? v.toFixed(1).replace(/\.0$/, '') : Math.floor(v)) + u;
    if (n >= 1e8) return f(n / 1e8, '億') + ' 回視聴';
    if (n >= 1e4) return f(n / 1e4, '万') + ' 回視聴';
    return n.toLocaleString() + ' 回視聴';
  }
};

// Google Drive 同期（バックグラウンド）
// 認証: chrome.identity.launchWebAuthFlow（組み込みのOAuthクライアントID。設定で別のIDにも変えられる）
// 保存先: マイドライブ直下の TubeFolio-sync.json（drive.file 権限＝この拡張が作ったファイルだけ触れる）
importScripts('shared.js');

const FILE = 'TubeFolio-sync.json';
const OLD_FILE = TG.LEGACY_APP + '-sync.json'; // 名前を変える前のファイル（見つけたら TubeFolio-sync.json に名前を変える）
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

// 拡張機能に組み込むクライアントID（manifest の key で拡張機能のIDが固定なので、どのPCでも同じIDが使える）
//   ここに入っていれば、新しいPCでもクライアントIDの入力は不要（「Google Drive に接続」を押すだけ）
const BUILTIN_CLIENT_ID = '553603750505-7g02mobn8i1f8sjh3l713bvdvbktrtn5.apps.googleusercontent.com';

async function getSync() {
  const { sync = {} } = await chrome.storage.local.get('sync');
  if (!sync.clientId && BUILTIN_CLIENT_ID) return { ...sync, clientId: BUILTIN_CLIENT_ID, builtin: true };
  return { ...sync, builtin: !!BUILTIN_CLIENT_ID && sync.clientId === BUILTIN_CLIENT_ID };
}
async function setSync(patch) {
  const s = { ...(await getSync()), ...patch };
  await chrome.storage.local.set({ sync: s });
  return s;
}

// ---------- 認証 ----------
async function token(interactive) {
  const s = await getSync();
  if (!s.clientId) throw new Error('クライアントIDが設定されていません');
  const { tok } = await chrome.storage.session.get('tok');
  if (tok && tok.exp > Date.now() + 60e3) return tok.value;
  if (!interactive && s.needReauth && Date.now() - (s.needReauthAt || 0) < 30 * 60e3) throw new Error('再接続が必要です（⚙ →「同期・バックアップ」→「Google Drive に再接続」）');
  // 裏で取り直すとき（1時間ごと・拡張機能の再読み込み後）は、接続したアカウントを指定する
  //   （Googleアカウントが複数あると、指定しないと interaction_required になる）
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: s.clientId,
    response_type: 'token',
    redirect_uri: chrome.identity.getRedirectURL(),
    scope: SCOPE,
    ...(s.email ? { login_hint: s.email } : {}),
    ...(interactive ? (s.email ? {} : { prompt: 'select_account' }) : { prompt: 'none' })
  });
  let res;
  try {
    res = await chrome.identity.launchWebAuthFlow({ url, interactive, ...(interactive ? {} : { abortOnLoadForNonInteractive: false, timeoutMsForNonInteractive: 15000 }) });
  } catch (e) {
    if (!interactive) await setSync({ needReauth: true, needReauthAt: Date.now() });
    throw new Error(interactive ? '認証がキャンセルされたか失敗しました' : '再接続が必要です（⚙ →「同期・バックアップ」→「Google Drive に再接続」）');
  }
  const h = new URLSearchParams(new URL(res).hash.slice(1));
  const value = h.get('access_token');
  if (!value) {
    if (!interactive) await setSync({ needReauth: true, needReauthAt: Date.now() });
    throw new Error('認証に失敗しました：' + (h.get('error') || '不明なエラー') + (interactive ? '' : '（⚙ →「同期・バックアップ」で再接続してください）'));
  }
  await chrome.storage.session.set({ tok: { value, exp: Date.now() + (+h.get('expires_in') || 3600) * 1000 } });
  if (s.needReauth) await setSync({ needReauth: false });
  return value;
}

async function api(path, opt = {}, interactive = false) {
  for (let i = 0; i < 2; i++) {
    const t = await token(interactive);
    const r = await fetch('https://www.googleapis.com' + path, { ...opt, headers: { ...(opt.headers || {}), Authorization: 'Bearer ' + t } });
    if (r.status === 401 && i === 0) { await chrome.storage.session.remove('tok'); continue; }
    if (!r.ok) throw new Error(`Google Drive エラー (${r.status})`);
    return r;
  }
}

async function findFile(interactive) {
  const q = encodeURIComponent(`(name='${FILE}' or name='${OLD_FILE}') and trashed=false`);
  const r = await api(`/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc&spaces=drive`, {}, interactive);
  const f = (await r.json()).files?.[0] || null;
  if (f && f.name !== FILE) {
    try {
      await api(`/drive/v3/files/${f.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: FILE }) }, interactive);
      TG.log('同期', `Driveのファイル名を ${FILE} に変更しました`);
      f.name = FILE;
    } catch (e) { TG.log('同期', 'Driveのファイル名を変えられませんでした：' + e.message, 'warn'); }
  }
  return f;
}

async function upload(data, interactive) {
  const body = JSON.stringify(data);
  const f = await findFile(interactive);
  if (f) {
    await api(`/upload/drive/v3/files/${f.id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body }, interactive);
  } else {
    const b = 'tgb' + Date.now();
    const mp = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: FILE, mimeType: 'application/json' })}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`;
    await api('/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${b}` }, body: mp }, interactive);
  }
  return body.length;
}

async function download(interactive) {
  const f = await findFile(interactive);
  if (!f) return null;
  const r = await api(`/drive/v3/files/${f.id}?alt=media`, {}, interactive);
  return r.json();
}

// ---------- 操作 ----------
// 保存する種類（設定のチェック。初期値はすべてオン）
const syncOpts = s => ({ meta: s.includeMeta !== false, history: s.incHistory !== false, later: s.incLater !== false, prefs: s.incPrefs !== false });

const kbs = n => n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
function describe(data) {
  const a = data.aux || {};
  const parts = [`フォルダ ${(data.folders || []).length}`, `チャンネル ${Object.keys(data.channels || {}).length}`];
  if (a.history) parts.push(`視聴記録 ${Object.keys(a.history.history || {}).length}本`);
  if (a.later) parts.push(`後で見る ${(a.later.later || []).length}本`);
  if (!a.later) parts.push('後で見る：対象外');
  return parts.join('・');
}
async function push(interactive, why = '') {
  const s = await getSync();
  const data = await TG.exportData(syncOpts(s));
  const bytes = await upload(data, interactive);
  TG.log('同期', `Driveへ保存${why ? `（${why}）` : ''}：${describe(data)}／${kbs(bytes)}`);
  auxDirty = false;
  await chrome.storage.session.set({ auxDirty: false });
  await setSync({ syncedSavedAt: data.savedAt, lastSyncAt: Date.now(), lastBytes: bytes, lastError: '', lastRemoteSeen: data.exportedAt });
  return { bytes };
}

async function pull(interactive) {
  const data = await download(interactive);
  if (!data) throw new Error('Google Drive にまだ保存されていません');
  TG.log('同期', `Driveから読み込み（手動）：${describe(data)}`);
  data._reason = 'Driveから読み込む前の状態';
  data.aux = pickAux(data.aux, await getSync());
  const r = await TG.importData(data);
  await setSync({ syncedSavedAt: data.savedAt, lastSyncAt: Date.now(), lastError: '' });
  return r;
}

// 新しい方に合わせる（自動同期用）
let lastAutoPull = 0;
async function autoPull() {
  const s = await getSync();
  if (!s.auto || !s.connected || Date.now() - lastAutoPull < 5 * 60e3) return { skipped: true };
  lastAutoPull = Date.now();
  const remote = await download(false);
  if (!remote) TG.log('同期', '自動同期：Driveにファイルがありません', 'warn');
  const { savedAt = 0 } = await chrome.storage.local.get('savedAt');
  const localUnsynced = savedAt && savedAt !== s.syncedSavedAt; // このPCにDriveへ未保存の変更がある
  if (remote && (remote.savedAt || 0) > savedAt && !localUnsynced) {
    TG.log('同期', `自動同期：Driveの方が新しいので読み込み（${describe(remote)}）`);
    remote._reason = '自動同期で読み込む前の状態';
    remote.aux = pickAux(remote.aux, s);
    await TG.importData(remote);
    await setSync({ syncedSavedAt: remote.savedAt, lastSyncAt: Date.now(), lastError: '', lastRemoteSeen: remote.exportedAt });
    return { pulled: true };
  }
  // フォルダは同じでも、別のPCで増えた視聴記録・後で見るなどは合体させる
  if (remote?.aux && remote.exportedAt && remote.exportedAt !== s.lastRemoteSeen) {
    TG.log('同期', `自動同期：別のPCの変更を合体（${describe(remote)}）`);
    await TG.mergeAux(pickAux(remote.aux, s));
    await setSync({ lastRemoteSeen: remote.exportedAt });
    auxDirty = true;
  }
  if ((savedAt && savedAt !== s.syncedSavedAt) || auxDirty) { await push(false, '自動同期'); return { pushed: true }; }
  return { same: true };
}

// 読み込む種類も設定に合わせる
function pickAux(aux, s) {
  if (!aux) return aux;
  const o = syncOpts(s);
  return Object.fromEntries(Object.entries(aux).filter(([k]) => o[k] !== false));
}

// ---------- 視聴記録・後で見る・設定の自動保存 ----------
//   後で見る・設定：変更から10秒後 ／ 視聴記録・視聴済み：30分ごと＋YouTubeのタブを閉じたとき
let auxDirty = false, auxT = null;
chrome.storage.session.get('auxDirty').then(r => { auxDirty = auxDirty || !!r.auxDirty; });
const HIST_KEYS = new Set(TG.AUX.history);
const SOON_KEYS = new Set([...TG.AUX.later, ...TG.AUX.prefs]);
async function pushIfDirty(why = '') {
  const s = await getSync();
  if (!s.auto || !s.connected || !auxDirty) return;
  try { await push(false, why); } catch (e) { TG.log('同期', 'Driveへの保存に失敗：' + e.message, 'error'); await setSync({ lastError: e.message, lastErrorAt: Date.now() }); }
}
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== 'local') return;
  const keys = Object.keys(ch);
  // 設定を変えた時刻（同期の読み込みで変わった場合は除く）
  const PREF_KEYS = TG.AUX.prefs.filter(k => k !== 'prefsAt');
  if (!ch.prefsAt && keys.some(k => PREF_KEYS.includes(k))) chrome.storage.local.set({ prefsAt: Date.now() });
  if (keys.some(k => HIST_KEYS.has(k) || SOON_KEYS.has(k))) {
    if (!auxDirty) { auxDirty = true; chrome.storage.session.set({ auxDirty: true }); }
  }
  if (keys.some(k => SOON_KEYS.has(k))) {
    clearTimeout(auxT);
    auxT = setTimeout(() => pushIfDirty('後で見る・設定の変更'), 10000);
  }
});
chrome.alarms.get('tg-sync').then(a => { if (!a) chrome.alarms.create('tg-sync', { periodInMinutes: 30, delayInMinutes: 30 }); });
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'tg-sync') pushIfDirty('30分ごと'); });

// YouTubeのタブを閉じたら保存（どのタブがYouTubeかは、ページ側から知らせてもらう）
const ytTabs = new Set();
chrome.storage.session.get('ytTabs').then(r => (r.ytTabs || []).forEach(id => ytTabs.add(id)));
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== 'tg-hello' || !sender.tab) return;
  ytTabs.add(sender.tab.id);
  chrome.storage.session.set({ ytTabs: [...ytTabs] });
});
chrome.tabs.onRemoved.addListener(id => {
  if (!ytTabs.delete(id)) return;
  chrome.storage.session.set({ ytTabs: [...ytTabs] });
  setTimeout(() => pushIfDirty('YouTubeのタブを閉じた'), 2000); // ページ側の最後の保存を待つ
});

// フォルダ設定が保存されたら少し待ってから自動アップロード
let upT = null;
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== 'local' || !ch.savedAt) return;
  clearTimeout(upT);
  upT = setTimeout(async () => {
    const s = await getSync();
    if (!s.auto || !s.connected) return;
    const { savedAt } = await chrome.storage.local.get('savedAt');
    if (savedAt === s.syncedSavedAt) return; // Driveから読み込んだ直後など
    try { await push(false, 'フォルダ設定の変更'); }
    catch (e) {
      TG.log('同期', 'Driveへの保存に失敗（1分後に再試行）：' + e.message, 'error');
      await setSync({ lastError: e.message, lastErrorAt: Date.now() });
      setTimeout(() => push(false, '再試行').catch(e2 => TG.log('同期', '再試行も失敗：' + e2.message, 'error')), 60e3); // 1分後にもう一度
    }
  }, 5000);
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type !== 'drive') return;
  (async () => {
    switch (msg.op) {
      case 'status': return { ...(await getSync()), redirect: chrome.identity.getRedirectURL() };
      case 'setClient': return setSync({ clientId: (msg.clientId || '').trim() });
      case 'setOpt': return setSync(msg.patch || {});
      case 'connect': {
        TG.log('同期', 'Google Drive に接続');
        await chrome.storage.session.remove('tok');
        const t = await token(true);
        // 次から裏で取り直すときに使うアカウント（Driveの情報から）
        let email = '';
        try { email = (await (await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', { headers: { Authorization: 'Bearer ' + t } })).json())?.user?.emailAddress || ''; } catch { /* 取れなくても続ける */ }
        await setSync({ connected: true, lastError: '', needReauth: false, ...(email ? { email } : {}) });
        TG.log('同期', 'Google Drive に接続しました' + (email ? `（${email.replace(/(.{2}).*(@.*)/, '$1…$2')}）` : ''));
        const remote = await findFile(false);
        return { connected: true, hasRemote: !!remote };
      }
      case 'disconnect': {
        const { tok } = await chrome.storage.session.get('tok');
        if (tok?.value) fetch('https://oauth2.googleapis.com/revoke?token=' + tok.value, { method: 'POST' }).catch(() => {});
        await chrome.storage.session.remove('tok');
        return setSync({ connected: false, auto: false });
      }
      case 'push': return push(true, '手動');
      case 'pull': return pull(true);
      case 'peek': {
        const d = await download(true);
        return d ? { savedAt: d.savedAt || 0, folders: (d.folders || []).length, channels: Object.keys(d.channels || {}).length } : { none: true };
      }
      case 'autoPull': return autoPull();
    }
  })().then(r => reply({ ok: true, ...r }), e => {
    TG.log('同期', `${msg.op} に失敗：${e.message}`, 'error');
    setSync({ lastError: e.message });
    reply({ ok: false, error: e.message });
  });
  return true;
});

// ---------- 新着の定期確認と通知 ----------
// 決めた間隔（初期15分）ごとに、開いているYouTubeのタブに新着の確認を依頼する（YouTubeのログイン情報を使うため）
async function setupCheckAlarm() {
  const iv = Math.max(5, (await TG.notifyRules()).interval || 15);
  const a = await chrome.alarms.get('tg-check');
  if (!a || a.periodInMinutes !== iv) chrome.alarms.create('tg-check', { periodInMinutes: iv, delayInMinutes: 1 });
  const q = await chrome.alarms.get('tg-queue');
  if (!q) chrome.alarms.create('tg-queue', { periodInMinutes: 5, delayInMinutes: 1 });
}
chrome.runtime.onInstalled.addListener(setupCheckAlarm);
chrome.runtime.onStartup.addListener(setupCheckAlarm);
setupCheckAlarm();
chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.notifyRules) setupCheckAlarm(); });

async function askTab(msg) {
  const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
  if (!tabs.length) return { ok: false, error: 'YouTubeのタブが開いていません（YouTubeを開いてからもう一度押してください）' };
  tabs.sort((a, b) => (b.active - a.active) || (b.lastAccessed || 0) - (a.lastAccessed || 0));
  for (const t of tabs) {
    try { return await chrome.tabs.sendMessage(t.id, msg); } catch { /* 拡張機能の更新前に開いたタブ等 */ }
  }
  return { ok: false, error: 'YouTubeのタブを再読み込みしてください' };
}
const askTabToCheck = force => askTab({ type: 'tg-check', force });

chrome.alarms.onAlarm.addListener(a => {
  if (a.name === 'tg-check') {
    flushQueue();
    askTabToCheck(false).then(r => { if (r && r.ok === false) TG.log('新着', '定期確認：' + r.error, 'warn'); });
  }
  if (a.name === 'tg-queue') flushQueue();
});

// 時間帯待ちの通知を、時間になったら出す
async function flushQueue() {
  const { notifyQueue = [] } = await chrome.storage.local.get('notifyQueue');
  if (!notifyQueue.length) return;
  const now = Date.now();
  const due = notifyQueue.filter(x => x.due <= now);
  if (!due.length) return;
  await chrome.storage.local.set({ notifyQueue: notifyQueue.filter(x => x.due > now) });
  // 古すぎるもの（2日以上待った）は出さない
  deliver(due.filter(x => now - x.due < 2 * 864e5), '時間帯');
}

const notifUrl = new Map();
const LV = { high: 3, normal: 2, low: 1 };
const KIND = { live: '🔴 配信中', upcoming: '⏰ 配信予定', kw: '⚡', new: '' };
const label = it => `${KIND[it.kind] ? KIND[it.kind] + ' ' : ''}【${it.folder}】${it.ch}`;
const watchUrl = v => 'https://www.youtube.com/watch?v=' + v;

async function deliver(items, why = '') {
  if (!items.length) return;
  const rules = await TG.notifyRules();
  TG.log('通知', `${why ? why + '：' : ''}${items.length}本 ` + items.slice(0, 5).map(x => `${label(x)}（${x.level === 'high' ? '高' : x.level === 'low' ? '低' : '中'}）`).join('、'));
  let toPage = rules.show !== 'pc', toPc = rules.show !== 'page';
  if (toPage) {
    const r = await askTab({ type: 'tg-toast', items });
    if (!r?.ok) { toPage = false; toPc = true; } // YouTubeのタブが無ければPCの通知で
  }
  if (!toPc) return;
  const icon = chrome.runtime.getURL('icons/icon128.png');
  // 重要度の高いものは個別に（閉じるまで残す）、ほかは4本以上ならまとめて1つに
  const high = items.filter(x => x.level === 'high');
  const rest = items.filter(x => x.level !== 'high');
  const single = it => {
    const id = 'tg-' + it.v + '-' + Date.now() + Math.random().toString(36).slice(2, 5);
    notifUrl.set(id, watchUrl(it.v));
    const when = it.kind === 'upcoming' && it.at ? `（${new Date(it.at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}〜）` : '';
    chrome.notifications.create(id, {
      type: 'basic', iconUrl: icon, title: label(it), message: it.title + when,
      priority: it.level === 'high' ? 2 : it.level === 'low' ? 0 : 1,
      requireInteraction: it.level === 'high', silent: it.level === 'low'
    });
  };
  high.forEach(single);
  if (rest.length <= 3) rest.forEach(single);
  else {
    const id = 'tg-many-' + Date.now();
    notifUrl.set(id, 'https://www.youtube.com/feed/subscriptions');
    const folders = [...new Set(rest.map(x => x.folder))].join('・');
    chrome.notifications.create(id, {
      type: 'list', iconUrl: icon, title: `新着 ${rest.length} 本（${folders}）`, message: '',
      items: rest.slice(0, 5).map(x => ({ title: x.ch, message: x.title })), priority: 1,
      silent: rest.every(x => x.level === 'low')
    });
  }
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type === 'tg-check-now') { askTabToCheck(true).then(reply); return true; }
  if (msg?.type === 'tg-hist-now') { askTab({ type: 'tg-hist' }).then(reply); return true; }
  if (msg?.type === 'tg-notify-test') {
    deliver([{ v: 'dQw4w9WgXcQ', title: 'テスト通知です（クリックで動画を開きます）', ch: 'TubeFolio', folder: 'テスト', level: msg.level || 'normal', kind: msg.kind || 'new' }], 'テスト').then(() => reply({ ok: true }));
    return true;
  }
  if (msg?.type !== 'tg-notify') return;
  deliver(msg.items || []);
});

chrome.notifications.onClicked.addListener(id => {
  const url = notifUrl.get(id);
  if (url) chrome.tabs.create({ url });
  chrome.notifications.clear(id);
});

// 視聴記録の画面を開く（すでに開いていればそのタブへ）
// （chrome.tabs.query の url 指定は tabs 権限が無いと無視され、関係ないタブが選ばれてしまうので使わない）
async function openOwnPage(file) {
  const url = chrome.runtime.getURL(file);
  try {
    const ctx = await chrome.runtime.getContexts({ contextTypes: ['TAB'], documentUrls: [url] });
    const c = ctx.find(x => x.tabId >= 0);
    if (c) {
      const tab = await chrome.tabs.update(c.tabId, { active: true });
      if (tab?.windowId != null) chrome.windows.update(tab.windowId, { focused: true });
      return;
    }
  } catch (e) { /* 古いChrome（getContexts なし）は新しいタブで開く */ }
  await chrome.tabs.create({ url });
  TG.log('拡張', `${file === 'log.html' ? '動作ログ' : '視聴記録'}の画面を開いた`);
}
chrome.runtime.onMessage.addListener(msg => {
  if (msg?.type !== 'openStats') return;
  openOwnPage('stats.html').catch(e => TG.log('拡張', '視聴記録の画面を開けません：' + e.message, 'error'));
});

// ---------- 動作ログ ----------
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type === 'tg-log') { TG.writeLog((msg.items || []).slice(0, 200)); return; }
  if (msg?.type !== 'openPage') return;
  openOwnPage(msg.page === 'log' ? 'log.html' : 'stats.html').catch(e => TG.log('拡張', '画面を開けません：' + e.message, 'error'));
});
chrome.runtime.onInstalled.addListener(d => TG.log('拡張', d.reason === 'update' ? `更新しました（v${chrome.runtime.getManifest().version}）` : `インストール：${d.reason}`));
chrome.runtime.onStartup.addListener(() => TG.log('拡張', 'ブラウザ起動'));

// 字幕検索（v4.23）をやめたので、このPCに保存した字幕を消す
chrome.runtime.onInstalled.addListener(async () => {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter(k => k.startsWith('tr:') || k === 'trIdx' || k === 'trOpts');
  if (keys.length) await chrome.storage.local.remove(keys);
});

// ---------- 一時的に YouTube の視聴履歴に残さない（histOff） ----------
//   再生の記録を送る通信（/api/stats/watchtime・/api/stats/playback）を止める。TubeFolio の視聴記録も止める
const HIST_RULES = [9101, 9102];
async function applyHistOff() {
  const { histOff } = await chrome.storage.local.get('histOff');
  const on = !!histOff?.on && (!histOff.until || histOff.until > Date.now());
  if (histOff?.on && !on) { await chrome.storage.local.set({ histOff: { on: false } }); TG.log('履歴オフ', '時間になったので履歴を元に戻しました'); }
  const types = ['xmlhttprequest', 'ping', 'image', 'other'];
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: HIST_RULES,
    addRules: on ? [
      { id: HIST_RULES[0], priority: 1, action: { type: 'block' }, condition: { urlFilter: '||youtube.com/api/stats/watchtime', resourceTypes: types } },
      { id: HIST_RULES[1], priority: 1, action: { type: 'block' }, condition: { urlFilter: '||youtube.com/api/stats/playback', resourceTypes: types } }
    ] : []
  });
  chrome.alarms.clear('tg-histoff');
  if (on && histOff.until) chrome.alarms.create('tg-histoff', { when: histOff.until + 1000 });
}
chrome.storage.onChanged.addListener(ch => { if (ch.histOff) applyHistOff().catch(() => {}); });
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'tg-histoff') applyHistOff().catch(() => {}); });
chrome.runtime.onStartup.addListener(() => applyHistOff().catch(() => {}));
chrome.runtime.onInstalled.addListener(() => applyHistOff().catch(() => {}));

// ---------- Return YouTube Dislike（推定の高評価・低評価）と、翻訳（他言語で検索） ----------
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type === 'ryd') {
    fetch(`https://returnyoutubedislikeapi.com/votes?videoId=${encodeURIComponent(msg.v)}`)
      .then(r => (r.ok ? r.json() : null)).then(j => reply(j ? { likes: j.likes || 0, dislikes: j.dislikes || 0, views: j.viewCount || 0 } : null)).catch(() => reply(null));
    return true;
  }
  if (msg?.type === 'translate') {
    const u = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(msg.to)}&dt=t&q=${encodeURIComponent(msg.q)}`;
    fetch(u).then(r => (r.ok ? r.json() : null)).then(j => reply(j ? (j[0] || []).map(x => x[0]).join('') : null)).catch(() => reply(null));
    return true;
  }
});

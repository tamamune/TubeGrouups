// Google Drive 同期（バックグラウンド）
// 認証: chrome.identity.launchWebAuthFlow（利用者が作成したOAuthクライアントIDを使用）
// 保存先: マイドライブ直下の TubeGroups-sync.json（drive.file 権限＝この拡張が作ったファイルだけ触れる）
importScripts('shared.js');

const FILE = 'TubeGroups-sync.json';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

async function getSync() {
  const { sync = {} } = await chrome.storage.local.get('sync');
  return sync;
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
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: s.clientId,
    response_type: 'token',
    redirect_uri: chrome.identity.getRedirectURL(),
    scope: SCOPE,
    ...(interactive ? {} : { prompt: 'none' })
  });
  let res;
  try {
    res = await chrome.identity.launchWebAuthFlow({ url, interactive });
  } catch (e) {
    throw new Error(interactive ? '認証がキャンセルされたか失敗しました' : '再ログインが必要です（「Driveに接続」を押してください）');
  }
  const h = new URLSearchParams(new URL(res).hash.slice(1));
  const value = h.get('access_token');
  if (!value) throw new Error('認証に失敗しました：' + (h.get('error') || '不明なエラー'));
  await chrome.storage.session.set({ tok: { value, exp: Date.now() + (+h.get('expires_in') || 3600) * 1000 } });
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
  const q = encodeURIComponent(`name='${FILE}' and trashed=false`);
  const r = await api(`/drive/v3/files?q=${q}&fields=files(id,modifiedTime,size)&orderBy=modifiedTime desc&spaces=drive`, {}, interactive);
  return (await r.json()).files?.[0] || null;
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
        await token(true);
        await setSync({ connected: true, lastError: '' });
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
// 15分ごとに、開いているYouTubeのタブに新着の確認を依頼する（YouTubeのログイン情報を使うため）
chrome.runtime.onInstalled.addListener(() => chrome.alarms.create('tg-check', { periodInMinutes: 15, delayInMinutes: 1 }));
chrome.runtime.onStartup.addListener(() => chrome.alarms.create('tg-check', { periodInMinutes: 15, delayInMinutes: 1 }));

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
  if (a.name !== 'tg-check') return;
  askTabToCheck(false).then(r => { if (r && r.ok === false) TG.log('新着', '定期確認：' + r.error, 'warn'); });
});

const notifUrl = new Map();
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type === 'tg-check-now') { askTabToCheck(true).then(reply); return true; }
  if (msg?.type === 'tg-hist-now') { askTab({ type: 'tg-hist' }).then(reply); return true; }
  if (msg?.type !== 'tg-notify') return;
  const items = msg.items || [];
  TG.log('通知', `PC通知 ${items.length}本：` + items.slice(0, 5).map(x => `【${x.folder}】${x.ch}`).join('、'));
  const icon = chrome.runtime.getURL('icons/icon128.png');
  if (items.length <= 3) {
    for (const it of items) {
      const id = 'tg-' + it.v + '-' + Date.now();
      notifUrl.set(id, 'https://www.youtube.com/watch?v=' + it.v);
      chrome.notifications.create(id, { type: 'basic', iconUrl: icon, title: `【${it.folder}】${it.ch}`, message: it.title, priority: 1 });
    }
  } else {
    const id = 'tg-many-' + Date.now();
    notifUrl.set(id, 'https://www.youtube.com/feed/subscriptions');
    const folders = [...new Set(items.map(x => x.folder))].join('・');
    chrome.notifications.create(id, {
      type: 'list', iconUrl: icon, title: `新着 ${items.length} 本（${folders}）`, message: '',
      items: items.slice(0, 5).map(x => ({ title: x.ch, message: x.title })), priority: 1
    });
  }
});

chrome.notifications.onClicked.addListener(id => {
  const url = notifUrl.get(id);
  if (url) chrome.tabs.create({ url });
  chrome.notifications.clear(id);
});

// 視聴記録の画面を開く（すでに開いていればそのタブへ）
chrome.runtime.onMessage.addListener(msg => {
  if (msg?.type !== 'openStats') return;
  const url = chrome.runtime.getURL('stats.html');
  chrome.tabs.query({ url }).then(tabs => {
    if (tabs[0]) { chrome.tabs.update(tabs[0].id, { active: true }); chrome.windows.update(tabs[0].windowId, { focused: true }); }
    else chrome.tabs.create({ url });
  });
});

// ---------- 動作ログ ----------
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type === 'tg-log') { TG.writeLog((msg.items || []).slice(0, 200)); return; }
  if (msg?.type !== 'openPage') return;
  const url = chrome.runtime.getURL(msg.page === 'log' ? 'log.html' : 'stats.html');
  chrome.tabs.query({ url }).then(tabs => {
    if (tabs[0]) { chrome.tabs.update(tabs[0].id, { active: true }); chrome.windows.update(tabs[0].windowId, { focused: true }); }
    else chrome.tabs.create({ url });
  });
});
chrome.runtime.onInstalled.addListener(d => TG.log('拡張', d.reason === 'update' ? `更新しました（v${chrome.runtime.getManifest().version}）` : `インストール：${d.reason}`));
chrome.runtime.onStartup.addListener(() => TG.log('拡張', 'ブラウザ起動'));

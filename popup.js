const SUBS = 'https://www.youtube.com/feed/subscriptions';

async function goYouTube(forceSubs) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const onYT = tab?.url?.startsWith('https://www.youtube.com/');
  if (onYT && (!forceSubs || tab.url.startsWith(SUBS))) {
    // そのまま（ページ側がstorageの変化を見て反映）
  } else if (onYT) {
    await chrome.tabs.update(tab.id, { url: SUBS });
  } else {
    await chrome.tabs.create({ url: SUBS });
  }
  window.close();
}

function row(label, count, color, id, active) {
  const li = document.createElement('li');
  li.className = active ? 'active' : '';
  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.style.background = color;
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = label;
  const c = document.createElement('span');
  c.className = 'count';
  c.textContent = count;
  li.append(dot, name, c);
  li.addEventListener('click', async () => {
    await TG.setActive(id);
    goYouTube(true);
  });
  return li;
}

(async () => {
  const { folders, activeGroup } = await TG.load();
  const list = document.getElementById('list');
  list.appendChild(row('すべて', '', '#888', null, !activeGroup));
  TG.tree(folders).forEach(({ f }) => list.appendChild(row("　".repeat(TG.tree(folders).find(x => x.f === f)?.depth || 0) + f.name, TG.folderKeys(folders, f.id).size, f.color, f.id, activeGroup === f.id)));
  document.getElementById('empty').hidden = folders.length > 0;
  document.getElementById('stats').addEventListener('click', () => { chrome.tabs.create({ url: chrome.runtime.getURL('stats.html') }); window.close(); });
  document.getElementById('log').addEventListener('click', () => { chrome.runtime.sendMessage({ type: 'openPage', page: 'log' }); window.close(); });
  document.getElementById('manage').addEventListener('click', async () => {
    await chrome.storage.local.set({ openManager: true });
    goYouTube(false);
  });
})();

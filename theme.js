// 視聴記録・動作ログ画面の表示テーマ（YouTubeに合わせる／ライト／ダーク）
//   statsTheme: 'yt' | 'light' | 'dark'（初期値 yt）、ytDark: YouTubeがダークテーマか（YouTubeのページが保存）
(() => {
  const root = document.documentElement;
  const apply = (mode, ytDark) => {
    const dark = mode === 'dark' || (mode !== 'light' && (ytDark ?? matchMedia('(prefers-color-scheme: dark)').matches));
    root.dataset.theme = dark ? 'dark' : 'light';
    try { localStorage.setItem('tgTheme', root.dataset.theme); } catch { /* 保存できなくても表示はできる */ }
  };
  // ちらつき防止：前回の結果を先に当てる
  try { const t = localStorage.getItem('tgTheme'); if (t) root.dataset.theme = t; } catch { /* なし */ }
  let mode = 'yt', ytDark = null;
  const paintSel = () => document.querySelectorAll('.theme-sel button').forEach(b => b.classList.toggle('on', b.dataset.theme === mode));
  chrome.storage.local.get(['statsTheme', 'ytDark']).then(r => {
    mode = r.statsTheme || 'yt'; ytDark = r.ytDark ?? null;
    apply(mode, ytDark); paintSel();
  });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local' || (!ch.statsTheme && !ch.ytDark)) return;
    if (ch.statsTheme) mode = ch.statsTheme.newValue || 'yt';
    if (ch.ytDark) ytDark = ch.ytDark.newValue ?? null;
    apply(mode, ytDark); paintSel();
  });
  document.addEventListener('DOMContentLoaded', () => {
    const top = document.querySelector('header.top');
    if (!top) return;
    const sel = document.createElement('div');
    sel.className = 'theme-sel';
    sel.title = '表示テーマ';
    sel.innerHTML = '<button data-theme="yt" title="YouTubeのテーマ（ダーク／ライト）に合わせる">自動</button><button data-theme="light">☀ ライト</button><button data-theme="dark">🌙 ダーク</button>';
    sel.addEventListener('click', e => {
      const b = e.target.closest('[data-theme]');
      if (b) chrome.storage.local.set({ statsTheme: b.dataset.theme });
    });
    const brand = top.querySelector('.brand');
    if (brand) brand.after(sel); else top.appendChild(sel);
    paintSel();
  });
})();

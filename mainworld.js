// YouTubeのページ側（MAIN world）で動く小さな橋渡し
//   拡張機能の側（playerx.js）から document の 'tg-cmd' イベントで頼まれたことを、
//   YouTubeのプレイヤーの機能（字幕の切り替えなど）で行い、'tg-res' イベントで返す
(() => {
  if (window.__tgMain) return;
  window.__tgMain = true;
  const player = () => document.querySelector('#movie_player');
  // 字幕データのURL（再生を許可する印 pot 付き）。プレイヤーが取りに行ったものを覚えておく
  const ttUrls = [];
  const note = u => { try { if (String(u).includes('/api/timedtext')) { ttUrls.push(String(u)); if (ttUrls.length > 20) ttUrls.shift(); } } catch { /* なし */ } };
  const xo = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u, ...a) { note(u); return xo.call(this, m, u, ...a); };
  const fo = window.fetch;
  window.fetch = function (input, ...a) { note(typeof input === 'string' ? input : input?.url); return fo.call(this, input, ...a); };

  const ops = {
    // 字幕の一覧と、話している言語（自動字幕の言語）
    tracks() {
      const p = player();
      if (!p?.getOption) return null;
      try { p.loadModule?.('captions'); } catch { /* なし */ }
      const pr = p.getPlayerResponse?.() || {};
      const r = pr.captions?.playerCaptionsTracklistRenderer || {};
      const tracks = (r.captionTracks || []).map(t => ({ lc: t.languageCode, kind: t.kind || '', vss: t.vssId }));
      const asr = tracks.find(t => t.kind === 'asr');
      return { v: pr.videoDetails?.videoId || '', tracks, spoken: asr?.lc || '', cur: p.getOption('captions', 'track') || null };
    },
    // lang の字幕を出す（無ければ話している言語から自動翻訳）。lang=null でオフ
    show({ lang }) {
      const p = player();
      if (!p?.setOption) return false;
      if (!lang) { try { p.setOption('captions', 'track', {}); p.unloadModule?.('captions'); } catch { /* なし */ } return true; }
      try { p.loadModule?.('captions'); } catch { /* なし */ }
      const tl = p.getOption('captions', 'tracklist', { includeAsr: true }) || [];
      if (!tl.length) return false;
      const exact = tl.find(t => t.languageCode === lang && t.kind !== 'asr') || tl.find(t => t.languageCode === lang);
      if (exact) { p.setOption('captions', 'track', exact); return 'exact'; }
      const src = tl.find(t => t.kind === 'asr') || tl.find(t => t.is_translateable) || tl[0];
      p.setOption('captions', 'track', { ...src, translationLanguage: { languageCode: lang, languageName: lang === 'ja' ? '日本語' : lang } });
      return 'translated';
    },
    // 正確な投稿日時・再生数・タグ（投稿者が設定した検索キーワード）
    meta() {
      const pr = player()?.getPlayerResponse?.() || {};
      const vd = pr.videoDetails || {}, mf = pr.microformat?.playerMicroformatRenderer || {};
      return { v: vd.videoId || '', kw: vd.keywords || [], views: +vd.viewCount || 0, publish: mf.publishDate || mf.uploadDate || '', liveStart: mf.liveBroadcastDetails?.startTimestamp || '', live: !!vd.isLive, category: mf.category || '' };
    },
    // 画質の上限（tiny＝144p。'auto' で元に戻す）
    quality({ q }) {
      const p = player();
      if (!p?.setPlaybackQualityRange) return null;
      p.setPlaybackQualityRange(q, q);
      return p.getPlaybackQuality?.() || q;
    },
    // 最後に取りに行った字幕データのURL（この動画のもの）
    ttUrl({ v }) {
      for (let i = ttUrls.length - 1; i >= 0; i--) { try { if (new URL(ttUrls[i], location.href).searchParams.get('v') === v) return new URL(ttUrls[i], location.href).href; } catch { /* なし */ } }
      const pe = performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('/api/timedtext') && n.includes('v=' + v));
      return pe[pe.length - 1] || null;
    }
  };
  document.addEventListener('tg-cmd', e => {
    let d; try { d = JSON.parse(e.detail); } catch { return; }
    let result = null, error = null;
    try { result = ops[d.op]?.(d.args || {}); } catch (err) { error = String(err?.message || err); }
    document.dispatchEvent(new CustomEvent('tg-res', { detail: JSON.stringify({ id: d.id, result, error }) }));
  });
})();

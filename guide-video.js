let apiPromise;

export function validGuideOffset(mapping) {
  return mapping?.syncStatus === 'verified' && Number.isFinite(mapping.audioToVideoOffset) && mapping.audioToVideoOffset >= 0;
}

export class GuidePlayback {
  constructor(mapping, callbacks = {}, timeoutMs = 10000, timers = globalThis) {
    this.mapping = mapping;
    this.callbacks = callbacks;
    this.enabled = true;
    this.ready = false;
    this.failed = false;
    this.player = null;
    this.intent = 'stopped';
    this.audioTime = 0;
    this.restart = false;
    this.timeout = timers.setTimeout(() => this.fail('timeout'), timeoutMs);
    this.clearTimeout = timers.clearTimeout.bind(timers);
  }
  onReady(player) {
    if (this.failed) return;
    this.player = player;
    this.ready = true;
    this.clearTimeout(this.timeout);
    this.callbacks.onReady?.();
    this.apply();
  }
  onError(code) { this.fail(`error:${code}`); }
  onAutoplayBlocked() {
    this.callbacks.onAutoplayBlocked?.();
  }
  fail(reason) {
    if (this.failed) return;
    this.failed = true;
    this.ready = false;
    this.clearTimeout(this.timeout);
    this.callbacks.onFailure?.(reason);
  }
  call(method, ...args) {
    if (!this.ready || this.failed || typeof this.player?.[method] !== 'function') return false;
    try { this.player[method](...args); return true; }
    catch { this.fail('player-command'); return false; }
  }
  apply() {
    if (!this.ready || this.failed) return false;
    this.call('mute');
    if (!this.enabled || this.intent !== 'playing') return this.call('pauseVideo');
    if (this.restart) {
      const target = validGuideOffset(this.mapping) ? this.audioTime + this.mapping.audioToVideoOffset : 0;
      this.call('seekTo', target, true);
      this.restart = false;
    } else if (validGuideOffset(this.mapping)) {
      this.call('seekTo', this.audioTime + this.mapping.audioToVideoOffset, true);
    }
    return this.call('playVideo');
  }
  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    return this.apply();
  }
  start(audioTime = 0) {
    this.intent = 'playing'; this.audioTime = audioTime; this.restart = true;
    return this.apply();
  }
  pause() { this.intent = 'paused'; return this.call('pauseVideo'); }
  resume(audioTime = 0) {
    this.intent = 'playing'; this.audioTime = audioTime; this.restart = false;
    return this.apply();
  }
  stop() { this.intent = 'stopped'; this.restart = false; return this.call('pauseVideo'); }
}

export function loadYouTubeAPI(win = window, doc = document) {
  if (win.YT?.Player) return Promise.resolve(win.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const previous = win.onYouTubeIframeAPIReady;
    win.onYouTubeIframeAPIReady = () => { previous?.(); resolve(win.YT); };
    const script = doc.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => reject(new Error('YouTube API load failed'));
    doc.head.append(script);
  });
  return apiPromise;
}

export async function mountYouTubePlayer(controller, elementId, videoId, win = window, doc = document) {
  try {
    const YT = await loadYouTubeAPI(win, doc);
    return new YT.Player(elementId, {
      width: '100%', height: '200', videoId,
      playerVars: { controls: 1, playsinline: 1, mute: 1 },
      events: {
        onReady: event => controller.onReady(event.target),
        onError: event => controller.onError(event.data),
        onAutoplayBlocked: () => controller.onAutoplayBlocked()
      }
    });
  } catch { controller.fail('api-load'); return null; }
}

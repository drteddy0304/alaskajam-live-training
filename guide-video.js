let apiPromise;
export const GUIDE_SYNC_TOLERANCE = 1.25;
export const GUIDE_SYNC_CHECK_DELAY = 3;

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
    this.nextSyncAt = Infinity;
    this.timeout = timers.setTimeout(() => this.fail('timeout'), timeoutMs);
    this.clearTimeout = timers.clearTimeout.bind(timers);
  }
  onReady(player) {
    if (this.failed) return;
    this.player = player;
    this.ready = true;
    this.clearTimeout(this.timeout);
    try { player.setOption?.('captions', 'track', {}); } catch {}
    try { player.unloadModule?.('captions'); } catch {}
    this.callbacks.onReady?.();
    this.apply();
  }
  onError(code) { this.fail(`error:${code}`); }
  onAutoplayBlocked() {
    this.callbacks.onAutoplayBlocked?.();
  }
  onStateChange(state) {
    // Programmatic pauses change intent first. PAUSED while the guide still
    // intends to play therefore came from the YouTube player controls.
    if (state === 2 && this.intent === 'playing' && this.enabled) this.callbacks.onPauseRequest?.();
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
    const target = validGuideOffset(this.mapping) ? this.audioTime + this.mapping.audioToVideoOffset : 0;
    if (this.restart || validGuideOffset(this.mapping)) this.call('seekTo', target, true);
    this.restart = false;
    return this.call('playVideo');
  }
  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    return this.apply();
  }
  prime(audioTime = 0) {
    // Muted YouTube playback does not need to run behind the countdown. Keep
    // the player stopped at its mapped start until the MP3 is released.
    this.intent = 'paused'; this.audioTime = audioTime; this.restart = false;
    return this.reset(audioTime);
  }
  reset(audioTime = 0) {
    this.audioTime = audioTime; this.restart = false;
    const target = validGuideOffset(this.mapping) ? audioTime + this.mapping.audioToVideoOffset : 0;
    if (this.ready && this.enabled) this.call('seekTo', target, true);
    this.intent = 'paused';
    return this.call('pauseVideo');
  }
  start(audioTime = 0) {
    this.intent = 'playing'; this.audioTime = audioTime; this.restart = true;
    this.resetSyncSchedule(audioTime);
    return this.apply();
  }
  pause() { this.intent = 'paused'; return this.call('pauseVideo'); }
  resume(audioTime = 0) {
    this.intent = 'playing'; this.audioTime = audioTime; this.restart = false;
    this.resetSyncSchedule(audioTime);
    return this.apply();
  }
  seek(audioTime = 0) {
    this.audioTime = audioTime;
    this.resetSyncSchedule(audioTime);
    const target = validGuideOffset(this.mapping) ? audioTime + this.mapping.audioToVideoOffset : audioTime;
    if (!this.enabled) return false;
    this.call('mute');
    const moved = this.call('seekTo', target, true);
    if (this.intent === 'playing') this.call('playVideo');
    else this.call('pauseVideo');
    return moved;
  }
  stop() { this.intent = 'stopped'; this.restart = false; return this.call('pauseVideo'); }
  resetSyncSchedule(audioTime = 0) { this.nextSyncAt = audioTime + GUIDE_SYNC_CHECK_DELAY; }
  // MP3 time is authoritative. Check once just after start/resume. Repeated
  // seeks make YouTube request new segments and cause visible mobile stutter.
  sync(audioTime, tolerance = GUIDE_SYNC_TOLERANCE) {
    if (!this.enabled || !this.ready || this.failed || this.intent !== 'playing' || !validGuideOffset(this.mapping)) return false;
    try {
      if (typeof this.player?.getPlayerState !== 'function' || this.player.getPlayerState() !== 1) return false;
      if (typeof this.player.getCurrentTime !== 'function') return false;
      const current = this.player.getCurrentTime();
      const expected = audioTime + this.mapping.audioToVideoOffset;
      if (!Number.isFinite(current) || !Number.isFinite(expected) || Math.abs(current - expected) <= tolerance) return false;
      return this.call('seekTo', expected, false);
    } catch { return false; }
  }
  syncIfDue(audioTime) {
    if (!Number.isFinite(audioTime) || audioTime < this.nextSyncAt) return false;
    this.nextSyncAt = Infinity;
    return this.sync(audioTime);
  }
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

export function resetYouTubeMount(elementId, doc = document) {
  const current = doc.getElementById?.(elementId);
  if (!current || String(current.tagName).toUpperCase() !== 'IFRAME') return current;
  const replacement = doc.createElement('div');
  replacement.id = elementId;
  replacement.setAttribute('aria-label', current.getAttribute?.('aria-label') || '公式Cheering Guideを読み込み中');
  current.replaceWith(replacement);
  return replacement;
}

export async function mountYouTubePlayer(controller, elementId, videoId, win = window, doc = document) {
  try {
    const YT = await loadYouTubeAPI(win, doc);
    resetYouTubeMount(elementId, doc);
    return new YT.Player(elementId, {
      width: '100%', height: '200', videoId,
      playerVars: { controls: 1, playsinline: 1, mute: 1, cc_load_policy: 0 },
      events: {
        onReady: event => controller.onReady(event.target),
        onError: event => controller.onError(event.data),
        onAutoplayBlocked: () => controller.onAutoplayBlocked(),
        onStateChange: event => controller.onStateChange(event.data)
      }
    });
  } catch { controller.fail('api-load'); return null; }
}

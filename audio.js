// Native media playback starts inside the user's tap, including on mobile Safari.
// Scoring follows the media position, so buffering cannot run the chart ahead.
export class Music {
  constructor() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    this.media = new Audio();
    this.media.preload = 'auto';
    this.media.setAttribute('playsinline', '');
    this.media.muted = false;
    this.media.volume = 1;
    this.closed = false;
    this.offset = 0;
    this.oninterrupt = null;
    this.media.addEventListener('pause', () => { if (!this.closed && !this.media.ended) this.oninterrupt?.(); });
    this.media.addEventListener('error', () => { if (!this.closed) this.oninterrupt?.(); });
  }
  async prime(src, offset = 0, duration = Infinity) {
    this.media.src = src;
    // Keep the user-authorized playback alive but silent through countdown.
    // Pausing here and calling play() five seconds later is blocked on some
    // mobile browsers; playing unmuted here can leak the song before "1".
    this.media.muted = true;
    // Do not insert an await before play(): the start button's gesture is needed.
    const playing = this.media.play();
    let timer;
    try {
      await Promise.race([playing, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('音源の読み込みがタイムアウトしました')), 30000);
      })]);
      if (this.closed) throw new Error('再生を中止しました');
      if (Number.isFinite(duration)) { this.start(0, offset, duration); this.reset(); }
    } finally { clearTimeout(timer); }
  }
  async load(src) { return this.prime(src); }
  start(_countdown, offset, duration) {
    if (Number.isFinite(this.media.duration) && offset + duration > this.media.duration + .05) throw new Error('音源が練習時間より短いため再生できません');
    this.offset = offset;
    this.duration = duration;
    if (offset) this.media.currentTime = offset;
  }
  reset() {
    this.media.currentTime = this.offset;
  }
  time() { return this.media.ended ? this.duration : Math.max(0, this.media.currentTime - this.offset); }
  seek(time) {
    const target = Math.max(0, Math.min(Number(time) || 0, this.duration));
    this.media.currentTime = this.offset + target;
    return target;
  }
  async pause() { this.media.pause(); }
  async release(time = 0) {
    this.seek(time);
    this.media.muted = false;
    if (!this.media.paused) return;
    return this.resume();
  }
  async resume() {
    this.media.muted = false;
    if (!this.media.paused) return;
    let timer;
    try {
      await Promise.race([this.media.play(), new Promise((_,reject) => {
        timer = setTimeout(() => reject(new Error('再生できませんでした')),15000);
      })]);
    } finally { clearTimeout(timer); }
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.oninterrupt = null;
    this.media.pause();
    this.media.removeAttribute('src');
    this.media.load();
  }
}

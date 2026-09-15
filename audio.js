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
  async load(src) {
    this.media.src = src;
    // Do not insert an await before play(): the start button's gesture is needed.
    const playing = this.media.play();
    let timer;
    try {
      await Promise.race([playing, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('音源の読み込みがタイムアウトしました')), 30000);
      })]);
      if (this.closed) throw new Error('再生を中止しました');
    } finally { clearTimeout(timer); }
  }
  start(_countdown, offset, duration) {
    if (Number.isFinite(this.media.duration) && offset + duration > this.media.duration + .05) throw new Error('音源が練習時間より短いため再生できません');
    this.offset = offset;
    this.duration = duration;
    if (offset) this.media.currentTime = offset;
  }
  time() { return this.media.ended ? this.duration : Math.max(0, this.media.currentTime - this.offset); }
  async pause() { this.media.pause(); }
  async resume() {
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

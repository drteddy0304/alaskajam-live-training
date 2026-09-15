// One clock drives both the scheduled music and chart, including the countdown.
export class Music {
  constructor() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('このブラウザは音楽再生に対応していません');
    this.context = new Context();
    this.abort = new AbortController();
    // Must run synchronously within the start-button gesture on mobile Safari.
    this.unlocked = this.context.resume();
    this.unlocked.catch(() => {});
    this.closed = false;
  }
  async load(src) {
    const timer = setTimeout(() => this.abort.abort(), 30000);
    try {
      const response = await fetch(src, {signal:this.abort.signal});
      if (!response.ok) throw new Error('音源の読み込みに失敗しました');
      this.buffer = await this.context.decodeAudioData(await response.arrayBuffer());
      await this.unlocked;
      if (this.closed) throw new Error('再生を中止しました');
    } finally { clearTimeout(timer); }
  }
  start(countdown, offset, duration) {
    if (offset + duration > this.buffer.duration) throw new Error('音源が練習時間より短いため再生できません');
    this.anchor = this.context.currentTime + countdown;
    this.source = this.context.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.connect(this.context.destination);
    this.source.start(this.anchor, offset, duration);
  }
  time() { return this.context.currentTime - this.anchor; }
  pause() { return this.context.suspend(); }
  resume() { return this.context.resume(); }
  close() {
    if (this.closed) return;
    this.closed = true; this.abort.abort();
    try { this.source?.stop(); } catch {}
    this.context.close().catch(() => {});
  }
}

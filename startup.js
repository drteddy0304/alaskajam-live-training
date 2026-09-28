export const COUNTDOWN_SECONDS = 5;

export class StartCountdown {
  constructor({onTick, onComplete, timers = globalThis, seconds = COUNTDOWN_SECONDS}) {
    this.onTick = onTick;
    this.onComplete = onComplete;
    this.timers = timers;
    this.seconds = seconds;
    this.remaining = seconds;
    this.timer = null;
    this.active = false;
  }
  start() {
    if (this.active) return false;
    this.active = true;
    this.remaining = this.seconds;
    this.onTick?.(this.remaining);
    this.schedule();
    return true;
  }
  schedule() {
    this.timer = this.timers.setTimeout(() => {
      if (!this.active) return;
      this.remaining -= 1;
      if (this.remaining > 0) {
        this.onTick?.(this.remaining);
        this.schedule();
      } else {
        this.active = false;
        this.timer = null;
        this.onComplete?.();
      }
    }, 1000);
  }
  cancel() {
    if (!this.active) return false;
    this.active = false;
    this.timers.clearTimeout(this.timer);
    this.timer = null;
    return true;
  }
}

// Both playback requests happen before this function returns its first promise.
export function primeMedia(audio, guide, {src, offset, duration}) {
  const audioReady = audio ? audio.prime(src, offset, duration) : Promise.resolve();
  guide?.prime(0);
  return Promise.resolve(audioReady).then(() => {
    audio?.reset();
    guide?.reset(0);
  });
}

// Keep both calls in the same task; callers may observe the returned promise later.
export function startMediaTogether(audio, guide, audioTime = 0) {
  const audioStarted = audio ? audio.resume() : Promise.resolve();
  guide?.resume(audioTime);
  return Promise.resolve(audioStarted);
}

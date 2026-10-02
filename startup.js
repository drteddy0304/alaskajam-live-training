export const COUNTDOWN_SECONDS = 5;

export function countdownOverlayState(value = null, preparing = false) {
  return value === null
    ? {hidden: true, preparing: false, label: 'START IN', value: ''}
    : {hidden: false, preparing, label: preparing ? 'PLEASE WAIT' : 'START IN', value: String(value)};
}

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

// Joins the independent countdown and media-preparation paths. Preparation may
// finish in either order, but playback is released exactly once after both.
export class StartBarrier {
  constructor({onTick, onPreparing, onReady, onError, timers = globalThis, seconds = COUNTDOWN_SECONDS}) {
    this.onPreparing = onPreparing;
    this.onReady = onReady;
    this.onError = onError;
    this.cancelled = false;
    this.countdownDone = false;
    this.preparationDone = false;
    this.released = false;
    this.countdown = new StartCountdown({
      timers, seconds, onTick,
      onComplete: () => {
        if (this.cancelled) return;
        this.countdownDone = true;
        if (!this.preparationDone) this.onPreparing?.();
        this.release();
      }
    });
  }
  start(preparation) {
    this.countdown.start();
    Promise.resolve(preparation).then(() => {
      if (this.cancelled) return;
      this.preparationDone = true;
      this.release();
    }, error => {
      if (this.cancelled) return;
      this.cancel();
      this.onError?.(error);
    });
    return this;
  }
  release() {
    if (this.cancelled || this.released || !this.countdownDone || !this.preparationDone) return false;
    this.released = true;
    this.onReady?.();
    return true;
  }
  cancel() {
    if (this.cancelled || this.released) return false;
    this.cancelled = true;
    this.countdown.cancel();
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

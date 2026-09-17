export function validGuideOffset(mapping) {
  return mapping?.syncStatus === 'verified' && Number.isFinite(mapping.audioToVideoOffset) && mapping.audioToVideoOffset >= 0;
}

export class GuidePlayback {
  constructor(transport, mapping, onFailure = () => {}) {
    this.transport = transport;
    this.mapping = mapping;
    this.onFailure = onFailure;
    this.available = true;
  }
  command(name, value) {
    if (!this.available) return false;
    try { this.transport(name, value); return true; }
    catch (error) { this.available = false; this.onFailure(error); return false; }
  }
  start(audioTime = 0, retry = false) {
    this.command('mute');
    if (validGuideOffset(this.mapping)) this.command('seekTo', audioTime + this.mapping.audioToVideoOffset);
    else if (retry) this.command('seekTo', 0);
    return this.command('playVideo');
  }
  pause() { return this.command('pauseVideo'); }
  resume(audioTime = 0) {
    if (validGuideOffset(this.mapping)) this.command('seekTo', audioTime + this.mapping.audioToVideoOffset);
    return this.command('playVideo');
  }
  stop() { return this.command('pauseVideo'); }
}

export function iframeTransport(iframe) {
  return (func, value) => {
    if (!iframe.contentWindow) throw new Error('YouTube player unavailable');
    const args = value === undefined ? [] : [value, true];
    iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), 'https://www.youtube.com');
  };
}

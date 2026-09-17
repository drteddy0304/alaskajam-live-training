import test from 'node:test';
import assert from 'node:assert/strict';
import { GuidePlayback, mountYouTubePlayer, validGuideOffset } from '../guide-video.js';

const timers = () => {
  const state = { callback: null, cleared: false };
  return { state, setTimeout(callback) { state.callback = callback; return 1; }, clearTimeout() { state.cleared = true; } };
};
const player = () => {
  const calls = [];
  return { calls, mute: () => calls.push(['mute']), seekTo: (...args) => calls.push(['seekTo',...args]), playVideo: () => calls.push(['playVideo']), pauseVideo: () => calls.push(['pauseVideo']) };
};

test('start waits for official API ready, then rewinds, mutes, and plays', () => {
  const time = timers(), media = player(), statuses = [];
  const guide = new GuidePlayback({syncStatus:'unverified',audioToVideoOffset:null}, {onReady:()=>statuses.push('ready')}, 10000, time);
  assert.equal(guide.start(0), false);
  assert.deepEqual(media.calls, []);
  guide.onReady(media);
  assert.equal(time.state.cleared, true);
  assert.deepEqual(statuses, ['ready']);
  assert.deepEqual(media.calls, [['mute'],['seekTo',0,true],['playVideo']]);
  assert.equal(validGuideOffset({syncStatus:'unverified',audioToVideoOffset:9}), false);
});

test('video OFF applies to ready, pause, resume, retry, and late onReady', () => {
  const time = timers(), media = player();
  const guide = new GuidePlayback({syncStatus:'unverified',audioToVideoOffset:null}, {}, 10000, time);
  guide.setEnabled(false);
  guide.start(0);
  guide.onReady(media);
  guide.pause(); guide.resume(25); guide.start(0);
  assert.equal(media.calls.some(call => call[0] === 'playVideo'), false);
  assert.equal(media.calls.some(call => call[0] === 'seekTo'), false);
  guide.setEnabled(true);
  assert.deepEqual(media.calls.slice(-3), [['mute'],['seekTo',0,true],['playVideo']]);
});

test('late ready while stopped on home never starts hidden video', () => {
  const media = player(), guide = new GuidePlayback({syncStatus:'unverified'}, {}, 10000, timers());
  guide.stop();
  guide.onReady(media);
  assert.equal(media.calls.some(call => call[0] === 'playVideo'), false);
  assert.deepEqual(media.calls, [['mute'],['pauseVideo']]);
});

test('every start rewinds the same song and resume keeps mute without unverified seek', () => {
  const media = player(), guide = new GuidePlayback({syncStatus:'unverified',audioToVideoOffset:null}, {}, 10000, timers());
  guide.onReady(media); media.calls.length = 0;
  guide.start(0); guide.pause(); guide.resume(30); guide.stop(); guide.start(0);
  assert.deepEqual(media.calls, [
    ['mute'],['seekTo',0,true],['playVideo'],['pauseVideo'],
    ['mute'],['playVideo'],['pauseVideo'],
    ['mute'],['seekTo',0,true],['playVideo']
  ]);
});

test('verified mapping seeks only on start/resume lifecycle transitions', () => {
  const media = player(), guide = new GuidePlayback({syncStatus:'verified',audioToVideoOffset:8.75}, {}, 10000, timers());
  guide.onReady(media); media.calls.length = 0;
  guide.start(0); guide.pause(); guide.resume(12);
  assert.deepEqual(media.calls, [['mute'],['seekTo',8.75,true],['playVideo'],['pauseVideo'],['mute'],['seekTo',20.75,true],['playVideo']]);
});

test('official API error, autoplay block, and ready timeout report real state without throwing', async () => {
  const time = timers(), reports = [];
  const guide = new GuidePlayback({syncStatus:'unverified'}, {onFailure:r=>reports.push(r),onAutoplayBlocked:()=>reports.push('blocked')}, 10000, time);
  let options;
  class Player { constructor(id, config) { assert.equal(id,'guide-player'); options=config; } }
  await mountYouTubePlayer(guide, 'guide-player', 'video-id', {YT:{Player}}, {});
  options.events.onAutoplayBlocked();
  options.events.onError({data:101});
  assert.deepEqual(reports, ['blocked','error:101']);

  const timeoutReports = [], timeout = timers();
  new GuidePlayback({}, {onFailure:r=>timeoutReports.push(r)}, 10000, timeout);
  timeout.state.callback();
  assert.deepEqual(timeoutReports, ['timeout']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { GuidePlayback, mountYouTubePlayer, validGuideOffset } from '../guide-video.js';

const timers = () => {
  const state = { callback: null, cleared: false };
  return { state, setTimeout(callback) { state.callback = callback; return 1; }, clearTimeout() { state.cleared = true; } };
};
const player = () => {
  const calls = [];
  return { calls, currentTime: 0, state: 1, mute: () => calls.push(['mute']), seekTo: (...args) => calls.push(['seekTo',...args]), playVideo: () => calls.push(['playVideo']), pauseVideo: () => calls.push(['pauseVideo']), getCurrentTime() { return this.currentTime; }, getPlayerState() { return this.state; } };
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
  const media = player(), guide = new GuidePlayback({syncStatus:'verified',audioToVideoOffset:8.2508}, {}, 10000, timers());
  guide.onReady(media); media.calls.length = 0;
  guide.start(0); guide.pause(); guide.resume(12);
  assert.deepEqual(media.calls, [['mute'],['seekTo',8.2508,true],['playVideo'],['pauseVideo'],['mute'],['seekTo',12 + 8.2508,true],['playVideo']]);
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

test('prime requests muted playback then pauses and resets at verified offset', () => {
  const media = player(), guide = new GuidePlayback({syncStatus:'verified',audioToVideoOffset:8.2508}, {}, 10000, timers());
  guide.onReady(media); media.calls.length = 0;
  guide.prime(0);
  assert.deepEqual(media.calls, [['mute'],['seekTo',8.2508,true],['playVideo'],['pauseVideo']]);
  guide.reset(0);
  assert.deepEqual(media.calls.slice(-2), [['seekTo',8.2508,true],['pauseVideo']]);
});

test('measured guide sync uses offset math and corrects drift above 0.15 seconds', () => {
  const media=player(), guide=new GuidePlayback({syncStatus:'verified',audioToVideoOffset:8.2508},{},10000,timers());
  guide.onReady(media);guide.start(2);media.calls.length=0;
  media.currentTime=10.35;
  assert.equal(guide.sync(2),false);
  assert.deepEqual(media.calls,[]);
  media.currentTime=9;
  assert.equal(guide.sync(2),true);
  assert.deepEqual(media.calls,[['seekTo',10.2508,true]]);
});

test('sync schedule checks twice a second early and once a second later', () => {
  const media=player(), guide=new GuidePlayback({syncStatus:'verified',audioToVideoOffset:8.2508},{},10000,timers());
  guide.onReady(media);guide.start(0);media.calls.length=0;media.currentTime=0;
  assert.equal(guide.syncIfDue(.49),false);assert.equal(guide.nextSyncAt,.5);
  guide.syncIfDue(.5);assert.equal(guide.nextSyncAt,1);
  guide.syncIfDue(10);assert.equal(guide.nextSyncAt,11);
  guide.resume(20);assert.equal(guide.nextSyncAt,20.5);
});

test('a manual YouTube pause requests one shared game pause', () => {
  const requests=[];
  const guide=new GuidePlayback({syncStatus:'verified',audioToVideoOffset:8.2508},{onPauseRequest:()=>requests.push('pause')},10000,timers());
  const media=player();guide.onReady(media);guide.start(0);
  guide.onStateChange(2);
  assert.deepEqual(requests,['pause']);
  guide.pause();guide.onStateChange(2);
  assert.deepEqual(requests,['pause']);
});

test('sync is a no-op when OFF, unavailable, failed, or not actively playing', () => {
  const mapping={syncStatus:'verified',audioToVideoOffset:8.2508};
  const media=player(), guide=new GuidePlayback(mapping,{},10000,timers());
  assert.equal(guide.sync(2),false);
  guide.onReady(media);guide.start(0);media.calls.length=0;
  media.state=3;assert.equal(guide.sync(2),false);
  media.state=1;guide.setEnabled(false);media.calls.length=0;assert.equal(guide.sync(2),false);
  guide.enabled=true;guide.failed=true;assert.equal(guide.sync(2),false);
  assert.deepEqual(media.calls,[]);
});

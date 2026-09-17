import test from 'node:test';
import assert from 'node:assert/strict';
import { GuidePlayback, validGuideOffset } from '../guide-video.js';

test('unverified mapping never applies the provisional offset or repeatedly seeks', () => {
  const calls = [];
  const guide = new GuidePlayback((...args) => calls.push(args), {syncStatus:'unverified', audioToVideoOffset:null});
  guide.start(0, false);
  guide.resume(45);
  assert.deepEqual(calls, [['mute',undefined], ['playVideo',undefined], ['playVideo',undefined]]);
  assert.equal(validGuideOffset({syncStatus:'unverified',audioToVideoOffset:9}), false);
});

test('verified mapping seeks only at lifecycle transitions and pause/stop remain linked', () => {
  const calls = [];
  const guide = new GuidePlayback((...args) => calls.push(args), {syncStatus:'verified', audioToVideoOffset:8.75});
  guide.start(0);
  guide.pause();
  guide.resume(12);
  guide.stop();
  assert.deepEqual(calls, [
    ['mute',undefined], ['seekTo',8.75], ['playVideo',undefined], ['pauseVideo',undefined],
    ['seekTo',20.75], ['playVideo',undefined], ['pauseVideo',undefined]
  ]);
});

test('retry restarts an unverified guide without claiming synchronization', () => {
  const calls = [];
  const guide = new GuidePlayback((...args) => calls.push(args), {syncStatus:'unverified', audioToVideoOffset:null});
  guide.start(0, true);
  assert.deepEqual(calls, [['mute',undefined], ['seekTo',0], ['playVideo',undefined]]);
});

test('video transport failure is reported once and does not throw into game flow', () => {
  let failures = 0;
  const guide = new GuidePlayback(() => { throw new Error('blocked'); }, {syncStatus:'unverified'}, () => failures++);
  assert.equal(guide.start(), false);
  assert.equal(guide.pause(), false);
  assert.equal(guide.resume(), false);
  assert.equal(failures, 1);
});

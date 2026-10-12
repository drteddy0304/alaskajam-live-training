import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRecording, noteFromGesture, recordingText} from '../recorder.js';

test('tap and swipe use the supplied audio timestamp without release-time delay', () => {
  assert.deepEqual(noteFromGesture(12.34549, 'tap'), {time: 12.345, action: 'CLAP'});
  assert.deepEqual(noteFromGesture(22.125, 'tap', 'CALL'), {time: 22.125, action: 'CALL'});
  assert.deepEqual(noteFromGesture(33.75, 'tap', 'JUMP'), {time: 33.75, action: 'JUMP'});
  assert.deepEqual(noteFromGesture(44.9876, 'left', 'CALL'), {time: 44.988, action: 'WIPER', direction: 'left'});
  assert.deepEqual(noteFromGesture(45, 'right'), {time: 45, action: 'WIPER', direction: 'right'});
});

test('unsupported gestures, tap actions, and timestamps are rejected', () => {
  assert.throws(() => noteFromGesture(-1, 'tap'), /時刻/);
  assert.throws(() => noteFromGesture(Number.NaN, 'tap'), /時刻/);
  assert.throws(() => noteFromGesture(1, 'up'), /操作/);
  assert.throws(() => noteFromGesture(1, 'tap', 'WIPER'), /タップ種別/);
});

test('recording export is portable JSON and does not retain mutable note references', () => {
  const notes = [{time: 1.25, action: 'CLAP'}];
  const recording = buildRecording({id: 'song', title: 'Song', duration: 10}, notes, '2026-10-12T00:00:00.000Z');
  notes[0].time = 9;
  assert.deepEqual(recording, {
    version: 1, songId: 'song', title: 'Song', duration: 10,
    recordedAt: '2026-10-12T00:00:00.000Z', notes: [{time: 1.25, action: 'CLAP'}]
  });
  assert.deepEqual(JSON.parse(recordingText(recording)), recording);
});

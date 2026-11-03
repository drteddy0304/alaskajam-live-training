import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRecording, noteFromGesture, recorderShortcut, recordingText, rewindTake, songTime} from '../recorder.js';

test('five-second audio pre-roll maps exactly to song time zero', () => {
  assert.equal(songTime(0), 0);
  assert.equal(songTime(4.999), 0);
  assert.equal(songTime(5), 0);
  assert.ok(Math.abs(songTime(5.2) - .2) < 1e-9);
});

test('rewind removes the section that will be recorded again', () => {
  const notes = [
    {time: 2, action: 'CLAP'},
    {time: 6, action: 'CALL'},
    {time: 9, action: 'WIPER', direction: 'left'}
  ];
  assert.deepEqual(rewindTake(10, 5, notes), {time: 5, notes: [{time: 2, action: 'CLAP'}]});
  assert.deepEqual(rewindTake(3, 5, notes), {time: 0, notes: []});
});

test('rewind in a layered take keeps completed passes intact', () => {
  const notes = [
    {time: 8, action: 'CLAP', pass: 1},
    {time: 3, action: 'CALL', pass: 2},
    {time: 8, action: 'CALL', pass: 2}
  ];
  assert.deepEqual(rewindTake(10, 5, notes, 2), {
    time: 5,
    notes: [
      {time: 8, action: 'CLAP', pass: 1},
      {time: 3, action: 'CALL', pass: 2}
    ]
  });
});

test('tap and swipe use the supplied audio timestamp without release-time delay', () => {
  assert.deepEqual(noteFromGesture(12.34549, 'tap'), {time: 12.345, action: 'CLAP'});
  assert.deepEqual(noteFromGesture(22.125, 'tap', 'CALL'), {time: 22.125, action: 'CALL'});
  assert.deepEqual(noteFromGesture(22.5, 'tap', 'CLAP_CALL'), {time: 22.5, action: 'CALL', simultaneous: ['CLAP']});
  assert.deepEqual(noteFromGesture(33.75, 'tap', 'JUMP'), {time: 33.75, action: 'JUMP'});
  assert.deepEqual(noteFromGesture(44.9876, 'left', 'CALL'), {time: 44.988, action: 'WIPER', direction: 'left'});
  assert.deepEqual(noteFromGesture(45, 'right'), {time: 45, action: 'WIPER', direction: 'right'});
});

test('keyboard shortcuts record CLAP and both WIPER directions on keydown only', () => {
  assert.deepEqual(recorderShortcut('Space'), {gesture:'tap',tapAction:'CLAP'});
  assert.deepEqual(recorderShortcut('ArrowLeft'), {gesture:'left'});
  assert.deepEqual(recorderShortcut('ArrowRight'), {gesture:'right'});
  assert.equal(recorderShortcut('Space', true), null);
  assert.equal(recorderShortcut('Enter'), null);
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

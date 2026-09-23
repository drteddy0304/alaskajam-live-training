import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Session } from '../engine.js';
import { lyricAt, validateLyrics } from '../lyrics.js';

const source = { name: 'guide', url: 'https://example.test/guide', revision: 'verified-1' };
const cues = [
  { start: 10, end: 12, text: 'First!', source: 'guide 00:10–00:12' },
  { start: 12, end: 13.5, text: 'Second!', source: 'guide 00:12–00:13.5' }
];

test('sing-along preview, start, and end boundaries are exact', () => {
  assert.equal(lyricAt(cues, 7.999, 2), null);
  assert.equal(lyricAt(cues, 8, 2).phase, 'upcoming');
  assert.equal(lyricAt(cues, 9.999, 2).phase, 'upcoming');
  assert.equal(lyricAt(cues, 10, 2).phase, 'active');
  assert.equal(lyricAt(cues, 13.499, 2).cue.text, 'Second!');
  assert.equal(lyricAt(cues, 13.5, 2), null);
});

test('adjacent cues switch at their shared boundary without a blank frame', () => {
  assert.equal(lyricAt(cues, 11.999, 2).cue.text, 'First!');
  assert.equal(lyricAt(cues, 12, 2).cue.text, 'Second!');
  assert.equal(lyricAt(cues, 12, 2).phase, 'active');
});

test('validation rejects missing text/source, invalid ranges, overlaps, and unordered cues', () => {
  validateLyrics({ version: 1, source, cues }, 20);
  for (const badCues of [
    [{ start: 1, end: 2, text: '', source: 'x' }],
    [{ start: 1, end: 2, text: 'x', source: '' }],
    [{ start: 2, end: 2, text: 'x', source: 'x' }],
    [{ start: 19, end: 21, text: 'x', source: 'x' }],
    [{ start: 2, end: 4, text: 'x', source: 'x' }, { start: 3, end: 5, text: 'y', source: 'x' }]
  ]) assert.throws(() => validateLyrics({ version: 1, source, cues: badCues }, 20));
});

test('display is derived only from playback time across scoring, pause, resume, and retry', () => {
  const chart = JSON.parse(readFileSync(new URL('../data/demo.json', import.meta.url)));
  const session = new Session(chart);
  const beforeScore = lyricAt(cues, 10.5, 2);
  session.input(chart.notes[0].time, 'tap');
  assert.deepEqual(lyricAt(cues, 10.5, 2), beforeScore);
  assert.equal(lyricAt(cues, 10.5, 2).phase, 'active'); // paused frame
  assert.equal(lyricAt(cues, 11, 2).phase, 'active'); // resumed media time
  assert.equal(lyricAt(cues, 0, 2), null); // retry resets media time
});

test('production cues use verified MP3 boundaries and retain uncertain observations', () => {
  const data = JSON.parse(readFileSync(new URL('../data/cat-walk-life-lyrics.json', import.meta.url)));
  validateLyrics(data, 224.391875);
  assert.equal(data.timingStatus, 'verified');
  assert.equal(data.leadTime, 2);
  assert.equal(data.cues.length, 22);
  assert.deepEqual(data.observations.map(item => item.videoTime), [8, 51.9, 59.9]);

  const first = data.cues[0];
  assert.deepEqual([first.start, first.end, first.text], [1.2492, 2.4492, 'MEOW MEOW MEOW']);
  assert.equal(lyricAt(data.cues, first.start - 2.0001, data.leadTime), null);
  assert.equal(lyricAt(data.cues, first.start - 2, data.leadTime).phase, 'upcoming');
  assert.equal(lyricAt(data.cues, first.start, data.leadTime).phase, 'active');
  assert.notEqual(lyricAt(data.cues, first.end, data.leadTime)?.cue, first);

  assert.deepEqual(data.cues.slice(10, 16).map(cue => cue.text), [
    'Na Na Na Na Na', 'yeah (yeah) yeah (yeah)', 'Na Na Na Na Na',
    'yeah (yeah) yeah (yeah)', 'Na Na Na Na Na', 'Na Na Na Na Na'
  ]);
  assert.deepEqual(data.cues.slice(-6).map(cue => cue.text), [
    'MEOW MEOW MEOW', 'PURR PURR PURR', 'ki-ki-ki-ki kitty hey!',
    'MEOW MEOW MEOW', 'PURR PURR PURR', 'ki-ki-ki-ki kitty hey!'
  ]);
  assert.ok(data.cues.every((cue, index) => index === 0 || cue.start >= data.cues[index - 1].end));
});

test('simultaneous audience words do not add to or replace CLAP scoring', () => {
  const data = JSON.parse(readFileSync(new URL('../data/cat-walk-life-lyrics.json', import.meta.url)));
  const chart = JSON.parse(readFileSync(new URL('../data/cat-walk-life-full.json', import.meta.url)));
  const session = new Session(chart);
  const clap = chart.notes.find(note => note.action === 'CLAP' && note.time > 208);
  const display = lyricAt(data.cues, clap.time, data.leadTime);
  assert.equal(display.cue.text, 'MEOW MEOW MEOW');
  assert.equal(display.phase, 'active');
  assert.equal(session.input(clap.time, 'tap').grade, 'PERFECT');
  assert.equal(session.results.filter(grade => grade === 'PERFECT').length, 1);
  assert.equal(chart.notes.filter(note => note.time === clap.time).length, 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Session, validateChart } from '../engine.js';
const chart = JSON.parse(readFileSync(new URL('../data/demo.json', import.meta.url)));
test('perfect/good windows are inclusive and early taps do not consume a note', () => {
  const session = new Session(chart);
  assert.equal(session.input(1.7,'tap'),null);
  assert.equal(session.input(1.88,'tap').grade,'PERFECT');
  assert.equal(session.input(4.22,'tap').grade,'GOOD');
  assert.equal(session.input(4.23,'tap'),null);
  assert.equal(session.results.filter(Boolean).length,2);
});
test('late and wrong direction inputs miss; vertical/other gestures cannot score', () => {
  const session = new Session(chart);
  session.advance(8.5);
  assert.equal(session.input(10,'right').grade,'MISS');
  assert.equal(session.input(12,'right').grade,'PERFECT');
  assert.equal(session.input(14,'tap').grade,'MISS');
  assert.equal(session.input(16,'vertical').grade,'MISS');
});
test('every action including CALL and JUMP can be completed without microphone', () => {
  const session = new Session(chart);
  for(const note of chart.notes) session.input(note.time,note.direction || 'tap');
  assert.deepEqual(session.summary(),{PERFECT:19,GOOD:0,MISS:0,readiness:100,maxCombo:19});
});
test('all missed scores zero; good scores 70; new session resets', () => {
  const missed = new Session(chart); missed.advance(40);
  assert.equal(missed.summary().readiness,0); assert.equal(missed.summary().MISS,19);
  const good = new Session(chart); for(const note of chart.notes) good.input(note.time+.2,note.direction || 'tap');
  assert.equal(good.summary().readiness,70);
  assert.equal(new Session(chart).results.filter(Boolean).length,0);
});
test('dense rhythms choose the nearest compatible note inside overlapping windows', () => {
  const dense = {...chart, notes:[
    {time:2,action:'CLAP'},
    {time:2.18,action:'CLAP'},
    {time:2.36,action:'WIPER',direction:'left'},
    {time:2.54,action:'WIPER',direction:'right'}
  ]};
  const session = new Session(dense);
  assert.equal(session.input(2.17,'tap').index,1);
  assert.equal(session.input(2.01,'tap').index,0);
  assert.equal(session.input(2.53,'right').index,3);
  assert.equal(session.input(2.37,'left').index,2);
  assert.equal(session.summary().readiness,100);
});
test('bad charts fail before play: empty, unordered, duplicate, invalid action, and duration', () => {
  for (const patch of [{notes:[]},{notes:[{time:2,action:'FLY'}]},{notes:[{time:2,action:'WIPER'}]},{notes:[{time:2,action:'CLAP'},{time:2,action:'CALL'}]},{notes:[{time:2.1,action:'CLAP'},{time:2,action:'CALL'}]},{duration:38},{leadTime:0},{audio:{src:'test.mp3'}}]) assert.throws(() => validateChart({...chart,...patch}));
});

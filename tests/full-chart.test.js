import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Session,validateChart} from '../engine.js';
const chart=JSON.parse(await readFile(new URL('../data/cat-walk-life-full.json',import.meta.url),'utf8'));
test('full song chart has playable spacing and stays within supplied audio',()=>{
  validateChart(chart);
  assert.ok(chart.duration>224 && chart.duration<=224.3918);
  assert.equal(chart.audio.offset,0);
  assert.equal(chart.source.timingStatus,'provisional');
  assert.equal(chart.guideVideo.syncStatus,'unverified');
  assert.equal(chart.guideVideo.audioToVideoOffset,null);
  assert.ok(chart.notes.at(-1).time>220);
  assert.ok(!chart.notes.some(n=>n.action==='JUMP'));
});
test('full song can score perfectly and ends with every note accounted for',()=>{
  const session=new Session(chart);
  for(const note of chart.notes) assert.equal(session.input(note.time,note.direction||'tap').grade,'PERFECT');
  session.advance(chart.duration);
  assert.equal(session.summary().readiness,100);
  assert.equal(session.summary().PERFECT,chart.notes.length);
});
test('free groove does not create penalties, unattended full song counts every miss',()=>{
  const session=new Session(chart);
  assert.equal(session.input(0,'tap'),null);
  assert.equal(session.results.filter(Boolean).length,0);
  session.advance(chart.duration);
  assert.equal(session.summary().MISS,chart.notes.length);
});

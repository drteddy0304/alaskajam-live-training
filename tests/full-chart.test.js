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
  assert.equal(chart.guideVideo.syncStatus,'verified');
  assert.equal(chart.guideVideo.audioToVideoOffset,8.2508);
  assert.ok(chart.notes.at(-1).time>220);
  assert.ok(!chart.notes.some(n=>n.action==='JUMP'));
});
test('rebuilt chart preserves verified calls and uses quarter-note wipers',()=>{
  assert.deepEqual(chart.notes.filter(note=>note.time===27.7792),[{time:27.7792,action:'CALL',hint:'AJ！タップ＋声を出そう'}]);
  const calls=chart.notes.filter(note=>note.time===104.9792);
  assert.deepEqual(calls,[{
    time:104.9792,
    action:'CALL',
    hint:'1・2・3！「1」でタップ＋声を出そう'
  }]);
  assert.equal(chart.id,'cat-walk-life-guide-beta-v5-clap-quarter-wiper');
  assert.equal(chart.source.revision,'2026-10-02-beta5-clap-quarter-wiper');
  assert.equal(chart.source.timingStatus,'provisional');
  assert.equal(chart.notes.length,144);
  assert.deepEqual(chart.notes.filter(note=>note.action==='CLAP').slice(0,3).map(note=>note.time),[1.195,2.18,3.135]);
  const firstWipers=chart.notes.filter(note=>note.action==='WIPER').slice(0,3);
  assert.deepEqual(firstWipers.map(note=>note.direction),['left','right','left']);
  assert.ok(Math.abs(firstWipers[1].time-firstWipers[0].time-60/123)<.0001);
  assert.ok(chart.notes.every((note,index)=>index===0 || note.time>chart.notes[index-1].time));
  validateChart(chart);

  const session=new Session(chart);
  assert.equal(session.input(104.9792,'tap').grade,'PERFECT');
  assert.equal(session.summary().PERFECT,1);
  assert.equal(session.summary().MISS,chart.notes.length-1);
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

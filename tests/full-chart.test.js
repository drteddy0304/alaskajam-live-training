import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Session,validateChart} from '../engine.js';
const chart=JSON.parse(await readFile(new URL('../data/cat-walk-life-full.json',import.meta.url),'utf8'));
test('full song chart has playable spacing and stays within supplied audio',()=>{
  validateChart(chart);
  assert.ok(chart.duration>224 && chart.duration<=224.3918);
  assert.equal(chart.audio.offset,0);
  assert.equal(chart.source.timingStatus,'user-recorded');
  assert.equal(chart.guideVideo.syncStatus,'verified');
  assert.equal(chart.guideVideo.audioToVideoOffset,8.2508);
  assert.ok(chart.notes.at(-1).time>220);
  assert.ok(!chart.notes.some(n=>n.action==='JUMP'));
});
test('keyboard take supplies every scored CLAP and WIPER while preserving tap CALLs',()=>{
  assert.deepEqual(chart.notes.filter(note=>note.action==='CALL').map(note=>note.time),[
    27.973,50.923,101.923,104.785,105.036,105.322,
    178.069,178.476,178.721,179.005,179.466,182.351,183.369,
    185.755,186.281,186.565,186.808,187.256,190.179,191.156,
    193.602,194.088,194.333,194.581,195.029,201.421,201.87,
    202.159,202.404,202.852
  ]);
  assert.ok(chart.notes.filter(note=>note.action==='CALL').every(note=>note.hint?.includes('声を出そう')));
  assert.deepEqual(chart.notes.filter(note=>note.time===27.973),[{time:27.973,action:'CALL',hint:'AJ！タップ＋声を出そう'}]);
  assert.deepEqual(chart.notes.filter(note=>note.action==='CALL' && note.time>=104 && note.time<106).map(note=>note.time),[104.785,105.036,105.322]);
  assert.equal(chart.id,'cat-walk-life-user-timing-v4-keyboard');
  assert.equal(chart.source.revision,'2026-11-03-user-recorded-keyboard-v4');
  assert.equal(chart.source.timingStatus,'user-recorded');
  assert.equal(chart.notes.length,228);
  assert.deepEqual(chart.notes.filter(note=>note.action==='CLAP').slice(0,3).map(note=>note.time),[0.802,0.964,1.456]);
  const firstWipers=chart.notes.filter(note=>note.action==='WIPER').slice(0,3);
  assert.deepEqual(firstWipers.map(note=>note.direction),['left','right','left']);
  assert.deepEqual(firstWipers.map(note=>note.time),[76.51,76.995,77.523]);
  assert.deepEqual(chart.notes.reduce((counts,note)=>({...counts,[note.action]:(counts[note.action]||0)+1}),{}),{CLAP:102,CALL:30,WIPER:96});
  assert.deepEqual(chart.notes.filter(note=>note.action==='WIPER').slice(-3).map(note=>note.time),[174.562,175.089,175.613]);
  assert.ok(!chart.notes.some(note=>note.action==='WIPER' && note.time>=178.069));
  assert.deepEqual(chart.notes.filter(note=>note.action==='CALL' && note.time>=178 && note.time<180).map(note=>note.time),[178.069,178.476,178.721,179.005,179.466]);
  assert.ok(chart.notes.every((note,index)=>index===0 || note.time>chart.notes[index-1].time));
  validateChart(chart);

  const session=new Session(chart);
  assert.equal(session.input(104.785,'tap').grade,'PERFECT');
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

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Session,validateChart} from '../engine.js';
import {validateLyrics} from '../lyrics.js';

const chart=JSON.parse(await readFile(new URL('../data/snack-snack-full.json',import.meta.url),'utf8'));
const lyrics=JSON.parse(await readFile(new URL('../data/snack-snack-lyrics.json',import.meta.url),'utf8'));

test('SNACK SNACK recording becomes a valid full-song chart',()=>{
  validateChart(chart);
  assert.equal(chart.duration,168.54);
  assert.equal(chart.audio.src,'./assets/audio/snack-snack.mp3');
  assert.equal(chart.guideVideo.videoId,'Y04dtYKy-rk');
  assert.equal(chart.guideVideo.syncStatus,'verified');
  assert.equal(chart.guideVideo.audioToVideoOffset,2.303);
  assert.equal(chart.notes.length,77);
  assert.deepEqual(chart.notes.reduce((counts,note)=>({...counts,[note.action]:(counts[note.action]||0)+1}),{}),{CLAP:22,CALL:45,WIPER:10});
  assert.deepEqual(chart.notes.filter(note=>note.action==='WIPER').map(note=>note.direction),['left','right','left','left','right','left','left','right','left','right']);
  assert.ok(chart.notes.every((note,index)=>index===0||note.time>chart.notes[index-1].time));
});

test('official guide lyrics cover scored and voice-only CALLs without changing scoring',()=>{
  validateLyrics(lyrics,chart.duration);
  assert.equal(lyrics.timingStatus,'official-guide-text-verified');
  const scoredCues=lyrics.cues.filter(cue=>cue.kind==='scored-call');
  const voiceCues=lyrics.cues.filter(cue=>cue.kind==='voice-only');
  assert.equal(scoredCues.length,15);
  assert.deepEqual(scoredCues.flatMap(cue=>cue.markers),chart.notes.filter(note=>note.action==='CALL').map(note=>note.time));
  assert.deepEqual(voiceCues.map(cue=>cue.start),[40.98,44.23,47.578,82.614,85.869,89.243,127.553,130.882,134.215,137.52]);
  assert.deepEqual(voiceCues.map(cue=>cue.text),[
    'I I I I need a snack (Hey!)','な な な 何かない？ (Ho!)','お菓子な話 (Hey!)',
    'I I I I need a snack (Hey!)','な な な 何かない？ (Ho!)','別腹ギャラクシー (Hey!)',
    'I I I I need a snack (Hey!)','な な な 何かない？ (Ho!)','お菓子な話 (Hey!)','もっと聞かせて all night (Ho!)'
  ]);
  assert.equal(chart.notes.some(note=>note.action==='VOICE_CALL'),false);
});

test('SNACK SNACK full chart can score perfectly',()=>{
  const session=new Session(chart);
  for(const note of chart.notes) assert.equal(session.input(note.time,note.direction||'tap').grade,'PERFECT');
  session.advance(chart.duration);
  assert.equal(session.summary().PERFECT,77);
  assert.equal(session.summary().readiness,100);
});

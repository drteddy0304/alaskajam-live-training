import test from 'node:test';
import assert from 'node:assert/strict';
import { LANE, lanePosition, noteStyle, visibleLaneNotes } from '../lane.js';

test('notes travel right to left and meet the fixed judgement position at note time', () => {
  assert.equal(lanePosition(14, 10), LANE.entryPercent);
  assert.equal(lanePosition(14, 12), 59);
  assert.equal(lanePosition(14, 14), LANE.targetPercent);
  assert.ok(lanePosition(14, 14.2) < LANE.targetPercent);
});

test('lane visibility includes the approach and brief judged tail only', () => {
  const notes = [{time: 10, action: 'CLAP'}, {time: 14.01, action: 'CALL'}, {time: 9.54, action: 'JUMP'}];
  assert.deepEqual(visibleLaneNotes(notes, 10).map(item => item.index), [0]);
});

test('every action has distinct text and shape semantics while retaining gestures', () => {
  assert.deepEqual(noteStyle({action:'CLAP'}), {symbol:'✳',label:'CLAP',gesture:'tap'});
  assert.deepEqual(noteStyle({action:'CALL'}), {symbol:'〰',label:'CALL',gesture:'tap'});
  assert.deepEqual(noteStyle({action:'JUMP'}), {symbol:'↑',label:'JUMP',gesture:'tap'});
  assert.deepEqual(noteStyle({action:'WIPER',direction:'left'}), {symbol:'←',label:'WIPER',gesture:'left'});
  assert.deepEqual(noteStyle({action:'WIPER',direction:'right'}), {symbol:'→',label:'WIPER',gesture:'right'});
});

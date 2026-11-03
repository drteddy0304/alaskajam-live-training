import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const songs=JSON.parse(await readFile(new URL('data/songs.json',root),'utf8'));
const html=await readFile(new URL('index.html',root),'utf8');

test('QUATTRO training setlist contains only CAT WALK LIFE and SNACK SNACK',()=>{
  assert.deepEqual(songs.map(song=>song.title),['CAT WALK LIFE','SNACK SNACK']);
  assert.equal(songs[0].status,'ready');
  assert.equal(songs[1].status,'coming');
});

test('home copy leads with QUATTRO participation training',()=>{
  assert.match(html,/渋谷QUATTRO/);
  assert.match(html,/参戦予習。/);
  assert.match(html,/02 TRACKS/);
  assert.doesNotMatch(html,/その手で/);
  assert.doesNotMatch(html,/フロアを(?:<[^>]+>)*沸かせ/);
});

test('play screen uses dedicated left and right WIPER buttons instead of swipe instructions',()=>{
  assert.match(html,/id="wiper-left"/);
  assert.match(html,/id="wiper-right"/);
  assert.match(html,/WIPER専用ボタン/);
  assert.doesNotMatch(html,/左右にスワイプ/);
});

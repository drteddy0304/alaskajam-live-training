import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const songs=JSON.parse(await readFile(new URL('data/songs.json',root),'utf8'));
const html=await readFile(new URL('index.html',root),'utf8');
const css=await readFile(new URL('style.css',root),'utf8');

test('QUATTRO training setlist contains only CAT WALK LIFE and SNACK SNACK',()=>{
  assert.deepEqual(songs.map(song=>song.title),['CAT WALK LIFE','SNACK SNACK']);
  assert.equal(songs[0].status,'ready');
  assert.equal(songs[1].status,'coming');
});

test('home copy uses the approved AJ LIVE TRAINING hierarchy',()=>{
  assert.match(html,/AJ LIVE<br><span class="highlight">TRAINING<\/span>/);
  assert.match(html,/ライブ参戦前に、遊びながら練習しよう！/);
  assert.match(html,/QUATTRO<br><i>READY\?<\/i>/);
  assert.doesNotMatch(html,/渋谷QUATTRO<br><span class="highlight">参戦予習。<\/span>/);
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

test('smartphone play view keeps all controls inside the dynamic viewport',()=>{
  assert.match(css,/body\[data-page=play\]\{height:100dvh;overflow:hidden\}/);
  assert.match(css,/\.wiper-controls button\{min-height:clamp\(46px,8dvh,56px\)/);
  assert.match(html,/style\.css\?v=record3/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const songs=JSON.parse(await readFile(new URL('data/songs.json',root),'utf8'));
const html=await readFile(new URL('index.html',root),'utf8');
const app=await readFile(new URL('app.js',root),'utf8');
const css=await readFile(new URL('style.css',root),'utf8');
const recorderHtml=await readFile(new URL('recorder.html',root),'utf8');
const recorderApp=await readFile(new URL('recorder-app.js',root),'utf8');

test('QUATTRO training setlist contains only CATWALK LIFE and SNACK SNACK',()=>{
  assert.deepEqual(songs.map(song=>song.title),['CATWALK LIFE','SNACK SNACK']);
  assert.equal(songs[0].status,'ready');
  assert.equal(songs[1].status,'ready');
  assert.equal(songs[1].chart,'./data/snack-snack-full.json');
  assert.equal(songs[1].recorder,'./recorder.html?song=snack-snack');
});

test('home copy uses the approved AJ LIVE TRAINING hierarchy',()=>{
  assert.match(html,/AJ LIVE<br><span class="highlight">TRAINING<\/span>/);
  assert.match(html,/ライブ参戦前に、遊びながら練習しよう！/);
  assert.match(html,/QUATTRO<br><i>READY\?<\/i>/);
  assert.doesNotMatch(html,/渋谷QUATTRO<br><span class="highlight">参戦予習。<\/span>/);
  assert.match(html,/02 TRACKS/);
  assert.match(html,/id="setlist"/);
  assert.match(html,/2曲から選択/);
  assert.match(app,/セットリストから曲を選ぶ ↓/);
  assert.match(app,/\$\('setlist'\)\.scrollIntoView/);
  assert.doesNotMatch(`${html}\n${app}`,/CATWALK LIFEで参戦予習/);
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

test('recorder separates scored tap CALL from voice-only CALL',()=>{
  assert.match(recorderHtml,/data-record-now="CALL"[^>]*>[\s\S]*?タップCALL/);
  assert.match(recorderHtml,/data-record-now="VOICE_CALL"[^>]*>[\s\S]*?声だけCALL/);
  assert.match(recorderHtml,/採点タップなし/);
});

test('recorder holds prepared audio until the countdown finishes',()=>{
  assert.doesNotMatch(recorderApp,/music\.prime\([^\n]+\.then\(\(\) => music\.resume\(\)\)/);
  assert.match(recorderApp,/onReady: async \(\) => \{[\s\S]*?await music\.release\(PRE_ROLL_SECONDS \+ WINDOW\.start\)/);
  assert.match(recorderHtml,/recorder-app\.js\?v=segment1/);
});

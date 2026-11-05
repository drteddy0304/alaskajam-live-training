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
  assert.equal(songs[1].chart,'./data/snack-snack-full.json?v=wiper1');
  assert.equal(songs[1].recorder,'./recorder.html?song=snack-snack');
  assert.match(app,/songs\.json\?v=wiper1/);
  assert.match(html,/app\.js\?v=stability9/);
  assert.match(app,/audio\.js\?v=countdown4/);
});

test('home copy uses the approved AJ LIVE TRAINING hierarchy',()=>{
  assert.match(html,/AJ LIVE<br><span class="highlight">TRAINING<\/span>/);
  assert.match(html,/ライブ参戦前に、遊びながら練習しよう！/);
  assert.match(html,/QUATTRO<br><i>READY\?<\/i>/);
  assert.doesNotMatch(html,/渋谷QUATTRO<br><span class="highlight">参戦予習。<\/span>/);
  assert.match(html,/02 TRACKS/);
  assert.match(html,/id="setlist"/);
  assert.match(html,/2曲から選択/);
  assert.match(html,/参戦予習は皆にも沢山参加して欲しいこの2曲。/);
  assert.doesNotMatch(html,/参戦予習はこの2曲。/);
  assert.match(app,/セットリストから曲を選ぶ ↓/);
  assert.match(app,/\$\('setlist'\)\.scrollIntoView/);
  assert.doesNotMatch(`${html}\n${app}`,/CATWALK LIFEで参戦予習/);
  assert.doesNotMatch(html,/その手で/);
  assert.doesNotMatch(html,/フロアを(?:<[^>]+>)*沸かせ/);
});

test('HOW TO TRAIN matches the published charts and separates voice-only calls',()=>{
  assert.match(html,/3 ACTIONS \+ VOICE/);
  assert.match(html,/合図に合わせて中央をタップ/);
  assert.match(html,/矢印と同じ方向のボタンを押す/);
  assert.match(html,/CALL表示に合わせてタップ＋声を出そう/);
  assert.match(html,/SING ALONG/);
  assert.match(html,/歌詞だけの表示は声を出すだけ。タップ不要/);
  assert.match(html,/声は出さなくても採点に影響しません。マイクは使いません。/);
  assert.match(html,/aria-label="CLAP、CALL用アクションパッド"/);
  assert.doesNotMatch(html,/>JUMP</);
  assert.doesNotMatch(html,/4 ACTIONS/);
});

test('result screen uses the approved readiness messages at all three score tiers',()=>{
  assert.match(app,/result\.readiness >= 85 \? 'QUATTRO参戦準備バッチリ！マイメン待ってるよ！'/);
  assert.match(app,/result\.readiness >= 50 \? 'あと少し！もうちょっと練習したらライブがもっと楽しいよ♪'/);
  assert.match(app,/'わかるよ\.\.\.AJの曲やる事多いよね\(笑\)　でも一緒に出来たらライブがもっと楽しくなる！力を貸してー！'/);
  assert.match(app,/`最大 \$\{result\.maxCombo\} COMBO。`/);
  assert.doesNotMatch(app,/QUATTRO参戦準備、できています！|あと少し。もう一度確認しよう。|ここから参戦予習を始めよう。/);
});

test('recorder stays implemented but its customer-facing home link is hidden',()=>{
  assert.match(html,/<a class="record-link" href="\.\/recorder\.html" hidden>/);
  assert.match(recorderHtml,/id="record-start"/);
  assert.match(recorderApp,/const startButton = \$\('#record-start'\)/);
  assert.match(recorderApp,/music = new Music\(\)/);
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
  assert.match(html,/style\.css\?v=ticket1/);
});

test('official QUATTRO ticket links appear on home and result screens',()=>{
  const eplus='https://eplus.jp/sf/detail/3909740001-P0030020\\?P6=001&amp;P1=0402&amp;P59=1';
  assert.equal((html.match(new RegExp(eplus,'g'))||[]).length,2);
  assert.equal((html.match(/https:\/\/l-tike\.com\/alaskajam\//g)||[]).length,2);
  assert.equal((html.match(/>イープラス /g)||[]).length,2);
  assert.equal((html.match(/>ローソンチケット /g)||[]).length,2);
  assert.match(html,/QUATTRO参戦準備、完了。/);
  assert.doesNotMatch(html,/公演・チケット情報のリンクは準備中/);
});

test('both songs confirm start before countdown and blocked mobile playback can ask again',()=>{
  assert.match(html,/id="countdown-start"[^>]*>動画と曲を開始</);
  assert.match(app,/end\.addEventListener\('click', \(\) => requestStart\(song\)\)/);
  assert.match(app,/\$\('retry'\)\.addEventListener\('click', \(\) => requestStart\(\)\)/);
  assert.match(app,/ボタンを押すとカウントダウンが始まります/);
  assert.match(app,/requestStart[\s\S]*?askForStartTap\(\(\) => start\(\)/);
  assert.match(app,/guide\?\.requiresUserGesture\?\.\(\)/);
  assert.match(app,/askForStartTap\(beginPlayback\)/);
});

test('recorder separates scored tap CALL from voice-only CALL',()=>{
  assert.match(recorderHtml,/data-record-now="CALL"[^>]*>[\s\S]*?タップCALL/);
  assert.match(recorderHtml,/data-record-now="VOICE_CALL"[^>]*>[\s\S]*?声だけCALL/);
  assert.match(recorderHtml,/採点タップなし/);
});

test('recorder holds prepared audio until the countdown finishes',()=>{
  assert.doesNotMatch(recorderApp,/music\.prime\([^\n]+\.then\(\(\) => music\.resume\(\)\)/);
  assert.match(recorderApp,/onReady: async \(\) => \{[\s\S]*?await music\.release\(PRE_ROLL_SECONDS \+ WINDOW\.start\)/);
  assert.match(recorderHtml,/recorder-app\.js\?v=segment2/);
});

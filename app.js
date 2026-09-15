import { Session, validateChart, WINDOWS } from './engine.js';
import { Music } from './audio.js?v=mobile1';

const charts = new Map();
const $ = id => document.getElementById(id);
const formatTime = seconds => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2,'0')}`;
const hints = { CLAP:'合図に合わせてタップ！', WIPER:'矢印の向きにスワイプ！', CALL:'タップ！ 声も出してみよう（無言でもOK）', JUMP:'タップでジャンプ！（実際に跳ばなくてOK）' };
const symbols = { CLAP:'✳', WIPER:'↔', CALL:'〰', JUMP:'↑' };
let chart, session, audio = null, phase = 'home', startAt = 0, pausedAt = 0, frame = 0, feedbackUntil = 0, pointer = null, starting = false;
function show(name) {
  for (const page of ['home','play','result']) $(page).hidden = page !== name;
  window.scrollTo(0, 0);
}
function clock() {
  const wall = (performance.now() - startAt) / 1000;
  if (audio) return audio.time();
  return wall;
}
function flash(result) {
  if (!result) return;
  $('feedback').textContent = result.grade;
  $('feedback').dataset.grade = result.grade;
  feedbackUntil = performance.now() + 700;
  $('combo').textContent = `${session.combo} COMBO`;
}
function input(gesture) {
  if (phase !== 'playing' || clock() < 0) return;
  const result = session.input(clock(), gesture);
  if (result) flash(result);
  else { $('feedback').textContent = 'KEEP THE GROOVE'; $('feedback').dataset.grade = ''; feedbackUntil = performance.now() + 450; }
}
function draw() {
  if (phase !== 'playing') return;
  const t = clock();
  for (const missed of session.advance(t)) flash(missed);
  const progress = Math.max(0, Math.min(t, chart.duration));
  $('elapsed').textContent = formatTime(progress);
  $('progress').value = progress;
  if (t >= chart.duration) { finish(); return; }
  const index = chart.notes.findIndex((note,i) => !session.results[i]);
  const note = chart.notes[index];
  if (t < 0) {
    $('cue-label').textContent = 'READY?'; $('cue-action').textContent = Math.ceil(-t);
    $('cue-hint').textContent = 'スマホを持って、準備しよう'; $('cue-fill').style.transform = 'scaleX(0)';
  } else if (note && note.time - t <= chart.leadTime) {
    const delta = note.time - t;
    $('cue-label').textContent = delta <= WINDOWS.perfect ? 'NOW! 今！' : `あと ${Math.max(0, delta).toFixed(1)} 秒`;
    $('cue-action').textContent = note.action === 'WIPER' ? (note.direction === 'left' ? '← WIPER' : 'WIPER →') : note.action;
    $('cue-hint').textContent = note.hint || hints[note.action];
    $('cue-fill').style.transform = `scaleX(${Math.max(0, Math.min(1, 1 - delta / chart.leadTime))})`;
    document.querySelector('.pad-icon').textContent = symbols[note.action];
  } else {
    const section = chart.sections?.find(s => t >= s.start && t < s.end);
    $('cue-label').textContent = section?.label || 'KEEP THE GROOVE'; $('cue-action').textContent = 'GROOVE';
    $('cue-hint').textContent = '自由にノろう！ この間は採点なし'; $('cue-fill').style.transform = 'scaleX(0)';
  }
  const next = note && note.time - t <= chart.leadTime ? chart.notes[index+1] : note;
  $('next').textContent = `NEXT ${next ? next.action + (next.direction === 'left' ? ' ←' : next.direction === 'right' ? ' →' : '') : 'FINISH'}`;
  if (performance.now() > feedbackUntil) { $('feedback').textContent = 'FEEL THE GROOVE'; $('feedback').dataset.grade = ''; }
  frame = requestAnimationFrame(draw);
}
async function start(song = null) {
  if (!chart || starting) return;
  if (song?.chart) {
    const selected = charts.get(song.chart);
    if (!selected) return;
    chart = selected;
  }
  starting = true;
  $('guide-details').open = false;
  $('load-status').textContent = '音源を読み込み中…';
  $('try-demo').disabled = true; $('retry').disabled = true;
  let music;
  try { music = chart.audio ? new Music() : null; }
  catch { starting = false; $('try-demo').disabled = false; $('retry').disabled = false; $('load-status').textContent = 'このブラウザでは音楽を再生できません。SafariまたはChromeでお試しください。'; show('home'); return; }
  cancelAnimationFrame(frame);
  audio?.close(); audio = music;
  session = new Session(chart); pointer = null;
  if (audio) {
    try {
      await audio.load(chart.audio.src);
      if (document.hidden) throw new Error('画面を開いてもう一度お試しください');
      audio.start(3, chart.audio.offset, chart.duration);
    } catch {
      audio?.close(); audio = null; starting = false; phase = 'home';
      $('try-demo').disabled = false; $('retry').disabled = false;
      $('load-status').textContent = '音源を再生できませんでした。SafariまたはChromeで開き、もう一度開始してください。'; show('home'); return;
    }
  }
  $('load-status').textContent = ''; $('try-demo').disabled = false; $('retry').disabled = false;
  startAt = performance.now() + 3000;
  feedbackUntil = 0; phase = 'playing'; starting = false;
  $('pause-panel').hidden = true; $('pad').disabled = false; $('pause').disabled = false;
  $('play-title').textContent = chart.title; $('progress').max = chart.duration;
  $('play-edition').textContent = chart.kind === 'demo' ? (audio ? 'MUSIC ON / DEMO CHART' : 'SOUNDLESS DEMO') : 'LIVE TRAINING';
  $('chart-source').textContent = chart.kind === 'demo' ? '操作体験用ダミー譜面・実曲とは異なります' : 'Cheering Guide参考 / フル尺 / タイミングは調整中';
  $('duration').textContent = formatTime(chart.duration);
  $('combo').textContent = '0 COMBO';
  if (audio) audio.oninterrupt = () => { if (phase === 'playing') pause(); };
  show('play'); $('pause').focus({preventScroll:true}); draw();
}
function pause() {
  if (phase !== 'playing') return;
  pausedAt = performance.now(); phase = 'paused'; cancelAnimationFrame(frame); audio?.pause().catch(() => {}); pointer = null;
  $('pad').disabled = true; $('pause').disabled = true;
  $('pause-panel').hidden = false; document.querySelector('#pause-panel p').textContent = '続きから再開できます。'; $('resume').focus();
}
async function resume() {
  if (phase !== 'paused') return;
  if (audio) {
    try { await audio.resume(); if (document.hidden) { await audio.pause(); return; } } catch { document.querySelector('#pause-panel p').textContent = '音源を再生できません。曲一覧からもう一度お試しください。'; return; }
  }
  startAt += performance.now() - pausedAt;
  phase = 'playing'; $('pause-panel').hidden = true; $('pad').disabled = false; $('pause').disabled = false;
  $('pause').focus({preventScroll:true}); draw();
}
function finish() {
  phase = 'result'; audio?.close(); cancelAnimationFrame(frame);
  const result = session.summary();
  $('readiness').replaceChildren(document.createTextNode(result.readiness), Object.assign(document.createElement('span'), {textContent:'%'}));
  for (const grade of ['PERFECT','GOOD','MISS']) $(`${grade.toLowerCase()}-count`).textContent = result[grade];
  $('result-message').textContent = result.readiness >= 85 ? 'フロアを沸かす準備、できてる！' : result.readiness >= 50 ? 'いい感じ！ その調子でいこう。' : 'ここから始まる、ライブの予習。';
  $('result-detail').textContent = `最大 ${result.maxCombo} COMBO。${result.readiness >= 85 ? '次はライブ会場で、一緒に。' : 'バーが満ちる瞬間に合わせてみよう。'}`;
  let best = result.readiness, saved = false;
  try { const key = `aj-best:${chart.id}`; const previous = Number(localStorage.getItem(key)); best = Math.max(best, Number.isFinite(previous) && previous <= 100 ? previous : 0); localStorage.setItem(key, String(best)); saved = true; } catch {}
  $('best').textContent = saved ? `この端末のベスト準備度 ${best}%` : 'このブラウザでは記録を保存できません';
  show('result'); $('result-title').tabIndex = -1; $('result-title').focus({preventScroll:true});
}
function home() { cancelAnimationFrame(frame); audio?.close(); phase = 'home'; pointer = null; $('pause-panel').hidden = true; show('home'); $('try-demo').focus({preventScroll:true}); }
$('try-demo').addEventListener('click', start); $('retry').addEventListener('click', start);
$('pause').addEventListener('click', pause); $('resume').addEventListener('click', resume);
$('quit').addEventListener('click', home); $('back').addEventListener('click', home);
$('pad').addEventListener('pointerdown', e => { if (phase !== 'playing' || !e.isPrimary || e.button !== 0) return; pointer = {id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now()}; $('pad').setPointerCapture(e.pointerId); });
$('pad').addEventListener('pointerup', e => {
  if (!pointer || pointer.id !== e.pointerId) return;
  const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y, duration = performance.now() - pointer.t; pointer = null;
  if (Math.abs(dx) >= 36 && Math.abs(dx) > Math.abs(dy) * 1.3 && duration < 800) input(dx < 0 ? 'left' : 'right');
  else if (Math.hypot(dx,dy) < 20 && duration < 400) input('tap');
});
$('pad').addEventListener('pointercancel', () => { pointer = null; });
$('pad').addEventListener('lostpointercapture', () => { pointer = null; });
$('pad').addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
  if (phase !== 'playing' || e.repeat) return;
  if (e.code === 'Escape') { pause(); return; }
  const gesture = {Space:'tap',ArrowLeft:'left',ArrowRight:'right'}[e.code];
  if (gesture) { e.preventDefault(); input(gesture); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', pause);
async function json(path) {
  const url = new URL(path, document.baseURI);
  url.searchParams.set('v', 'mobile1');
  const response = await fetch(url, {cache:'no-store'});
  if (!response.ok) throw new Error('読み込み失敗');
  return response.json();
}
try {
  const songs = await json('./data/songs.json');
  for (const [index, song] of songs.entries()) {
    const row = document.createElement('div'); row.className = 'song';
    const number = document.createElement('span'); number.className = 'number'; number.textContent = String(index+1).padStart(2,'0');
    const name = document.createElement('span'); name.className = 'song-name'; name.textContent = song.title;
    const end = document.createElement(song.chart ? 'button' : 'span'); end.textContent = song.chart ? 'DEMO →' : '準備中';
    if (song.chart) { end.disabled = true; end.textContent = song.status === 'demo' ? 'DEMO →' : 'PLAY →'; end.setAttribute('aria-label', `${song.title} の練習を開始`); end.addEventListener('click', () => start(song)); }
    else end.className = 'coming';
    row.append(number,name,end); $('songs').append(row);
  }
  await Promise.all(songs.filter(song => song.chart).map(async song => charts.set(song.chart, validateChart(await json(song.chart)))));
  chart = charts.get(songs.find(song => song.chart).chart);
  $('try-demo').disabled = false; $('try-demo').textContent = 'フル尺で練習する →';
  document.querySelectorAll('.song button').forEach(button => button.disabled = false);
} catch (error) { $('try-demo').textContent = '読み込みできませんでした'; $('load-status').textContent = '接続を確認してページを再読み込みしてください。'; console.error(error); }

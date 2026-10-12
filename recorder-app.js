import {Music} from './audio.js?v=record2';
import {StartBarrier, countdownOverlayState, primeMedia, startMediaTogether} from './startup.js?v=record2';
import {buildRecording, noteFromGesture, recordingText, TAP_ACTIONS} from './recorder.js?v=record2';

const SONG = Object.freeze({
  id: 'cat-walk-life-timing-take',
  title: 'CAT WALK LIFE',
  duration: 224.39,
  audio: './assets/audio/cat-walk-life.mp3'
});
const DRAFT_KEY = 'aj-timing-recorder-draft-v1';
const $ = selector => document.querySelector(selector);
const intro = $('#recorder-intro');
const run = $('#recorder-run');
const result = $('#recorder-result');
const startButton = $('#record-start');
const pauseButton = $('#record-pause');
const pad = $('#record-pad');
const elapsed = $('#record-elapsed');
const progress = $('#record-progress');
const count = $('#record-note-count');
const last = $('#record-last');
const undo = $('#record-undo');
const finishButton = $('#record-finish');
const output = $('#record-output');
const copyStatus = $('#record-copy-status');
const savedStatus = $('#record-saved-status');
const countdown = $('#record-countdown');
const countdownLabel = $('#record-countdown-label');
const countdownValue = $('#record-countdown-value');

let music = null;
let barrier = null;
let phase = 'idle';
let notes = [];
let selectedAction = 'CLAP';
let pointer = null;
let animation = 0;
let recordedAt = '';

function formatTime(time, precise = false) {
  const minutes = Math.floor(time / 60);
  const seconds = time - minutes * 60;
  return precise ? `${minutes}:${seconds.toFixed(3).padStart(6, '0')}` : `${minutes}:${String(Math.floor(seconds)).padStart(2, '0')}`;
}

function setPage(next) {
  intro.hidden = next !== 'intro';
  run.hidden = next !== 'run';
  result.hidden = next !== 'result';
  window.scrollTo(0, 0);
}

function showCountdown(value = null, preparing = false) {
  const state = countdownOverlayState(value, preparing);
  countdown.hidden = state.hidden;
  countdown.classList.toggle('is-preparing', state.preparing);
  countdownLabel.textContent = state.label;
  countdownValue.textContent = state.value;
}

function setAction(action) {
  if (!TAP_ACTIONS.includes(action)) return;
  selectedAction = action;
  document.querySelectorAll('[data-record-action]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.recordAction === action));
  });
  const labels = {CLAP: ['✳', 'CLAPを記録'], CALL: ['〰', 'CALLを記録'], CLAP_CALL: ['✳＋〰', 'CLAP＋CALLを同時記録'], JUMP: ['↑', 'JUMPを記録']};
  $('#record-pad-icon').textContent = labels[action][0];
  $('#record-pad-label').textContent = labels[action][1];
}

function makeRecording() {
  return buildRecording(SONG, notes, recordedAt || new Date().toISOString());
}

function saveDraft() {
  try { localStorage.setItem(DRAFT_KEY, recordingText(makeRecording())); } catch {}
}

function updateCount() {
  count.textContent = `${notes.length}件`;
  undo.disabled = notes.length === 0;
}

function stopAnimation() {
  cancelAnimationFrame(animation);
  animation = 0;
}

function draw() {
  if (phase !== 'playing' || !music) return;
  const time = Math.min(music.time(), SONG.duration);
  elapsed.textContent = formatTime(time, true);
  progress.value = time;
  if (time >= SONG.duration - .02) {
    finish();
    return;
  }
  animation = requestAnimationFrame(draw);
}

function recordGesture(gesture, time) {
  if (phase !== 'playing') return;
  const note = noteFromGesture(time, gesture, selectedAction);
  notes.push(note);
  saveDraft();
  updateCount();
  const direction = note.direction ? ` ${note.direction === 'left' ? '←' : '→'}` : '';
  const action = note.simultaneous?.includes('CLAP') ? 'CLAP＋CALL' : note.action;
  last.textContent = `${formatTime(note.time, true)}　${action}${direction}`;
  try { navigator.vibrate?.(12); } catch {}
}

async function start() {
  if (phase !== 'idle') return;
  phase = 'countdown';
  notes = [];
  recordedAt = new Date().toISOString();
  updateCount();
  setPage('run');
  startButton.disabled = true;
  pauseButton.disabled = true;
  last.textContent = '音源を準備しています';
  music = new Music();
  music.oninterrupt = () => { if (phase === 'playing') pause(); };
  barrier = new StartBarrier({
    onTick: value => showCountdown(value),
    onPreparing: () => showCountdown('音源を準備中…', true),
    onReady: () => {
      showCountdown();
      phase = 'playing';
      pauseButton.disabled = false;
      last.textContent = '曲に合わせて操作してください';
      startMediaTogether(music, null, 0).catch(showStartError);
      draw();
    },
    onError: showStartError
  });
  barrier.start(primeMedia(music, null, {src: SONG.audio, offset: 0, duration: SONG.duration}));
}

function showStartError(error) {
  barrier?.cancel();
  music?.close();
  music = null;
  stopAnimation();
  showCountdown();
  phase = 'idle';
  setPage('intro');
  startButton.disabled = false;
  savedStatus.textContent = `再生できませんでした。もう一度お試しください。${error?.message ? `（${error.message}）` : ''}`;
}

function pause() {
  if (phase !== 'playing') return;
  phase = 'paused';
  music?.pause();
  stopAnimation();
  pauseButton.textContent = '▶ 再開';
  pad.disabled = true;
  last.textContent = '一時停止中です';
}

async function resume() {
  if (phase !== 'paused') return;
  try {
    await music.resume();
    phase = 'playing';
    pauseButton.textContent = '⏸ 一時停止';
    pad.disabled = false;
    last.textContent = '記録を再開しました';
    draw();
  } catch (error) { showStartError(error); }
}

function finish() {
  if (!['playing', 'paused'].includes(phase)) return;
  phase = 'result';
  music?.pause();
  stopAnimation();
  const recording = makeRecording();
  saveDraft();
  output.value = recordingText(recording);
  $('#record-result-summary').textContent = `${notes.length}件の操作を記録しました。コピーして、このチャットへ貼ってください。`;
  copyStatus.textContent = 'コピー後、このチャットへそのまま貼ってください。';
  setPage('result');
}

async function copyRecording() {
  let copied = false;
  try {
    await navigator.clipboard.writeText(output.value);
    copied = true;
  } catch {
    output.focus();
    output.select();
    copied = document.execCommand('copy');
  }
  copyStatus.textContent = copied ? 'コピーしました。このチャットの入力欄に貼り付けて送ってください。' : '自動コピーできませんでした。枠内を長押しして「コピー」を選んでください。';
}

function reset() {
  barrier?.cancel();
  music?.close();
  music = null;
  stopAnimation();
  phase = 'idle';
  notes = [];
  progress.value = 0;
  elapsed.textContent = '0:00.000';
  pauseButton.textContent = '⏸ 一時停止';
  pauseButton.disabled = false;
  pad.disabled = false;
  startButton.disabled = false;
  savedStatus.textContent = '前の記録はこの端末に残っています。開始すると新しい記録になります。';
  setPage('intro');
}

document.querySelectorAll('[data-record-action]').forEach(button => button.addEventListener('click', () => setAction(button.dataset.recordAction)));
startButton.addEventListener('click', start);
pauseButton.addEventListener('click', () => phase === 'paused' ? resume() : pause());
undo.addEventListener('click', () => {
  const removed = notes.pop();
  if (!removed) return;
  saveDraft();
  updateCount();
  last.textContent = `${formatTime(removed.time, true)} の ${removed.action} を取り消しました`;
});
finishButton.addEventListener('click', finish);
$('#record-copy').addEventListener('click', copyRecording);
$('#record-again').addEventListener('click', reset);

pad.addEventListener('pointerdown', event => {
  if (phase !== 'playing') return;
  event.preventDefault();
  pad.setPointerCapture(event.pointerId);
  pointer = {id: event.pointerId, x: event.clientX, y: event.clientY, started: performance.now(), time: music.time()};
});
pad.addEventListener('pointerup', event => {
  if (!pointer || pointer.id !== event.pointerId || phase !== 'playing') return;
  event.preventDefault();
  const dx = event.clientX - pointer.x;
  const dy = event.clientY - pointer.y;
  const held = performance.now() - pointer.started;
  const gesture = Math.abs(dx) >= 36 && Math.abs(dx) > Math.abs(dy) * 1.3 && held < 800 ? (dx < 0 ? 'left' : 'right') : Math.hypot(dx, dy) < 20 && held < 400 ? 'tap' : null;
  const time = pointer.time;
  pointer = null;
  if (gesture) recordGesture(gesture, time);
  else last.textContent = '操作を記録できませんでした。短くタップするか、横へ大きくスワイプしてください。';
});
pad.addEventListener('pointercancel', () => { pointer = null; });
document.addEventListener('visibilitychange', () => { if (document.hidden && phase === 'playing') pause(); });
window.addEventListener('pagehide', () => music?.close());

try {
  const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
  if (draft?.notes?.length) savedStatus.textContent = `この端末に前回の記録 ${draft.notes.length}件があります。新しく開始すると上書きします。`;
} catch {}
setAction('CLAP');

import {Music} from './audio.js?v=record2';
import {StartBarrier, countdownOverlayState} from './startup.js?v=record2';
import {buildRecording, noteFromGesture, recordingText, rewindTake, songTime, TAP_ACTIONS} from './recorder.js?v=record7';

const PRE_ROLL_SECONDS = 5;
const SONG = Object.freeze({
  id: 'cat-walk-life-timing-take',
  title: 'CAT WALK LIFE',
  duration: 224.39,
  audio: './assets/audio/cat-walk-life-recorder.mp3'
});
const PLAYBACK_DURATION = SONG.duration + PRE_ROLL_SECONDS;
const DRAFT_KEY = 'aj-timing-recorder-draft-v1';
const $ = selector => document.querySelector(selector);
const intro = $('#recorder-intro');
const run = $('#recorder-run');
const result = $('#recorder-result');
const startButton = $('#record-start');
const pauseButton = $('#record-pause');
const elapsed = $('#record-elapsed');
const progress = $('#record-progress');
const count = $('#record-note-count');
const last = $('#record-last');
const undo = $('#record-undo');
const rewindButton = $('#record-rewind');
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

function currentSongTime() {
  return music ? songTime(music.time(), PRE_ROLL_SECONDS) : 0;
}

function draw() {
  if (phase !== 'playing' || !music) return;
  const time = Math.min(currentSongTime(), SONG.duration);
  elapsed.textContent = formatTime(time, true);
  progress.value = time;
  if (time >= SONG.duration - .02) {
    finish();
    return;
  }
  animation = requestAnimationFrame(draw);
}

function recordGesture(gesture, time, tapAction = 'CLAP') {
  if (phase !== 'playing') return;
  const note = noteFromGesture(time, gesture, tapAction);
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
  last.textContent = 'カウント後、必要なボタンを直接押してください';
  music = new Music();
  music.oninterrupt = () => { if (phase === 'playing') pause(); };
  barrier = new StartBarrier({
    onTick: value => showCountdown(value),
    onPreparing: () => showCountdown('音源を準備中…', true),
    onReady: () => {
      music.media.currentTime = PRE_ROLL_SECONDS;
      showCountdown();
      phase = 'playing';
      pauseButton.disabled = false;
      last.textContent = 'CLAP / CALL / 同時 / JUMPを直接押してください';
      draw();
    },
    onError: showStartError
  });
  const preparation = music.prime(SONG.audio, 0, PLAYBACK_DURATION).then(() => music.resume());
  barrier.start(preparation);
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
  last.textContent = '一時停止中です';
}

function rewind() {
  if (!['playing', 'paused'].includes(phase) || !music) return;
  if (phase === 'playing') pause();
  const rewound = rewindTake(currentSongTime(), 5, notes);
  notes = rewound.notes;
  music.media.currentTime = PRE_ROLL_SECONDS + rewound.time;
  elapsed.textContent = formatTime(rewound.time, true);
  progress.value = rewound.time;
  saveDraft();
  updateCount();
  last.textContent = `${formatTime(rewound.time, true)}へ戻しました。この地点以降の記録を消しました。準備できたら再開してください。`;
}

async function resume() {
  if (phase !== 'paused') return;
  try {
    await music.resume();
    phase = 'playing';
    pauseButton.textContent = '⏸ 一時停止';
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
  startButton.disabled = false;
  savedStatus.textContent = '前の記録はこの端末に残っています。開始すると新しい記録になります。';
  setPage('intro');
}

document.querySelectorAll('[data-record-now]').forEach(button => button.addEventListener('pointerdown', event => {
  if (phase !== 'playing' || !music || !TAP_ACTIONS.includes(button.dataset.recordNow)) return;
  event.preventDefault();
  recordGesture('tap', currentSongTime(), button.dataset.recordNow);
}));
document.querySelectorAll('[data-record-wiper]').forEach(button => button.addEventListener('pointerdown', event => {
  if (phase !== 'playing' || !music || !['left', 'right'].includes(button.dataset.recordWiper)) return;
  event.preventDefault();
  recordGesture(button.dataset.recordWiper, currentSongTime());
}));
startButton.addEventListener('click', start);
pauseButton.addEventListener('click', () => phase === 'paused' ? resume() : pause());
undo.addEventListener('click', () => {
  const removed = notes.pop();
  if (!removed) return;
  saveDraft();
  updateCount();
  const action = removed.simultaneous?.includes('CLAP') ? 'CLAP＋CALL' : removed.action;
  last.textContent = `${formatTime(removed.time, true)} の ${action} を取り消しました`;
});
rewindButton.addEventListener('click', rewind);
finishButton.addEventListener('click', finish);
$('#record-copy').addEventListener('click', copyRecording);
$('#record-again').addEventListener('click', reset);

document.addEventListener('visibilitychange', () => { if (document.hidden && phase === 'playing') pause(); });
window.addEventListener('pagehide', () => music?.close());

try {
  const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
  if (draft?.notes?.length) savedStatus.textContent = `この端末に前回の記録 ${draft.notes.length}件があります。新しく開始すると上書きします。`;
} catch {}

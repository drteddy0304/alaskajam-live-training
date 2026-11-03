import {Music} from './audio.js?v=countdown3';
import {StartBarrier, countdownOverlayState} from './startup.js?v=countdown3';
import {buildRecording, noteFromGesture, recorderShortcut, recordingSong, recordingText, recordingWindow, rewindTake, songTime, TAP_ACTIONS} from './recorder.js?v=record12';

const PARAMS = new URLSearchParams(location.search);
const SONG = recordingSong(PARAMS.get('song') || 'cat-walk-life');
let WINDOW;
try { WINDOW = recordingWindow(SONG, PARAMS.get('from'), PARAMS.get('to'), PARAMS.get('actions')); }
catch { WINDOW = recordingWindow(SONG); }
const IS_SEGMENT = WINDOW.start > 0 || WINDOW.end < SONG.duration || WINDOW.actions.length < TAP_ACTIONS.length + 1;
const PRE_ROLL_SECONDS = SONG.preRoll;
const PLAYBACK_DURATION = SONG.duration + PRE_ROLL_SECONDS;
const DRAFT_KEY = `aj-timing-recorder-draft-v1-${SONG.id}-${WINDOW.start}-${WINDOW.end}-${WINDOW.actions.join('-')}`;
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

document.title = `${SONG.title} タイミング記録 | Alaska Jam LIVE TRAINING`;
$('#record-song-label').textContent = SONG.title;
$('#record-run-title').textContent = SONG.title;
$('#record-duration').textContent = formatTime(WINDOW.end, true);
progress.max = WINDOW.end;
$('#record-guide-link').href = SONG.guideUrl;
if (IS_SEGMENT) {
  $('#recorder-title').replaceChildren(document.createTextNode(`${formatTime(WINDOW.start, true)}〜${formatTime(WINDOW.end, true)}だけ、`), document.createElement('br'), Object.assign(document.createElement('span'), {className:'highlight', textContent:'タイミングを修正。'}));
  $('.record-steps').hidden = true;
  $('#record-intro-notice').textContent = `5秒カウント後、${formatTime(WINDOW.start, true)}から再生し、${formatTime(WINDOW.end, true)}で自動終了します。ほかの時間の譜面は変更しません。`;
  $('#record-layer-notice').textContent = `今回はCLAPとタップCALLだけを記録します。WIPER・声だけCALL・ほかの操作は対象外です。`;
  startButton.textContent = `5秒カウントして${formatTime(WINDOW.start)}〜${formatTime(WINDOW.end)}を記録 →`;
  $('#record-actions-legend').textContent = '押した瞬間に直接記録（Space＝CLAP）';
  $('.record-tip').textContent = 'CLAPは画面ボタンまたはSpaceキー、タップCALLは画面ボタンを直接押してください。';
  $('#record-next-pass').hidden = true;
}
document.querySelectorAll('[data-record-now], [data-record-wiper]').forEach(button => {
  const action = button.dataset.recordWiper ? 'WIPER' : button.dataset.recordNow;
  const allowed = WINDOW.actions.includes(action);
  button.hidden = !allowed;
  button.disabled = !allowed;
});

let music = null;
let barrier = null;
let phase = 'idle';
let notes = [];
let animation = 0;
let recordedAt = '';
let currentPass = 1;

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
  const recording = {...buildRecording(SONG, notes, recordedAt || new Date().toISOString()), version: 2, passes: currentPass};
  if (IS_SEGMENT) recording.correction = {from: WINDOW.start, to: WINDOW.end, actions: [...WINDOW.actions]};
  return recording;
}

function saveDraft() {
  try { localStorage.setItem(DRAFT_KEY, recordingText(makeRecording())); } catch {}
}

function updateCount() {
  const passCount = notes.filter(note => note.pass === currentPass).length;
  count.textContent = `${currentPass}周目 ${passCount}件 / 合計${notes.length}件`;
  undo.disabled = passCount === 0;
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
  const time = Math.min(currentSongTime(), WINDOW.end);
  elapsed.textContent = formatTime(time, true);
  progress.value = time;
  if (time >= WINDOW.end - .02) {
    finish();
    return;
  }
  animation = requestAnimationFrame(draw);
}

function recordGesture(gesture, time, tapAction = 'CLAP') {
  if (phase !== 'playing') return;
  const requestedAction = gesture === 'tap' ? tapAction : 'WIPER';
  if (!WINDOW.actions.includes(requestedAction) || time < WINDOW.start || time > WINDOW.end) return;
  const note = {...noteFromGesture(time, gesture, tapAction), pass: currentPass};
  notes.push(note);
  saveDraft();
  updateCount();
  const direction = note.direction ? ` ${note.direction === 'left' ? '←' : '→'}` : '';
  const action = actionLabel(note);
  last.textContent = `${formatTime(note.time, true)}　${action}${direction}`;
  try { navigator.vibrate?.(12); } catch {}
}

function actionLabel(note) {
  if (note.simultaneous?.includes('CLAP')) return 'CLAP＋CALL';
  return note.action === 'VOICE_CALL' ? '声だけCALL' : note.action;
}

async function start(preservePreviousPasses = false) {
  if (phase !== 'idle' && !(preservePreviousPasses && phase === 'result')) return;
  barrier?.cancel();
  music?.close();
  music = null;
  stopAnimation();
  phase = 'countdown';
  if (preservePreviousPasses) currentPass += 1;
  else {
    notes = [];
    currentPass = 1;
    recordedAt = new Date().toISOString();
  }
  progress.value = WINDOW.start;
  elapsed.textContent = formatTime(WINDOW.start, true);
  updateCount();
  setPage('run');
  startButton.disabled = true;
  pauseButton.disabled = true;
  last.textContent = `${currentPass}周目：カウント後、必要なボタンを直接押してください`;
  music = new Music();
  music.oninterrupt = () => { if (phase === 'playing') pause(); };
  barrier = new StartBarrier({
    onTick: value => showCountdown(value),
    onPreparing: () => showCountdown('音源を準備中…', true),
    onReady: async () => {
      try {
        showCountdown('開始位置を調整中…', true);
        await music.release(PRE_ROLL_SECONDS + WINDOW.start);
        if (phase !== 'countdown' || document.hidden) { await music.pause(); return; }
        showCountdown();
        phase = 'playing';
        pauseButton.disabled = false;
        last.textContent = IS_SEGMENT ? `${formatTime(WINDOW.start, true)}〜${formatTime(WINDOW.end, true)}を記録中です` : `${currentPass}周目を記録中です`;
        draw();
      } catch (error) { showStartError(error); }
    },
    onError: showStartError
  });
  const preparation = music.prime(SONG.audio, 0, PLAYBACK_DURATION);
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
  const rewindSeconds = Math.max(.001, Math.min(5, currentSongTime() - WINDOW.start));
  const rewound = rewindTake(currentSongTime(), rewindSeconds, notes, currentPass);
  rewound.time = Math.max(WINDOW.start, rewound.time);
  rewound.notes = rewound.notes.filter(note => note.pass !== currentPass || note.time < rewound.time);
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
  $('#record-result-summary').textContent = IS_SEGMENT
    ? `${formatTime(WINDOW.start, true)}〜${formatTime(WINDOW.end, true)}のCLAP／タップCALLを${notes.length}件記録しました。`
    : `${currentPass}周・合計${notes.length}件を記録しました。別の動きを重ねる場合は、もう1周追加できます。`;
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
  currentPass = 1;
  recordedAt = '';
  progress.value = WINDOW.start;
  elapsed.textContent = formatTime(WINDOW.start, true);
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
document.addEventListener('keydown', event => {
  if (phase !== 'playing' || !music || event.altKey || event.ctrlKey || event.metaKey) return;
  const shortcut = recorderShortcut(event.code, event.repeat);
  if (!shortcut) return;
  event.preventDefault();
  recordGesture(shortcut.gesture, currentSongTime(), shortcut.tapAction);
});
startButton.addEventListener('click', () => start(false));
pauseButton.addEventListener('click', () => phase === 'paused' ? resume() : pause());
undo.addEventListener('click', () => {
  let index = -1;
  for (let i = notes.length - 1; i >= 0; i -= 1) {
    if (notes[i].pass === currentPass) { index = i; break; }
  }
  const [removed] = index >= 0 ? notes.splice(index, 1) : [];
  if (!removed) return;
  saveDraft();
  updateCount();
  const action = actionLabel(removed);
  last.textContent = `${formatTime(removed.time, true)} の ${action} を取り消しました`;
});
rewindButton.addEventListener('click', rewind);
finishButton.addEventListener('click', finish);
$('#record-copy').addEventListener('click', copyRecording);
$('#record-next-pass').addEventListener('click', () => start(true));
$('#record-again').addEventListener('click', reset);

document.addEventListener('visibilitychange', () => { if (document.hidden && phase === 'playing') pause(); });
window.addEventListener('pagehide', () => music?.close());

try {
  const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
  if (draft?.notes?.length) savedStatus.textContent = `この端末に前回の記録 ${draft.notes.length}件があります。新しく開始すると上書きします。`;
} catch {}

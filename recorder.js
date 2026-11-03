export const TAP_ACTIONS = Object.freeze(['CLAP', 'CALL', 'CLAP_CALL', 'JUMP', 'VOICE_CALL']);

const RECORDING_SONGS = Object.freeze({
  'cat-walk-life': Object.freeze({
    id: 'cat-walk-life-timing-take', title: 'CATWALK LIFE', duration: 224.39,
    audio: './assets/audio/cat-walk-life-recorder.mp3', preRoll: 5,
    guideUrl: 'https://www.youtube.com/watch?v=1y5b0upSCjM', guideVideoId: '1y5b0upSCjM'
  }),
  'snack-snack': Object.freeze({
    id: 'snack-snack-timing-take', title: 'SNACK SNACK', duration: 168.54,
    audio: './assets/audio/snack-snack.mp3', preRoll: 0,
    guideUrl: 'https://www.youtube.com/watch?v=Y04dtYKy-rk', guideVideoId: 'Y04dtYKy-rk'
  })
});

export function recordingSong(id = 'cat-walk-life') {
  return RECORDING_SONGS[id] || RECORDING_SONGS['cat-walk-life'];
}

export function recordingWindow(song, from, to, actions) {
  if (!song || !Number.isFinite(song.duration) || song.duration <= 0) throw new TypeError('曲情報が不正です');
  const start = from === undefined || from === null || from === '' ? 0 : Number(from);
  const end = to === undefined || to === null || to === '' ? song.duration : Number(to);
  const selected = actions === undefined || actions === null || actions === ''
    ? [...TAP_ACTIONS, 'WIPER']
    : (Array.isArray(actions) ? actions : String(actions).split(',')).map(action => action.trim()).filter(Boolean);
  const supported = new Set([...TAP_ACTIONS, 'WIPER']);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > song.duration) throw new TypeError('記録範囲が不正です');
  if (!selected.length || selected.some(action => !supported.has(action))) throw new TypeError('記録操作が不正です');
  return {start, end, actions: [...new Set(selected)]};
}

export function recorderShortcut(code, repeat = false) {
  if (repeat) return null;
  if (code === 'Space') return {gesture: 'tap', tapAction: 'CLAP'};
  if (code === 'ArrowLeft') return {gesture: 'left'};
  if (code === 'ArrowRight') return {gesture: 'right'};
  return null;
}

export function songTime(playbackTime, preRoll = 5) {
  if (!Number.isFinite(playbackTime) || !Number.isFinite(preRoll) || preRoll < 0) throw new TypeError('再生時刻が不正です');
  return Math.max(0, playbackTime - preRoll);
}

export function rewindTake(currentTime, seconds, notes, activePass = null) {
  if (!Number.isFinite(currentTime) || currentTime < 0 || !Number.isFinite(seconds) || seconds <= 0 || !Array.isArray(notes)) {
    throw new TypeError('巻き戻し情報が不正です');
  }
  if (activePass !== null && (!Number.isInteger(activePass) || activePass < 1)) throw new TypeError('周回情報が不正です');
  const time = Math.max(0, currentTime - seconds);
  return {time, notes: notes.filter(note => activePass !== null && note.pass !== activePass || note.time < time).map(note => ({...note}))};
}

function cleanTime(time) {
  if (!Number.isFinite(time) || time < 0) throw new TypeError('記録時刻は0以上の数値が必要です');
  return Math.round(time * 1000) / 1000;
}

export function noteFromGesture(time, gesture, tapAction = 'CLAP') {
  const noteTime = cleanTime(time);
  if (gesture === 'left' || gesture === 'right') {
    return {time: noteTime, action: 'WIPER', direction: gesture};
  }
  if (gesture !== 'tap') throw new TypeError('未対応の操作です');
  if (!TAP_ACTIONS.includes(tapAction)) throw new TypeError('未対応のタップ種別です');
  if (tapAction === 'CLAP_CALL') return {time: noteTime, action: 'CALL', simultaneous: ['CLAP']};
  if (tapAction === 'VOICE_CALL') return {time: noteTime, action: 'VOICE_CALL'};
  return {time: noteTime, action: tapAction};
}

export function buildRecording(song, notes, recordedAt = new Date().toISOString()) {
  if (!song?.id || !song?.title || !Number.isFinite(song?.duration)) throw new TypeError('曲情報が不正です');
  if (!Array.isArray(notes)) throw new TypeError('記録は配列で指定してください');
  return {
    version: 1,
    songId: song.id,
    title: song.title,
    duration: song.duration,
    recordedAt,
    notes: notes.map(note => ({...note}))
  };
}

export function recordingText(recording) {
  return JSON.stringify(recording, null, 2);
}

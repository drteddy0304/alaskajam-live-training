export const TAP_ACTIONS = Object.freeze(['CLAP', 'CALL', 'CLAP_CALL', 'JUMP']);

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

export const TAP_ACTIONS = Object.freeze(['CLAP', 'CALL', 'JUMP']);

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

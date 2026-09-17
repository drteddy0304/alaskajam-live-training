export const LANE = Object.freeze({ targetPercent: 18, entryPercent: 100, travelTime: 4, pastTime: 0.45 });

export const NOTE_STYLE = Object.freeze({
  CLAP: { symbol: '✳', label: 'CLAP', gesture: 'tap' },
  CALL: { symbol: '〰', label: 'CALL', gesture: 'tap' },
  JUMP: { symbol: '↑', label: 'JUMP', gesture: 'tap' },
  WIPER_LEFT: { symbol: '←', label: 'WIPER', gesture: 'left' },
  WIPER_RIGHT: { symbol: '→', label: 'WIPER', gesture: 'right' }
});

export function noteStyle(note) {
  return NOTE_STYLE[note.action === 'WIPER' ? `WIPER_${note.direction.toUpperCase()}` : note.action];
}

export function lanePosition(noteTime, playbackTime, lane = LANE) {
  const secondsUntil = noteTime - playbackTime;
  return lane.targetPercent + (secondsUntil / lane.travelTime) * (lane.entryPercent - lane.targetPercent);
}

export function visibleLaneNotes(notes, playbackTime, lane = LANE) {
  return notes
    .map((note, index) => ({ note, index, x: lanePosition(note.time, playbackTime, lane) }))
    .filter(item => item.note.time - playbackTime <= lane.travelTime && playbackTime - item.note.time <= lane.pastTime);
}

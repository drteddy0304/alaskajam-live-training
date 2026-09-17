export const WINDOWS = Object.freeze({ perfect: 0.12, good: 0.28 });
const actions = ['CLAP', 'WIPER', 'CALL', 'JUMP'];
export function validateChart(chart) {
  if (chart.version !== 1 || !chart.id || !chart.title || !Number.isFinite(chart.duration) || chart.duration <= 0 || !Number.isFinite(chart.leadTime) || chart.leadTime < WINDOWS.good || !Array.isArray(chart.notes) || !chart.notes.length) throw new Error('譜面の形式が正しくありません');
  let previous = -Infinity;
  for (const note of chart.notes) {
    if (!Number.isFinite(note.time) || note.time < 0 || note.time + WINDOWS.good > chart.duration || note.time - previous <= 2 * WINDOWS.good || !actions.includes(note.action) || (note.action === 'WIPER' && !['left', 'right'].includes(note.direction))) throw new Error('譜面の時刻・アクションが正しくありません');
    previous = note.time;
  }
  if (chart.audio !== null && (!chart.audio || typeof chart.audio.src !== 'string' || !chart.audio.src || !Number.isFinite(chart.audio.offset) || chart.audio.offset < 0)) throw new Error('音源設定が正しくありません');
  if (chart.lyrics !== undefined && (typeof chart.lyrics !== 'string' || !chart.lyrics)) throw new Error('歌詞データ参照が正しくありません');
  if (chart.guideVideo !== undefined && (!chart.guideVideo || chart.guideVideo.provider !== 'youtube' || typeof chart.guideVideo.videoId !== 'string' || !chart.guideVideo.videoId || !['verified', 'unverified'].includes(chart.guideVideo.syncStatus) || (chart.guideVideo.syncStatus === 'verified' && (!Number.isFinite(chart.guideVideo.audioToVideoOffset) || chart.guideVideo.audioToVideoOffset < 0)))) throw new Error('ガイド動画設定が正しくありません');
  return chart;
}
export class Session {
  constructor(chart) { this.chart = validateChart(chart); this.results = Array(chart.notes.length).fill(null); this.combo = 0; this.maxCombo = 0; }
  record(index, grade) {
    this.results[index] = grade;
    this.combo = grade === 'MISS' ? 0 : this.combo + 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    return { index, grade };
  }
  advance(time) {
    const missed = [];
    this.chart.notes.forEach((note, i) => { if (!this.results[i] && time - note.time > WINDOWS.good + 1e-9) missed.push(this.record(i, 'MISS')); });
    return missed;
  }
  input(time, gesture) {
    this.advance(time);
    const index = this.chart.notes.findIndex((note, i) => !this.results[i] && Math.abs(time - note.time) <= WINDOWS.good + 1e-9);
    if (index < 0) return null;
    const note = this.chart.notes[index];
    const correct = note.action === 'WIPER' ? gesture === note.direction : gesture === 'tap';
    const grade = !correct ? 'MISS' : Math.abs(time - note.time) <= WINDOWS.perfect + 1e-9 ? 'PERFECT' : 'GOOD';
    return this.record(index, grade);
  }
  summary() {
    const counts = { PERFECT: 0, GOOD: 0, MISS: 0 };
    this.results.forEach(grade => counts[grade || 'MISS']++);
    return { ...counts, readiness: Math.round((counts.PERFECT + counts.GOOD * 0.7) / this.results.length * 100), maxCombo: this.maxCombo };
  }
}

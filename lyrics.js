const requiredSourceFields = ['name', 'url', 'revision'];

export function validateLyrics(data, duration = Infinity) {
  if (data?.version !== 1 || !Array.isArray(data.cues) || !data.source ||
      requiredSourceFields.some(field => typeof data.source[field] !== 'string' || !data.source[field])) {
    throw new Error('歌詞データの形式が正しくありません');
  }
  let previousEnd = -Infinity;
  for (const cue of data.cues) {
    if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < 0 ||
        cue.end <= cue.start || cue.end > duration || cue.start < previousEnd ||
        typeof cue.text !== 'string' || !cue.text.trim() ||
        typeof cue.source !== 'string' || !cue.source.trim()) {
      throw new Error('歌詞の時刻・並び・文字列が正しくありません');
    }
    previousEnd = cue.end;
  }
  return data;
}

export function lyricAt(cues, time, leadTime) {
  if (!Number.isFinite(time) || !Number.isFinite(leadTime) || leadTime < 0) return null;
  const cue = cues.find(item => time >= item.start - leadTime && time < item.end);
  return cue ? { cue, phase: time < cue.start ? 'upcoming' : 'active' } : null;
}

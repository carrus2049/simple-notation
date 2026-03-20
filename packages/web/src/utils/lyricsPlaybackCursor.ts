import { diffChars } from 'diff';
import type { LyricsDiff, LyricsDiffItem } from '@/use/useDemoData';

/** 不参与歌词 diff 对比的字符：谱面占位符 `-`、空白、Unicode 标点（与 computeLyricsDiff 一致） */
export function isLyricsCompareSkippedChar(c: string): boolean {
  if (c.length !== 1) return false;
  if (c === '-') return true;
  if (/\s/u.test(c)) return true;
  if (/\p{P}/u.test(c)) return true;
  return false;
}

/** 与 lyrics diff 合并串一致：去掉 `-`、空白、标点（逗号等不参与对比） */
export function stripForCompare(s: string): string {
  let out = '';
  for (const c of s || '') {
    if (!isLyricsCompareSkippedChar(c)) out += c;
  }
  return out;
}

/** 与 Python 中 score 行合并方式一致 */
export function buildScoreTextFromLyricFile(lyric: string): string {
  const lines = (lyric || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.map((ln) => stripForCompare(ln)).join('');
}

export function buildRawTextFromLyricsDiff(lyricsDiff: LyricsDiff): string {
  const parts: string[] = [];
  for (const it of lyricsDiff.lyrics_raw_items) {
    if (it.type === 'normal_lyrics') {
      parts.push(stripForCompare(it.content || ''));
    }
  }
  return parts.join('');
}

function syllableToStripped(s: string | string[]): string {
  if (typeof s === 'string') return stripForCompare(s);
  return s.map((x) => stripForCompare(x)).join('');
}

/** 当前音符（1-based）起始处，在合并后的 score 文本中的字符偏移 */
export function scoreOffsetAtNoteStart(
  splitLyrics: (string | string[])[],
  noteIndex1Based: number,
): number {
  const n = Math.max(0, noteIndex1Based - 1);
  let off = 0;
  for (let i = 0; i < n && i < splitLyrics.length; i++) {
    off += syllableToStripped(splitLyrics[i]).length;
  }
  return off;
}

/**
 * 将 score 合并串中的下标映射到 raw 合并串中的下标（与 Python difflib 对齐思路，使用 diffChars）
 */
export function mapScoreIndexToRawIndex(
  rawText: string,
  scoreText: string,
  scoreIndex: number,
): number {
  if (scoreIndex <= 0) return 0;
  if (!scoreText.length) return 0;
  const si = Math.min(scoreIndex, scoreText.length - 1);
  const parts = diffChars(rawText, scoreText);
  let scoreAt = 0;
  let rawAt = 0;
  for (const part of parts) {
    const len = part.value.length;
    if (part.added) {
      if (scoreAt + len > si) {
        return rawAt;
      }
      scoreAt += len;
      continue;
    }
    if (part.removed) {
      rawAt += len;
      continue;
    }
    if (si < scoreAt + len) {
      return rawAt + (si - scoreAt);
    }
    rawAt += len;
    scoreAt += len;
  }
  return Math.min(rawAt, rawText.length);
}

export interface LyricsCursorPosition {
  /** lyrics_raw_items 中的下标 */
  itemIndex: number;
  /** 该项 content 中的字符下标，光标画在该字符之前；等于 content.length 表示行尾 */
  charIndexInContent: number;
}

/**
 * 全局 raw 合并偏移 -> 某条 normal_lyrics 行内原始 content 的下标（含 '-'、空格）
 */
export function rawGlobalOffsetToCursorInItem(
  lyricsDiff: LyricsDiff,
  globalRawOffset: number,
): LyricsCursorPosition | null {
  let off = 0;
  for (let i = 0; i < lyricsDiff.lyrics_raw_items.length; i++) {
    const it = lyricsDiff.lyrics_raw_items[i];
    if (it.type !== 'normal_lyrics') continue;
    const c = it.content || '';
    const stripLen = stripForCompare(c).length;
    if (globalRawOffset < off + stripLen) {
      const local = globalRawOffset - off;
      const charIndex = stripIndexToOriginalIndex(c, local);
      return { itemIndex: i, charIndexInContent: charIndex };
    }
    off += stripLen;
  }
  return null;
}

/**
 * 合并 strip 串中的偏移 -> 歌词文件正文中的字符下标（与 buildScoreTextFromLyricFile 行合并规则一致）
 */
export function mergedScoreOffsetToLyricDocOffset(
  lyric: string,
  mergedTarget: number,
): number {
  let merged = 0;
  const s = lyric || '';
  const lines = s.split(/\r?\n/);
  let doc = 0;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const trimmed = line.trim();
    const isLast = li === lines.length - 1;
    if (!trimmed) {
      doc += line.length + (isLast ? 0 : 1);
      continue;
    }
    const stripLen = stripForCompare(trimmed).length;
    if (mergedTarget < merged + stripLen) {
      const local = mergedTarget - merged;
      const charInTrimmed = stripIndexToOriginalIndex(trimmed, local);
      const lead = line.length - line.trimStart().length;
      return doc + lead + charInTrimmed;
    }
    merged += stripLen;
    doc += line.length + (isLast ? 0 : 1);
  }
  return s.length;
}

/** 在 strip 串中的下标 -> 原始字符串中「该 strip 字符」的起始位置 */
function stripIndexToOriginalIndex(content: string, stripIndex: number): number {
  let si = 0;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (isLyricsCompareSkippedChar(ch)) continue;
    if (si === stripIndex) return i;
    si++;
  }
  return content.length;
}

export function computeLyricsCursorPosition(
  lyricsDiff: LyricsDiff,
  scoreLyricText: string,
  splitLyrics: (string | string[])[],
  noteIndex1Based: number,
): LyricsCursorPosition | null {
  const rawText = buildRawTextFromLyricsDiff(lyricsDiff);
  const scoreText = buildScoreTextFromLyricFile(scoreLyricText);
  if (!rawText.length || !scoreText.length) return null;

  const scoreOff = scoreOffsetAtNoteStart(splitLyrics, noteIndex1Based);
  const rawGlobal = mapScoreIndexToRawIndex(rawText, scoreText, scoreOff);
  return rawGlobalOffsetToCursorInItem(lyricsDiff, rawGlobal);
}

export function charStyleForIndex(
  item: LyricsDiffItem,
  charIndex: number,
  getSpanColor: (status: string) => string,
): Record<string, string> {
  const content = item.content || '';
  const spans = item.char_spans;
  if (spans && spans.length > 0) {
    for (const span of spans) {
      if (span.start <= charIndex && charIndex < span.end) {
        if (span.status === 'matched') return {};
        return { color: getSpanColor(span.status) };
      }
    }
  }
  return {};
}

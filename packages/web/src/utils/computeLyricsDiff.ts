import { diffChars } from 'diff';
import type { CharSpan, LyricsDiff, LyricsDiffItem } from '@/use/useDemoData';
import { isLyricsCompareSkippedChar, stripForCompare } from '@/utils/lyricsPlaybackCursor';

/**
 * 逐字对比两个字符串，返回 (spans_a, spans_b)。
 * 与 Python _char_diff_spans 一致思路；底层使用 diff 包的 diffChars。
 * 输入 a、b 已不含标点与占位符（仅参与对比的字）。
 */
function charDiffSpans(a: string, b: string): [CharSpan[], CharSpan[]] {
  const parts = diffChars(a, b);
  let i1 = 0;
  let j1 = 0;
  const spansA: CharSpan[] = [];
  const spansB: CharSpan[] = [];
  for (let pi = 0; pi < parts.length; pi++) {
    const part = parts[pi];
    const next = parts[pi + 1];
    const val = part.value;
    const len = val.length;
    if (part.removed && next?.added) {
      const lenB = next.value.length;
      spansA.push({ start: i1, end: i1 + len, status: 'diff' });
      spansB.push({ start: j1, end: j1 + lenB, status: 'diff' });
      i1 += len;
      j1 += lenB;
      pi += 1;
      continue;
    }
    if (part.added) {
      spansB.push({ start: j1, end: j1 + len, status: 'extra_in_score' });
      j1 += len;
    } else if (part.removed) {
      spansA.push({ start: i1, end: i1 + len, status: 'extra_in_raw' });
      i1 += len;
    } else {
      spansA.push({ start: i1, end: i1 + len, status: 'matched' });
      spansB.push({ start: j1, end: j1 + len, status: 'matched' });
      i1 += len;
      j1 += len;
    }
  }
  return [spansA, spansB];
}

function fullLineSpan(content: string, status: string): CharSpan[] {
  const c = content || '';
  return c ? [{ start: 0, end: c.length, status }] : [];
}

function mapFilteredSpansToOriginal(
  originalContent: string,
  fullSpans: CharSpan[],
  startOff: number,
): CharSpan[] {
  if (!originalContent) return [];
  const result: CharSpan[] = [];
  let filtPos = 0;
  for (let i = 0; i < originalContent.length; i++) {
    const c = originalContent[i];
    let st: string;
    if (isLyricsCompareSkippedChar(c)) {
      st = 'matched';
    } else {
      const globalPos = startOff + filtPos;
      st = 'matched';
      for (const s of fullSpans) {
        if (s.start <= globalPos && globalPos < s.end) {
          st = s.status;
          break;
        }
      }
      filtPos += 1;
    }
    const last = result[result.length - 1];
    if (last && last.status === st && last.end === i) {
      last.end = i + 1;
    } else {
      result.push({ start: i, end: i + 1, status: st });
    }
  }
  return result;
}

function lineStatusFromSpans(spans: CharSpan[], side: 'raw' | 'score'): string {
  if (spans.every((s) => s.status === 'matched')) return 'matched';
  if (spans.some((s) => s.status === 'diff')) return 'diff';
  if (side === 'raw') {
    if (spans.some((s) => s.status === 'extra_in_raw')) return 'extra_in_raw';
    return 'diff';
  }
  if (spans.some((s) => s.status === 'extra_in_score')) return 'extra_in_score';
  return 'diff';
}

/**
 * 根据当前谱面歌词正文重算 diff（lyrics_raw 结构来自服务端 lyrics_diff.json）。
 * 与 kraken lyrics_diff.compute_lyrics_diff 行为一致。
 */
export function computeLyricsDiff(
  lyricsRawItems: Pick<LyricsDiffItem, 'content' | 'type'>[],
  scoreLyricText: string,
): LyricsDiff {
  const rawNormalIndices: number[] = [];
  for (let i = 0; i < lyricsRawItems.length; i++) {
    if (lyricsRawItems[i].type === 'normal_lyrics') rawNormalIndices.push(i);
  }
  const rawParts = rawNormalIndices.map((idx) => lyricsRawItems[idx].content || '');
  const scoreLines = (scoreLyricText || '')
    .split(/\r?\n/)
    .map((ln) => ln.trim())
    .filter(Boolean);

  const rawText = rawParts.map((p) => stripForCompare(p)).join('');
  const scoreText = scoreLines.map((ln) => stripForCompare(ln)).join('');

  const [spansRawFull, spansScoreFull] = charDiffSpans(rawText, scoreText);

  const rawCharSpans = new Map<number, CharSpan[]>();
  const rawStatus = new Map<number, string>();
  let off = 0;
  for (let k = 0; k < rawNormalIndices.length; k++) {
    const rawIdx = rawNormalIndices[k];
    const content = rawParts[k];
    const spans = mapFilteredSpansToOriginal(content, spansRawFull, off);
    off += stripForCompare(content).length;
    rawCharSpans.set(rawIdx, spans);
    rawStatus.set(rawIdx, lineStatusFromSpans(spans, 'raw'));
  }

  const scoreCharSpans = new Map<number, CharSpan[]>();
  const scoreStatus = new Map<number, string>();
  off = 0;
  for (let i = 0; i < scoreLines.length; i++) {
    const line = scoreLines[i];
    const spans = mapFilteredSpansToOriginal(line, spansScoreFull, off);
    off += stripForCompare(line).length;
    scoreCharSpans.set(i, spans);
    scoreStatus.set(i, lineStatusFromSpans(spans, 'score'));
  }

  const resultRaw: LyricsDiffItem[] = lyricsRawItems.map((it, i) => {
    const t = it.type || '';
    const item: LyricsDiffItem = {
      content: it.content ?? '',
      type: t,
    };
    if (t === 'title' || t === 'paragraph_line') {
      item.status = t;
      item.char_spans = null;
    } else if (t === 'normal_lyrics') {
      item.status = rawStatus.get(i) ?? 'matched';
      item.char_spans = rawCharSpans.get(i) ?? fullLineSpan(it.content || '', 'matched');
    } else {
      item.status = 'other';
      item.char_spans = null;
    }
    return item;
  });

  const resultScore: LyricsDiff['score_lyric_lines'] = scoreLines.map((line, i) => ({
    content: line,
    status: scoreStatus.get(i) ?? 'matched',
    char_spans: scoreCharSpans.get(i) ?? fullLineSpan(line, 'matched'),
  }));

  const colorScheme: LyricsDiff['color_scheme'] = {
    light: {
      title: '#16a34a',
      paragraph_line: '#16a34a',
      extra_in_raw: '#dc2626',
      extra_in_score: '#2563eb',
      diff: '#ca8a04',
    },
    dark: {
      title: '#4ade80',
      paragraph_line: '#4ade80',
      extra_in_raw: '#f87171',
      extra_in_score: '#60a5fa',
      diff: '#facc15',
    },
  };

  return {
    lyrics_raw_items: resultRaw,
    score_lyric_lines: resultScore,
    color_scheme: colorScheme,
  };
}

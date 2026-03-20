import { diffChars } from 'diff';
import type { LyricsDiffItem } from '@/use/useDemoData';
import {
  isLyricsCompareSkippedChar,
  stripForCompare,
} from '@/utils/lyricsPlaybackCursor';

export type LyricsFixMode = 'wrong' | 'missing' | 'extra';

/**
 * 在 strip 后的全局串上应用修复（与 computeLyricsDiff 的 charDiffSpans 分段一致）。
 * wrong: 相邻 removed+added 用 raw；单独的 removed/added 按 missing/extra 规则
 * missing: 仅单独的 removed 插入
 * extra: 仅单独的 added 删除
 */
export function rebuildStrippedScoreText(
  rawText: string,
  scoreText: string,
  mode: LyricsFixMode,
): string {
  const parts = diffChars(rawText, scoreText);
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const next = parts[i + 1];
    if (p.removed && next?.added) {
      const rawChunk = p.value;
      const scoreChunk = next.value;
      if (mode === 'wrong') {
        out += rawChunk;
      } else {
        out += scoreChunk;
      }
      i += 1;
      continue;
    }
    if (p.removed && !p.added) {
      if (mode === 'missing') {
        out += p.value;
      }
      continue;
    }
    if (p.added && !p.removed) {
      if (mode !== 'extra') {
        out += p.value;
      }
      continue;
    }
    if (!p.removed && !p.added) {
      out += p.value;
    }
  }
  return out;
}

function parseGapsAndCores(line: string): { gaps: string[]; cores: string[] } {
  const gaps: string[] = [];
  const cores: string[] = [];
  let curGap = '';
  for (const ch of line) {
    if (isLyricsCompareSkippedChar(ch)) {
      curGap += ch;
    } else {
      gaps.push(curGap);
      curGap = '';
      cores.push(ch);
    }
  }
  gaps.push(curGap);
  return { gaps, cores };
}

function applySameLengthCoreReplace(originalLine: string, newCore: string): string {
  const chars = [...originalLine];
  let ci = 0;
  for (let i = 0; i < originalLine.length && ci < newCore.length; i++) {
    if (!isLyricsCompareSkippedChar(originalLine[i]!)) {
      chars[i] = newCore[ci]!;
      ci++;
    }
  }
  return chars.join('');
}

function buildInnerGapBetween(
  k: number,
  M: number,
  N: number,
  gaps: string[],
): string {
  if (M <= 1) return '-';
  if (N === M) {
    return gaps[k + 1] ?? '-';
  }
  if (N <= 1) return '-';
  const j = Math.min(N - 2, Math.floor((k * (N - 1)) / Math.max(1, M - 1)));
  const oldGap = gaps[j + 1] ?? '';
  const punct = oldGap.replace(/-/g, '');
  return '-' + punct;
}

function rebuildPhysicalScoreLine(originalLine: string, newCore: string): string {
  const { gaps, cores } = parseGapsAndCores(originalLine);
  const N = cores.length;
  const M = newCore.length;
  if (N === 0) {
    return M === 0 ? originalLine : newCore.split('').join('-');
  }
  if (N === M) {
    return applySameLengthCoreReplace(originalLine, newCore);
  }
  if (M === 0) {
    return gaps[0]! + gaps[N]!;
  }
  let out = gaps[0]!;
  for (let k = 0; k < M; k++) {
    out += newCore[k]!;
    if (k < M - 1) {
      out += buildInnerGapBetween(k, M, N, gaps);
    }
  }
  out += gaps[N]!;
  return out;
}

function distributeStrippedToLines(newText: string, oldLens: number[]): string[] {
  const totalOld = oldLens.reduce((a, b) => a + b, 0);
  if (oldLens.length === 0) return [];
  if (totalOld === 0) {
    return oldLens.map(() => '');
  }
  if (newText.length === totalOld) {
    let o = 0;
    return oldLens.map((len) => {
      const chunk = newText.slice(o, o + len);
      o += len;
      return chunk;
    });
  }
  let o = 0;
  const out: string[] = [];
  for (let i = 0; i < oldLens.length; i++) {
    const ratio = oldLens[i]! / totalOld;
    const len =
      i === oldLens.length - 1
        ? Math.max(0, newText.length - o)
        : Math.round(newText.length * ratio);
    out.push(newText.slice(o, o + len));
    o += len;
  }
  return out;
}

export function applyScoreLyricFixFromRaw(
  scoreLyricText: string,
  lyricsRawItems: Pick<LyricsDiffItem, 'content' | 'type'>[],
  mode: LyricsFixMode,
): string {
  const scoreLines = (scoreLyricText || '')
    .split(/\r?\n/)
    .map((ln) => ln.trim())
    .filter(Boolean);
  const rawParts = lyricsRawItems
    .filter((it) => it.type === 'normal_lyrics')
    .map((it) => it.content || '');
  const rawText = rawParts.map((p) => stripForCompare(p)).join('');
  const scoreText = scoreLines.map((ln) => stripForCompare(ln)).join('');
  const newStripped = rebuildStrippedScoreText(rawText, scoreText, mode);
  const oldLens = scoreLines.map((ln) => stripForCompare(ln).length);
  const newStrippedLines = distributeStrippedToLines(newStripped, oldLens);
  const merged = scoreLines.map((orig, i) =>
    rebuildPhysicalScoreLine(orig, newStrippedLines[i] ?? ''),
  );
  return merged.join('\n');
}

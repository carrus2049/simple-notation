import type { SNLyricDiffPaint } from 'simple-notation';
import type { LyricsDiff } from '@/use/useDemoData';

/**
 * 与 computeLyricsDiff / buildScoreTextFromLyricFile 一致：按行遍历，跳过 '-' 与空格，
 * 得到与 SNRuntime.splitLyrics strip 合并串对齐的逐字状态。
 */
export function buildLyricDiffPaint(
  diff: LyricsDiff,
  scoreLyricText: string,
): SNLyricDiffPaint {
  const lines = (scoreLyricText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const mergedCharStatus: string[] = [];

  const statusAt = (lineIdx: number, charIdx: number): string => {
    const spans = diff.score_lyric_lines[lineIdx]?.char_spans;
    if (!spans?.length) return 'matched';
    for (const s of spans) {
      if (s.start <= charIdx && charIdx < s.end) return s.status;
    }
    return 'matched';
  };

  for (let li = 0; li < lines.length; li++) {
    const content = lines[li];
    for (let i = 0; i < content.length; i++) {
      const c = content[i];
      if (c === '-' || c === ' ') continue;
      mergedCharStatus.push(statusAt(li, i));
    }
  }

  return {
    mergedCharStatus,
    colorMap: diff.color_scheme.light,
  };
}

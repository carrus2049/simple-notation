<template>
  <aside
    v-if="lyricsDiff"
    class="w-72 flex-shrink-0 flex flex-col min-h-0 border-l"
    :class="[
      isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    ]"
  >
    <div class="flex-shrink-0 p-3 border-b flex items-center justify-between" :class="borderClass">
      <span class="font-medium text-sm" :class="textClass">歌词审核</span>
      <button
        type="button"
        class="text-xs px-2 py-1 rounded"
        :class="toggleClass"
        @click="isDark = !isDark"
      >
        {{ isDark ? '深色' : '浅色' }}
      </button>
    </div>
    <div
      ref="scrollRootRef"
      class="flex-1 overflow-y-auto min-h-0 p-3 space-y-1 text-sm"
      :class="textClass"
    >
      <div
        v-for="(item, idx) in lyricsDiff.lyrics_raw_items"
        :key="'raw-' + idx"
        class="leading-relaxed break-words"
        :data-lyrics-cursor-line="cursorPosition?.itemIndex === idx ? '1' : undefined"
      >
        <template v-if="item.status === 'title' || item.status === 'paragraph_line'">
          <span :style="rawItemStyle(item)">{{ item.content || '\u00A0' }}</span>
        </template>
        <template v-else-if="item.type === 'normal_lyrics' && shouldRenderCursorLine(idx)">
          <span
            v-for="(ch, ci) in charsOf(item)"
            :key="'c-' + ci"
            :style="charStyleWithCursor(item, idx, ci)"
          >{{ ch }}</span>
          <span
            v-if="showCursorBlockAfterLineEnd(idx, item)"
            class="inline-block align-middle shrink-0"
            :style="pointerCursorBlockStyle"
            aria-hidden="true"
          />
        </template>
        <template v-else-if="getCharSpans(item).length">
          <span
            v-for="(span, si) in getCharSpans(item)"
            :key="'span-' + si"
            :style="spanStyle(item, span)"
          >{{ (item.content || '').slice(span.start, span.end) || '\u00A0' }}</span>
        </template>
        <template v-else>
          <span :style="rawItemStyle(item)">{{ item.content || '\u00A0' }}</span>
        </template>
      </div>
      <template v-if="extraScoreLines.length">
        <div
          class="pt-3 mt-3 border-t"
          :class="isDark ? 'border-gray-700' : 'border-gray-200'"
        >
          <span class="text-xs opacity-75">谱面多出（标蓝）</span>
        </div>
        <div
          v-for="(line, idx) in extraScoreLines"
          :key="'score-' + idx"
          class="leading-relaxed break-words"
        >
          <template v-if="getCharSpans(line).length">
            <span
              v-for="(span, si) in getCharSpans(line)"
              :key="'span-' + si"
              :style="scoreSpanStyle(span)"
            >{{ (line.content || '').slice(span.start, span.end) || '\u00A0' }}</span>
          </template>
          <template v-else>
            <span :style="extraScoreStyle()">{{ line.content || '\u00A0' }}</span>
          </template>
        </div>
      </template>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { SNRuntime } from 'simple-notation';
import type { CharSpan, LyricsDiff, LyricsDiffItem } from '@/use/useDemoData';
import {
  computeLyricsCursorPosition,
  charStyleForIndex,
  type LyricsCursorPosition,
} from '@/utils/lyricsPlaybackCursor';

defineOptions({ name: 'LyricsDiffPanel' });

const props = defineProps<{
  lyricsDiff: LyricsDiff | null;
  /** 与谱面 loadData 使用的歌词正文一致，用于与 lyrics_diff 对齐 */
  scoreLyricText?: string;
  /** 当前播放音符序号（1-based），与谱面指针一致 */
  currentNoteIndex?: number;
  /** 是否在歌词侧显示播放进度条（光标） */
  showPlaybackCursor?: boolean;
}>();

const scrollRootRef = ref<HTMLElement | null>(null);

const isDark = ref(false);

const borderClass = computed(() =>
  props.lyricsDiff && isDark.value
    ? 'border-gray-700'
    : 'border-gray-200',
);

const textClass = computed(() =>
  isDark.value ? 'text-gray-200' : 'text-gray-800',
);

const toggleClass = computed(() =>
  isDark.value
    ? 'bg-gray-600 text-gray-200 hover:bg-gray-500'
    : 'bg-gray-200 text-gray-700 hover:bg-gray-300',
);

/** 与 simple-notation SNPointerLayer 播放指针 POINTER_COLOR / ROUND_RADIUS 一致 */
const pointerCursorBlockStyle = {
  backgroundColor: 'rgba(0, 191, 255, 0.3)',
  borderRadius: '4px',
  width: '6px',
  minHeight: '1.1em',
  verticalAlign: 'middle',
} as const;

const extraScoreLines = computed(() =>
  props.lyricsDiff
    ? props.lyricsDiff.score_lyric_lines.filter((l) => l.status === 'extra_in_score')
    : [],
);

const cursorPosition = computed((): LyricsCursorPosition | null => {
  if (!props.showPlaybackCursor || !props.lyricsDiff) return null;
  const text = props.scoreLyricText ?? '';
  if (!text.trim()) return null;
  const note = props.currentNoteIndex ?? 1;
  if (note < 1) return null;
  return computeLyricsCursorPosition(
    props.lyricsDiff,
    text,
    SNRuntime.splitLyrics,
    note,
  );
});

function shouldRenderCursorLine(idx: number): boolean {
  return !!(
    props.showPlaybackCursor &&
    cursorPosition.value &&
    cursorPosition.value.itemIndex === idx
  );
}

function charsOf(item: LyricsDiffItem): string[] {
  return Array.from(item.content || '');
}

function isCursorChar(itemIdx: number, charIdx: number): boolean {
  const c = cursorPosition.value;
  return !!(c && c.itemIndex === itemIdx && c.charIndexInContent === charIdx);
}

function showCursorBlockAfterLineEnd(itemIdx: number, item: LyricsDiffItem): boolean {
  const c = cursorPosition.value;
  const len = (item.content || '').length;
  return !!(c && c.itemIndex === itemIdx && c.charIndexInContent >= len && len > 0);
}

function charStyleAt(item: LyricsDiffItem, charIndex: number) {
  return charStyleForIndex(item, charIndex, (st) => spanColor(st));
}

function charStyleWithCursor(item: LyricsDiffItem, itemIdx: number, charIdx: number) {
  const base = charStyleAt(item, charIdx);
  if (!isCursorChar(itemIdx, charIdx)) return base;
  return {
    ...base,
    backgroundColor: pointerCursorBlockStyle.backgroundColor,
    borderRadius: pointerCursorBlockStyle.borderRadius,
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  };
}

const scrollCursorIntoView = async () => {
  if (!props.showPlaybackCursor) return;
  await nextTick();
  const root = scrollRootRef.value;
  if (!root) return;
  const el = root.querySelector('[data-lyrics-cursor-line="1"]');
  el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
};

watch(
  () => [props.currentNoteIndex, props.showPlaybackCursor, cursorPosition.value?.itemIndex] as const,
  () => {
    scrollCursorIntoView();
  },
);

function getCharSpans(item: LyricsDiffItem | { content: string; char_spans?: CharSpan[] | null }): CharSpan[] {
  const spans = item.char_spans;
  if (spans && spans.length > 0) return spans;
  const content = item.content || '';
  return content ? [{ start: 0, end: content.length, status: 'matched' }] : [];
}

function spanColor(status: string): string {
  const scheme = props.lyricsDiff!.color_scheme[isDark.value ? 'dark' : 'light'];
  return scheme[status as keyof typeof scheme] ?? 'inherit';
}

function rawItemStyle(item: LyricsDiffItem) {
  const scheme = props.lyricsDiff!.color_scheme[isDark.value ? 'dark' : 'light'];
  let color: string;
  const status = item.status || item.type;
  if (status === 'title' || status === 'paragraph_line') {
    color = scheme.title;
  } else if (status === 'extra_in_raw') {
    color = scheme.extra_in_raw;
  } else if (status === 'diff') {
    color = scheme.diff;
  } else {
    color = 'inherit';
  }
  return { color };
}

function spanStyle(item: LyricsDiffItem, span: CharSpan) {
  if (span.status === 'matched') return {};
  return { color: spanColor(span.status) };
}

function scoreSpanStyle(span: CharSpan) {
  if (span.status === 'matched') return {};
  return { color: spanColor(span.status) };
}

function extraScoreStyle() {
  const scheme = props.lyricsDiff!.color_scheme[isDark.value ? 'dark' : 'light'];
  return { color: scheme.extra_in_score };
}
</script>

<template>
  <div class="h-screen bg-gray-100 flex flex-col overflow-hidden">
    <header class="sticky top-0 z-20 flex-shrink-0 bg-white shadow px-4 py-2 flex gap-2 items-center flex-wrap">
      <router-link to="/" class="font-semibold text-gray-800 hover:text-blue-600">
        Demo 谱面调试
      </router-link>
      <button
        type="button"
        class="px-3 py-1.5 border border-violet-300 bg-violet-50 text-violet-800 rounded text-sm hover:bg-violet-100"
        @click="startTutorial"
      >
        教程
      </button>
      <div
        class="flex items-center gap-2 border-l pl-2 ml-1"
        data-demo-tutorial="demo-export"
      >
        <button
          type="button"
          class="px-3 py-1.5 bg-teal-600 text-white rounded text-sm hover:bg-teal-700 disabled:opacity-40"
          :disabled="!canExportJpg || exportJpgBusy"
          title="每页 A4：左右 10mm、上下 3mm 留白，谱面顶对齐并水平居中；多页为 ZIP"
          @click="exportScoreJpg"
        >
          {{ exportJpgBusy ? '导出中…' : '导出 JPG' }}
        </button>
      </div>
      <div class="flex items-center gap-2" data-demo-tutorial="demo-connect">
        <input
          v-model="serverRoot"
          type="text"
          placeholder="服务根 URL，如 http://localhost:8000"
          class="px-3 py-1.5 border rounded text-sm w-48"
        />
        <button
          class="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          @click="handleConnect"
        >
          连接
        </button>
        <select
          v-model="selectedBatch"
          class="px-3 py-1.5 border rounded text-sm w-40"
          :disabled="!batches.length"
          @change="handleBatchChange"
        >
          <option value="" disabled>选择批次</option>
          <option v-for="b in batches" :key="b" :value="b">{{ b }}</option>
        </select>
      </div>
      <div class="flex items-center gap-2 border-l pl-2 ml-1" data-demo-tutorial="demo-playback">
        <button
          v-if="playState === 'idle'"
          class="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
          @click="playFromCurrentPosition"
        >
          播放
        </button>
        <button
          v-if="playState === 'playing'"
          class="px-3 py-1.5 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
          @click="pause"
        >
          暂停
        </button>
        <button
          v-if="playState === 'paused'"
          class="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
          @click="resume"
        >
          继续
        </button>
        <button
          v-if="playState === 'playing' || playState === 'paused'"
          class="px-3 py-1.5 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
          @click="stopDemo"
        >
          停止
        </button>
        <template v-if="audioUrl">
          <audio ref="audioRef" :src="audioUrl" controls class="max-w-xs h-8" />
          <span class="text-gray-800 text-sm">{{ audioTimeDisplay }}</span>
        </template>
      </div>
      <div
        v-if="lyricsDiff && liveTemplate"
        class="flex items-center gap-1 border-l pl-2 ml-1 flex-wrap"
        data-demo-tutorial="demo-lyrics-fix"
      >
        <span class="text-xs text-gray-500 mr-1">歌词修复</span>
        <button
          type="button"
          class="px-2 py-1 text-xs rounded border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 disabled:opacity-40"
          :disabled="!canApplyLyricsFix"
          title="按 lyrics_raw 修正与谱面不一致的字（标黄 diff）"
          @click="applyLyricsFix('wrong')"
        >
          修错
        </button>
        <button
          type="button"
          class="px-2 py-1 text-xs rounded border border-red-300 bg-red-50 text-red-900 hover:bg-red-100 disabled:opacity-40"
          :disabled="!canApplyLyricsFix"
          title="补上谱面相对 raw 缺失的字（标红 extra_in_raw）"
          @click="applyLyricsFix('missing')"
        >
          修漏
        </button>
        <button
          type="button"
          class="px-2 py-1 text-xs rounded border border-blue-300 bg-blue-50 text-blue-900 hover:bg-blue-100 disabled:opacity-40"
          :disabled="!canApplyLyricsFix"
          title="删掉谱面相对 raw 多出的字（标蓝 extra_in_score）"
          @click="applyLyricsFix('extra')"
        >
          修多
        </button>
        <button
          type="button"
          class="px-2 py-1 text-xs rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          :disabled="!canUndoLyricsFix"
          title="撤销上一次歌词修复"
          @click="undoLyricsFix"
        >
          撤销
        </button>
      </div>
      <span v-if="error" class="text-red-600 text-sm">{{ error }}</span>
    </header>

    <div class="flex flex-1 min-h-[50vh] overflow-hidden">
      <aside
        class="w-56 flex-shrink-0 bg-white border-r overflow-y-auto min-h-0"
        data-demo-tutorial="demo-catalog"
      >
        <div v-if="loading" class="p-4 text-gray-500 text-sm">加载中...</div>
        <div v-else-if="!catalog.length" class="p-4 text-gray-500 text-sm">暂无数据</div>
        <div v-else class="py-2">
          <div
            v-for="(songs, artist) in catalogByArtist"
            :key="artist"
            class="border-b border-gray-100"
          >
            <div class="px-3 py-2 font-medium text-gray-700 bg-gray-50">
              {{ artist || '未知歌手' }}
            </div>
            <button
              v-for="item in songs"
              :key="item.hashname"
              class="w-full px-4 py-2 text-left text-sm hover:bg-blue-50"
              :class="{ 'bg-blue-100': selectedHashname === item.hashname }"
              @click="handleSelectSong(item)"
            >
              {{ item.title || item.hashname }}
            </button>
          </div>
        </div>
      </aside>

      <main class="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
        <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div class="flex-1 min-h-0 flex overflow-hidden">
            <div
              id="auto-scroll-container"
              class="flex-1 min-h-0 overflow-auto bg-white p-4 min-w-0"
              data-demo-tutorial="demo-score"
            >
              <div ref="containerRef" class="min-h-[400px] w-full"></div>
            </div>
            <div
              class="flex-shrink-0 min-h-0 min-w-0 flex"
              data-demo-tutorial="demo-lyrics-panel"
            >
              <LyricsDiffPanel
                :lyrics-diff="lyricsDiffLive"
                :score-lyric-text="scoreLyricTextForPanel"
                :current-note-index="lyricsCursorNoteIndex"
                :show-playback-cursor="playState === 'playing' || playState === 'paused'"
              />
            </div>
          </div>

          <div
            class="flex-shrink-0 border-t border-gray-200 bg-white flex flex-col shadow-[0_-4px_12px_rgba(0,0,0,0.06)]"
            data-demo-tutorial="demo-editor"
          >
            <button
              type="button"
              class="w-full px-3 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 flex items-center justify-between gap-2"
              @click="editorPanelExpanded = !editorPanelExpanded"
            >
              <span class="font-medium">简谱 / 歌词编辑</span>
              <span class="text-gray-500">{{ editorPanelExpanded ? '收起 ▼' : '展开 ▲' }}</span>
            </button>
            <div
              class="overflow-hidden transition-[max-height] duration-200 ease-out"
              :class="editorPanelExpanded ? 'max-h-[min(42vh,360px)]' : 'max-h-0'"
            >
              <div
                class="flex h-[min(42vh,360px)] gap-2 p-2 pt-0 border-t border-gray-100 min-h-0"
              >
                <div class="flex-1 flex flex-col min-w-0 min-h-0 border border-gray-200 rounded overflow-hidden bg-white">
                  <div class="text-xs px-2 py-1.5 bg-gray-100 text-gray-700 flex-shrink-0">简谱</div>
                  <div ref="scoreEditorMountRef" class="flex-1 min-h-0 demo-cm-host"></div>
                </div>
                <div class="flex-1 flex flex-col min-w-0 min-h-0 border border-gray-200 rounded overflow-hidden bg-white">
                  <div class="text-xs px-2 py-1.5 bg-gray-100 text-gray-700 flex-shrink-0">歌词</div>
                  <div ref="lyricEditorMountRef" class="flex-1 min-h-0 demo-cm-host"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <Teleport to="body">
      <div
        v-if="tutorialOpen"
        class="fixed inset-0 z-[200] touch-none"
        aria-modal="true"
        role="dialog"
        :aria-labelledby="'demo-tutorial-title'"
      >
        <div
          class="absolute inset-0 bg-transparent"
          aria-hidden="true"
          @click.prevent
          @wheel.prevent
          @touchmove.prevent
        />
        <div
          v-if="tutorialSpotlightStyle"
          class="fixed z-[201] pointer-events-none rounded-lg ring-2 ring-teal-400 ring-offset-2 ring-offset-transparent transition-[top,left,width,height] duration-200 ease-out"
          :style="tutorialSpotlightStyle"
        />
        <div
          class="fixed z-[202] w-[min(92vw,22rem)] rounded-xl border border-gray-200 bg-white p-4 shadow-xl"
          :style="tutorialCardStyle"
        >
          <p id="demo-tutorial-title" class="text-sm font-semibold text-gray-900">
            {{ tutorialCurrentStep?.title }}
          </p>
          <p class="mt-2 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
            {{ tutorialCurrentStep?.body }}
          </p>
          <p
            v-if="tutorialMissingTarget"
            class="mt-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1"
          >
            当前界面未显示该区域，可直接「下一步」继续。
          </p>
          <div class="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              class="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
              @click="closeTutorial"
            >
              关闭
            </button>
            <button
              v-if="tutorialStepIndex > 0"
              type="button"
              class="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
              @click="tutorialPrev"
            >
              上一步
            </button>
            <button
              type="button"
              class="px-3 py-1.5 text-sm bg-teal-600 text-white rounded hover:bg-teal-700"
              @click="tutorialNext"
            >
              {{ tutorialStepIndex >= tutorialSteps.length - 1 ? '完成' : '下一步' }}
            </button>
          </div>
          <p class="mt-2 text-center text-xs text-gray-400">
            {{ tutorialStepIndex + 1 }} / {{ tutorialSteps.length }}
          </p>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  SimpleNotation,
  SNPointerLayer,
  SNTransition,
  SNRuntime,
  SNDataType,
  type SNTemplate,
} from 'simple-notation';
import { usePlayer, useDemoData, useTone, useAudioSync, type CatalogItem } from '@/use';
import LyricsDiffPanel from '@/components/LyricsDiffPanel.vue';
import { computeLyricsDiff } from '@/utils/computeLyricsDiff';
import { applyScoreLyricFixFromRaw, type LyricsFixMode } from '@/utils/applyLyricsFixFromRaw';
import { buildLyricDiffPaint } from '@/utils/lyricsDiffScorePaint';
import {
  mergedScoreOffsetToLyricDocOffset,
  scoreOffsetAtNoteStart,
} from '@/utils/lyricsPlaybackCursor';
import { snapdom } from '@zumer/snapdom';
import JSZip from 'jszip';
import { EditorState, StateEffect, StateField, Transaction } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  lineNumbers,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';

defineOptions({
  name: 'Demo',
});

type DemoTutorialStep = {
  target: string;
  title: string;
  body: string;
};

const tutorialSteps: DemoTutorialStep[] = [
  {
    target: 'demo-connect',
    title: '服务与批次',
    body:
      '填写后端数据目录的服务根 URL（开发环境常用代理路径），点「连接」加载 manifest；在「选择批次」里切换不同 output 批次，目录下列表会随之更新。',
  },
  {
    target: 'demo-export',
    title: '导出 JPG',
    body:
      '在已选曲目且谱面加载完成后，可将当前谱面按 A4 可印区导出为 JPG；多页时打包为 ZIP。导出过程中会短暂切换固定宽度版式，完成后自动恢复。',
  },
  {
    target: 'demo-playback',
    title: '播放与音频',
    body:
      '用「播放 / 暂停 / 继续 / 停止」控制跟谱；有音频时会显示控件与时间。空格键可在非输入框区域快速切换播放/暂停（谱面可同步高亮当前音）。',
  },
  {
    target: 'demo-lyrics-fix',
    title: '歌词修复',
    body:
      '在存在 lyrics diff 且已打开谱面时可用：「修错 / 修漏 / 修多」按 raw 对齐谱面歌词；「撤销」可还原上一次修改。具体对应关系见各按钮的 title 提示。',
  },
  {
    target: 'demo-catalog',
    title: '曲目列表',
    body:
      '左侧按歌手分组列出当前批次内曲目；点击条目加载该曲模板，谱面与（若有）歌词审核区会更新。支持通过路由 query 深链到指定歌曲。',
  },
  {
    target: 'demo-score',
    title: '简谱主视图',
    body:
      '中间区域渲染可交互简谱，支持缩放适配容器。点击音符可定位播放进度并同步歌词光标；可与底部编辑器、右侧审核区联动。',
  },
  {
    target: 'demo-lyrics-panel',
    title: '歌词审核侧栏',
    body:
      '在服务端提供歌词 diff 数据且当前曲已加载时显示：对照 raw 与谱面歌词的差异（标色），播放时可有光标跟随。可切换深/浅色阅读。',
  },
  {
    target: 'demo-editor',
    title: '简谱 / 歌词编辑',
    body:
      '点击标题栏展开底部双栏编辑器：左侧简谱文本、右侧歌词文本，修改会实时回写谱面。播放时编辑器内可显示只读播放光标位置。',
  },
];

const tutorialOpen = ref(false);
const tutorialStepIndex = ref(0);
const tutorialSpotlightStyle = ref<Record<string, string> | null>(null);
const tutorialCardStyle = ref<Record<string, string>>({});
const tutorialMissingTarget = ref(false);

const tutorialCurrentStep = computed(() => tutorialSteps[tutorialStepIndex.value] ?? null);

function queryTutorialEl(target: string): HTMLElement | null {
  return document.querySelector(`[data-demo-tutorial="${target}"]`) as HTMLElement | null;
}

function positionTutorialCardCenter() {
  tutorialCardStyle.value = {
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  };
}

function positionTutorialCardNearRect(r: DOMRect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(vw * 0.92, 22 * 16);
  const approxH = 200;
  const margin = 12;
  let top = r.bottom + margin;
  if (top + approxH > vh - margin) {
    top = r.top - approxH - margin;
  }
  top = Math.max(margin, Math.min(top, vh - approxH - margin));
  let left = r.left + r.width / 2 - cardW / 2;
  left = Math.max(margin, Math.min(left, vw - cardW - margin));
  tutorialCardStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    transform: 'none',
  };
}

function measureTutorialStep() {
  if (!tutorialOpen.value) return;
  const step = tutorialSteps[tutorialStepIndex.value];
  if (!step) return;
  const el = queryTutorialEl(step.target);
  const pad = 8;
  if (!el) {
    tutorialSpotlightStyle.value = null;
    tutorialMissingTarget.value = true;
    positionTutorialCardCenter();
    return;
  }
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const apply = () => {
    const r = el.getBoundingClientRect();
    if (r.width < 4 && r.height < 4) {
      tutorialSpotlightStyle.value = null;
      tutorialMissingTarget.value = true;
      positionTutorialCardCenter();
      return;
    }
    tutorialMissingTarget.value = false;
    tutorialSpotlightStyle.value = {
      top: `${r.top - pad}px`,
      left: `${r.left - pad}px`,
      width: `${r.width + pad * 2}px`,
      height: `${r.height + pad * 2}px`,
      boxShadow: '0 0 0 9999px rgba(0,0,0,0.52)',
    };
    positionTutorialCardNearRect(r);
  };
  requestAnimationFrame(() => requestAnimationFrame(apply));
}

function startTutorial() {
  tutorialStepIndex.value = 0;
  tutorialOpen.value = true;
}

function closeTutorial() {
  tutorialOpen.value = false;
  tutorialSpotlightStyle.value = null;
}

function tutorialNext() {
  if (tutorialStepIndex.value >= tutorialSteps.length - 1) {
    closeTutorial();
    return;
  }
  tutorialStepIndex.value += 1;
}

function tutorialPrev() {
  if (tutorialStepIndex.value <= 0) return;
  tutorialStepIndex.value -= 1;
}

let tutorialScrollEl: HTMLElement | null = null;

function onTutorialLayoutEvent() {
  measureTutorialStep();
}

function tutorialKeydown(e: KeyboardEvent) {
  if (!tutorialOpen.value) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    closeTutorial();
  }
}

function attachTutorialListeners() {
  window.addEventListener('resize', onTutorialLayoutEvent);
  window.addEventListener('keydown', tutorialKeydown);
  tutorialScrollEl = document.getElementById('auto-scroll-container');
  tutorialScrollEl?.addEventListener('scroll', onTutorialLayoutEvent, { passive: true });
}

function detachTutorialListeners() {
  window.removeEventListener('resize', onTutorialLayoutEvent);
  window.removeEventListener('keydown', tutorialKeydown);
  tutorialScrollEl?.removeEventListener('scroll', onTutorialLayoutEvent);
  tutorialScrollEl = null;
}

watch(tutorialOpen, (open) => {
  if (open) {
    void nextTick(() => {
      attachTutorialListeners();
      measureTutorialStep();
    });
  } else {
    detachTutorialListeners();
  }
});

watch(tutorialStepIndex, () => {
  if (tutorialOpen.value) {
    measureTutorialStep();
  }
});

const route = useRoute();
const router = useRouter();
const { catalog, loading, error, batches, dataDir, lyricsDiff, loadManifest, loadCatalog, loadSong } = useDemoData();
const {
  play,
  pause,
  resume,
  stop,
  reset,
  reloadPlayerNotesFromRuntime,
  playState,
  seekToIndex,
  setCurrentIndex,
  getPlayerCurrentIndex,
  getNotes,
  getTimeMsForNoteIndex,
  getNoteIndexForTimeMs,
} = usePlayer();
const { setTranspose } = useTone();
const {
  audioRef,
  audioTimeDisplay,
  setupAudioListeners,
  syncAudioToSheetSeek,
  setupSync,
  setupAudioDrivenSheetSync,
} = useAudioSync();

const serverRoot = ref(
  (import.meta.env.VITE_DEMO_BASE_URL as string) ||
    (import.meta.env.DEV ? '/api/demo' : 'http://localhost:8000'),
);
const selectedBatch = ref('');
const containerRef = ref<HTMLDivElement | null>(null);
const sn = ref<SimpleNotation | null>(null);
const selectedHashname = ref<string | null>(null);
/** 用户点击谱面音符后的目标位置；与「仅滚动」区分，避免误用视口首音符 */
const lastExplicitSeekNoteIndex = ref<number | null>(null);
/** 当前可编辑的模板数据，与谱面 loadData 同源；选曲与底部编辑器共用 */
const liveTemplate = ref<SNTemplate | null>(null);
const scoreLyricTextForPanel = computed(() => liveTemplate.value?.lyric ?? '');
/** 随谱面歌词编辑重算 diff，与 lyrics_diff.json 中 raw 结构对比 */
const lyricsDiffLive = computed(() => {
  const base = lyricsDiff.value;
  if (!base) return null;
  return computeLyricsDiff(
    base.lyrics_raw_items.map((it) => ({ content: it.content, type: it.type })),
    scoreLyricTextForPanel.value,
  );
});
/** 歌词审核区播放光标（1-based 音符序号，与谱面指针一致） */
const lyricsCursorNoteIndex = ref(1);

const canApplyLyricsFix = computed(
  () => !!(lyricsDiff.value && liveTemplate.value?.lyric != null),
);

const lyricFixUndoStack = ref<string[]>([]);

const canUndoLyricsFix = computed(
  () => lyricFixUndoStack.value.length > 0 && liveTemplate.value?.lyric != null,
);

function applyLyricsFix(mode: LyricsFixMode) {
  const base = lyricsDiff.value;
  const tmpl = liveTemplate.value;
  if (!base || tmpl?.lyric == null) return;
  lyricFixUndoStack.value.push(tmpl.lyric);
  const nextLyric = applyScoreLyricFixFromRaw(
    tmpl.lyric,
    base.lyrics_raw_items.map((it) => ({ content: it.content, type: it.type })),
    mode,
  );
  liveTemplate.value = { ...tmpl, lyric: nextLyric };
  loadLiveTemplateToScore();
}

function undoLyricsFix() {
  const prev = lyricFixUndoStack.value.pop();
  const tmpl = liveTemplate.value;
  if (prev === undefined || !tmpl) return;
  liveTemplate.value = { ...tmpl, lyric: prev };
  loadLiveTemplateToScore();
}

function templateWithLyricDiffPaint(tmpl: SNTemplate): SNTemplate {
  const base = lyricsDiff.value;
  if (!base) return tmpl;
  const diff = computeLyricsDiff(
    base.lyrics_raw_items.map((it) => ({ content: it.content, type: it.type })),
    tmpl.lyric ?? '',
  );
  return {
    ...tmpl,
    lyricDiffPaint: buildLyricDiffPaint(diff, tmpl.lyric ?? ''),
  };
}

function loadLiveTemplateToScore() {
  if (!sn.value || !liveTemplate.value) return;
  sn.value.loadData(templateWithLyricDiffPaint(liveTemplate.value));
  reloadPlayerNotesFromRuntime();
}

const exportJpgBusy = ref(false);

const currentSongTitle = computed(() => {
  const hash = selectedHashname.value;
  if (!hash) return '';
  const fromCatalog = catalog.value.find((c) => c.hashname === hash);
  if (fromCatalog?.title) return fromCatalog.title;
  const infoTitle = liveTemplate.value?.info?.title;
  if (typeof infoTitle === 'string' && infoTitle) return infoTitle;
  return hash;
});

const canExportJpg = computed(
  () => !!(selectedHashname.value && liveTemplate.value && containerRef.value),
);

function sanitizeFilenameSegment(name: string): string {
  const s = name.replace(/[/\\:*?"<>|]/g, '_').trim();
  return s || '未命名';
}

/** 与 packages/cli/src/index.ts 默认 `-w` 一致，且 pdf.ts 中 SimpleNotation 使用 resize: false */
const CLI_EXPORT_SCORE_WIDTH_PX = 800;

/**
 * A4 整页；左右 10mm、上下 3mm；可印区内谱面顶对齐、水平居中。
 * 分页高度 = 可印区 + 约 2 行（EXPORT_EXTRA_STAVE_ROWS×85px），一页多排约两行谱。
 */
const A4_MM = { w: 210, h: 297 };
const PDF_MARGIN_LR_MM = 10;
const PDF_MARGIN_TB_MM = 3;
const EXPORT_PX_PER_MM = (96 * 2) / 25.4;

const A4_PAGE_PX = {
  w: Math.round(A4_MM.w * EXPORT_PX_PER_MM),
  h: Math.round(A4_MM.h * EXPORT_PX_PER_MM),
};
const PDF_MARGIN_L_PX = Math.round(PDF_MARGIN_LR_MM * EXPORT_PX_PER_MM);
const PDF_MARGIN_R_PX = Math.round(PDF_MARGIN_LR_MM * EXPORT_PX_PER_MM);
const PDF_MARGIN_T_PX = Math.round(PDF_MARGIN_TB_MM * EXPORT_PX_PER_MM);
const PDF_MARGIN_B_PX = Math.round(PDF_MARGIN_TB_MM * EXPORT_PX_PER_MM);
const A4_INNER_PX = {
  w: A4_PAGE_PX.w - PDF_MARGIN_L_PX - PDF_MARGIN_R_PX,
  h: A4_PAGE_PX.h - PDF_MARGIN_T_PX - PDF_MARGIN_B_PX,
};

/** 可印区高度（@96dpi）+ 约 2 行，与默认行高 lineHeight+lineSpace+lyricHeight(85) 一致 */
const EXPORT_STAVE_ROW_HEIGHT_PX = 85;
const EXPORT_EXTRA_STAVE_ROWS = 2;
const EXPORT_PAGE_CONTENT_HEIGHT_PX =
  Math.round(((A4_MM.h - 2 * PDF_MARGIN_TB_MM) / 25.4) * 96) +
  EXPORT_EXTRA_STAVE_ROWS * EXPORT_STAVE_ROW_HEIGHT_PX;

function templateWithoutLyricDiffPaint(tmpl: SNTemplate): SNTemplate {
  const c = JSON.parse(JSON.stringify(tmpl)) as SNTemplate;
  delete c.lyricDiffPaint;
  return c;
}

function collectPageBounds(sheet: HTMLElement): number[] {
  const sheetRect = sheet.getBoundingClientRect();
  const ys: number[] = [0];
  sheet.querySelectorAll('[sn-tag="break-line"]').forEach((el) => {
    ys.push(el.getBoundingClientRect().top - sheetRect.top);
  });
  ys.sort((a, b) => a - b);
  const pageBounds = [...new Set(ys)].sort((a, b) => a - b);
  const tail = sheet.scrollHeight;
  if (pageBounds[pageBounds.length - 1] !== tail) {
    pageBounds.push(tail);
  }
  return pageBounds;
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('toBlob failed'));
        else resolve(blob);
      },
      'image/jpeg',
      0.92,
    );
  });
}

function sliceScorePageToCanvas(
  fullCanvas: HTMLCanvasElement,
  sheetOffsetWidth: number,
  pageBounds: number[],
  pageIndex: number,
): HTMLCanvasElement | null {
  const startY = pageBounds[pageIndex];
  const endY = pageBounds[pageIndex + 1];
  const segmentHeight = endY - startY;
  if (segmentHeight <= 0) return null;

  const scaleFactor = fullCanvas.width / sheetOffsetWidth;
  const scaledSegmentHeight = segmentHeight * scaleFactor;
  const scaledStartY = startY * scaleFactor;

  const pageCanvas = document.createElement('canvas');
  const ctx = pageCanvas.getContext('2d');
  if (!ctx) return null;

  pageCanvas.width = fullCanvas.width;
  pageCanvas.height = scaledSegmentHeight;
  ctx.drawImage(
    fullCanvas,
    0,
    scaledStartY,
    fullCanvas.width,
    scaledSegmentHeight,
    0,
    0,
    pageCanvas.width,
    pageCanvas.height,
  );
  return pageCanvas;
}

/** 将谱面条带缩放入 A4 可印区，白底整页；顶对齐、水平居中 */
function scaleSliceToA4PdfPage(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = A4_PAGE_PX.w;
  out.height = A4_PAGE_PX.h;
  const ctx = out.getContext('2d');
  if (!ctx) return source;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);

  const sw = source.width;
  const sh = source.height;
  const scale = Math.min(A4_INNER_PX.w / sw, A4_INNER_PX.h / sh);
  const dw = Math.round(sw * scale);
  const dh = Math.round(sh * scale);
  const dx = PDF_MARGIN_L_PX + Math.round((A4_INNER_PX.w - dw) / 2);
  const dy = PDF_MARGIN_T_PX;
  ctx.drawImage(source, 0, 0, sw, sh, dx, dy, dw, dh);
  return out;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.click();
  URL.revokeObjectURL(url);
}

async function exportScoreJpg() {
  const scrollEl = document.getElementById('auto-scroll-container');
  const sheet = containerRef.value;
  const inst = sn.value;
  const tmpl = liveTemplate.value;
  if (!scrollEl || !sheet || !inst || !tmpl || !canExportJpg.value) return;

  exportJpgBusy.value = true;

  const savedScroll = scrollEl.scrollTop;
  const savedContainerWidth = sheet.clientWidth;

  const savedOverflow = scrollEl.style.overflow;
  const savedMaxHeight = scrollEl.style.maxHeight;
  const savedSheetBg = sheet.style.backgroundColor;
  const savedSheetScheme = sheet.style.colorScheme;

  let didApplyExportLayout = false;

  try {
    await document.fonts.ready;

    inst.updateOptions({ resize: false });
    inst.resetOptions({
      width: CLI_EXPORT_SCORE_WIDTH_PX,
      resize: false,
      score: { pageContentHeightPx: EXPORT_PAGE_CONTENT_HEIGHT_PX },
    });
    didApplyExportLayout = true;
    inst.loadData(templateWithoutLyricDiffPaint(tmpl), SNDataType.TEMPLATE);

    await nextTick();
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await document.fonts.ready;

    scrollEl.scrollTop = 0;
    await nextTick();
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const pageBounds = collectPageBounds(sheet);
    const numPages = Math.max(1, pageBounds.length - 1);

    scrollEl.style.overflow = 'visible';
    scrollEl.style.maxHeight = 'none';
    sheet.style.backgroundColor = '#ffffff';
    sheet.style.colorScheme = 'light';

    let fullCanvas: HTMLCanvasElement | null = null;
    try {
      const result = await snapdom(sheet, {
        embedFonts: false,
        scale: 2,
        backgroundColor: '#ffffff',
      });
      fullCanvas = await result.toCanvas();
    } finally {
      scrollEl.style.overflow = savedOverflow;
      scrollEl.style.maxHeight = savedMaxHeight;
      sheet.style.backgroundColor = savedSheetBg;
      sheet.style.colorScheme = savedSheetScheme;
    }

    if (!fullCanvas) return;

    const baseName = sanitizeFilenameSegment(currentSongTitle.value);
    const w = sheet.offsetWidth;

    if (numPages <= 1) {
      const slice = sliceScorePageToCanvas(fullCanvas, w, pageBounds, 0);
      if (!slice) return;
      const pageCanvas = scaleSliceToA4PdfPage(slice);
      const blob = await canvasToJpegBlob(pageCanvas);
      triggerBlobDownload(blob, `${baseName}_1.jpg`);
    } else {
      const zip = new JSZip();
      for (let i = 0; i < numPages; i++) {
        const slice = sliceScorePageToCanvas(fullCanvas, w, pageBounds, i);
        if (!slice) continue;
        const pageCanvas = scaleSliceToA4PdfPage(slice);
        const blob = await canvasToJpegBlob(pageCanvas);
        zip.file(`${baseName}_${i + 1}.jpg`, blob);
      }
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });
      triggerBlobDownload(zipBlob, `${baseName}_简谱页.zip`);
    }
  } catch (e) {
    console.error(e);
    error.value = e instanceof Error ? e.message : '导出 JPG 失败';
  } finally {
    if (didApplyExportLayout) {
      try {
        const w = Math.max(1, savedContainerWidth);
        inst.resetOptions({ width: w });
        inst.updateOptions({ resize: true });
        inst.loadData(templateWithLyricDiffPaint(tmpl), SNDataType.TEMPLATE);
        scrollEl.scrollTop = savedScroll;
        await nextTick();
      } catch (re) {
        console.error(re);
      }
    }
    exportJpgBusy.value = false;
  }
}

const editorPanelExpanded = ref(false);
const scoreEditorMountRef = ref<HTMLDivElement | null>(null);
const lyricEditorMountRef = ref<HTMLDivElement | null>(null);
let scoreEditorView: EditorView | null = null;
let lyricEditorView: EditorView | null = null;

const setDemoPlaybackCursorEffect = StateEffect.define<{ from: number; active: boolean } | null>();

class DemoPlaybackCursorWidget extends WidgetType {
  toDOM() {
    const el = document.createElement('span');
    el.className = 'cm-demo-playback-cursor';
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText =
      'display:inline-block;width:0;border-left:3px solid rgba(0,191,255,0.45);min-height:1.15em;vertical-align:text-bottom;pointer-events:none;';
    return el;
  }
  ignoreEvent() {
    return true;
  }
  eq() {
    return true;
  }
}

const demoPlaybackCursorField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(value, tr) {
    value = value.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setDemoPlaybackCursorEffect)) {
        const spec = e.value;
        if (!spec || !spec.active) {
          return Decoration.none;
        }
        const from = Math.min(Math.max(0, spec.from), tr.state.doc.length);
        const w = Decoration.widget({
          widget: new DemoPlaybackCursorWidget(),
          side: 0,
        });
        return Decoration.set([w.range(from)]);
      }
    }
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

function computeDemoPlaybackScoreFrom(): number {
  const noteIdx = lyricsCursorNoteIndex.value;
  const notes = getNotes();
  if (!notes.length || noteIdx < 1) return 0;
  const i = Math.min(noteIdx, notes.length) - 1;
  return notes[i].startPosition ?? 0;
}

function computeDemoPlaybackLyricFrom(): number {
  const lyric = liveTemplate.value?.lyric ?? '';
  const noteIdx = lyricsCursorNoteIndex.value;
  if (!lyric || noteIdx < 1) return 0;
  const mergedOff = scoreOffsetAtNoteStart(SNRuntime.splitLyrics, noteIdx);
  return mergedScoreOffsetToLyricDocOffset(lyric, mergedOff);
}

function syncDemoPlaybackCursorToEditors() {
  const show = playState.value === 'playing' || playState.value === 'paused';
  if (scoreEditorView) {
    scoreEditorView.dispatch({
      effects: setDemoPlaybackCursorEffect.of(
        show ? { from: computeDemoPlaybackScoreFrom(), active: true } : null,
      ),
    });
  }
  if (lyricEditorView) {
    lyricEditorView.dispatch({
      effects: setDemoPlaybackCursorEffect.of(
        show ? { from: computeDemoPlaybackLyricFrom(), active: true } : null,
      ),
    });
  }
}

const catalogBaseURL = computed(() => {
  const base = serverRoot.value?.trim().replace(/\/$/, '');
  const batch = selectedBatch.value;
  if (!base || !batch) return '';
  return `${base}/output/${batch}`;
});

const audioUrl = computed(() => {
  const base = catalogBaseURL.value;
  const hash = selectedHashname.value;
  if (!base || !hash) return '';
  return `${base}/${hash}/${hash}_fixed_tempo.mp3`;
});

const catalogByArtist = computed(() => {
  const map: Record<string, CatalogItem[]> = {};
  for (const item of catalog.value) {
    const key = item.artist || '未知歌手';
    if (!map[key]) map[key] = [];
    map[key].push(item);
  }
  return map;
});

function destroyDemoEditors() {
  scoreEditorView?.destroy();
  lyricEditorView?.destroy();
  scoreEditorView = null;
  lyricEditorView = null;
}

function initDemoEditors() {
  if (!scoreEditorMountRef.value || !lyricEditorMountRef.value) return;
  destroyDemoEditors();
  const tmpl = liveTemplate.value;
  const scoreDoc = tmpl?.score ?? '';
  const lyricDoc = tmpl?.lyric ?? '';

  scoreEditorView = new EditorView({
    state: EditorState.create({
      doc: scoreDoc,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of(historyKeymap),
        keymap.of(defaultKeymap),
        keymap.of([indentWithTab]),
        demoPlaybackCursorField,
        EditorView.updateListener.of((update: ViewUpdate) => {
          if (!update.docChanged || !liveTemplate.value) return;
          const newScore = update.state.doc.toString();
          if (liveTemplate.value.score !== newScore) {
            liveTemplate.value = { ...liveTemplate.value, score: newScore };
            loadLiveTemplateToScore();
          }
        }),
      ],
    }),
    parent: scoreEditorMountRef.value,
  });

  lyricEditorView = new EditorView({
    state: EditorState.create({
      doc: lyricDoc,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of(historyKeymap),
        keymap.of(defaultKeymap),
        keymap.of([indentWithTab]),
        demoPlaybackCursorField,
        EditorView.updateListener.of((update: ViewUpdate) => {
          if (!update.docChanged || !liveTemplate.value) return;
          const newLyric = update.state.doc.toString();
          if ((liveTemplate.value.lyric ?? '') !== newLyric) {
            liveTemplate.value = { ...liveTemplate.value, lyric: newLyric };
            loadLiveTemplateToScore();
          }
        }),
      ],
    }),
    parent: lyricEditorMountRef.value,
  });
  void nextTick(() => syncDemoPlaybackCursorToEditors());
}

watch(
  () => liveTemplate.value?.score,
  (newScore) => {
    if (
      scoreEditorView &&
      newScore !== undefined &&
      newScore !== scoreEditorView.state.doc.toString()
    ) {
      scoreEditorView.dispatch({
        changes: { from: 0, to: scoreEditorView.state.doc.length, insert: newScore },
        annotations: Transaction.addToHistory.of(false),
      });
    }
  },
);

watch(
  () => liveTemplate.value?.lyric,
  (newLyric) => {
    const n = newLyric ?? '';
    if (lyricEditorView && n !== lyricEditorView.state.doc.toString()) {
      lyricEditorView.dispatch({
        changes: { from: 0, to: lyricEditorView.state.doc.length, insert: n },
        annotations: Transaction.addToHistory.of(false),
      });
    }
  },
);

watch(editorPanelExpanded, async (open) => {
  if (!open) return;
  await nextTick();
  if (!scoreEditorMountRef.value || !lyricEditorMountRef.value) return;
  if (!scoreEditorView) initDemoEditors();
  else void nextTick(() => syncDemoPlaybackCursorToEditors());
});

watch(
  () => [lyricsCursorNoteIndex.value, playState.value, liveTemplate.value?.lyric] as const,
  () => {
    void nextTick(() => syncDemoPlaybackCursorToEditors());
  },
);

const handleConnect = async () => {
  if (!serverRoot.value.trim()) return;
  error.value = null;
  const ok = await loadManifest(serverRoot.value.trim());
  if (!ok || !batches.value.length) {
    error.value = ok ? '暂无批次数据' : '未找到 manifest.json，请先运行 serve_data_dir';
    return;
  }
  selectedBatch.value = batches.value[0];
  await handleBatchChange();
};

const handleBatchChange = async () => {
  if (!selectedBatch.value) return;
  selectedHashname.value = null;
  lyricFixUndoStack.value = [];
  stopDemo();
  liveTemplate.value = null;
  destroyDemoEditors();
  if (editorPanelExpanded.value) {
    await nextTick();
    initDemoEditors();
  }
  await loadCatalog(catalogBaseURL.value);
};

const handleSelectSong = async (item: CatalogItem) => {
  selectedHashname.value = item.hashname;
  router.replace({
    path: '/demo',
    query: { artist: item.artist || undefined, title: item.title || undefined },
  });
  stopDemo();
  lyricFixUndoStack.value = [];
  const data = await loadSong(catalogBaseURL.value, item.hashname);
  if (data && sn.value) {
    liveTemplate.value = JSON.parse(JSON.stringify(data)) as SNTemplate;
    lyricsCursorNoteIndex.value = 1;
    loadLiveTemplateToScore();
    reset(); // 重建 player 以从 SNRuntime 读取新谱面音符
    const key = data.info?.key as string | undefined;
    const transposeValue = key
      ? SNTransition.General.getTransposeByKey(key)
      : 0;
    setTranspose(transposeValue);
    await nextTick();
    setupAudioListeners(() => stopDemo(), (timeMs) => {
      lastExplicitSeekNoteIndex.value = null;
      const noteIndex = getNoteIndexForTimeMs(timeMs);
      lyricsCursorNoteIndex.value = noteIndex;
      setCurrentIndex(noteIndex - 1);
      SNPointerLayer.showPointer(`note-${noteIndex}`);
    });
  }
};

function getFirstVisibleNoteIndexInViewport(): number | null {
  const container = document.getElementById('auto-scroll-container');
  if (!container) return null;
  const cr = container.getBoundingClientRect();
  const nodes = container.querySelectorAll('[sn-tag^="note-"]');
  for (const node of nodes) {
    const tag = node.getAttribute('sn-tag');
    const r = node.getBoundingClientRect();
    if (r.bottom <= cr.top || r.top >= cr.bottom) continue;
    const m = tag?.match(/^note-(\d+)$/);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

const playFromCurrentPosition = async () => {
  if (playState.value !== 'idle') {
    await play();
    return;
  }
  const el = audioRef.value;
  const audioMs = (el?.currentTime ?? 0) * 1000;
  const playerIdx = getPlayerCurrentIndex();

  let note1Based: number;
  if (audioMs > 1) {
    note1Based = getNoteIndexForTimeMs(audioMs);
  } else if (lastExplicitSeekNoteIndex.value != null) {
    note1Based = lastExplicitSeekNoteIndex.value;
  } else if (playerIdx > 0) {
    note1Based = playerIdx + 1;
  } else {
    note1Based = getFirstVisibleNoteIndexInViewport() ?? 1;
  }

  await seekToIndex(note1Based);
  lyricsCursorNoteIndex.value = note1Based;
  const timeMs = getTimeMsForNoteIndex(note1Based);
  syncAudioToSheetSeek(timeMs, false);
  await nextTick();
  await play();
};

const stopDemo = () => {
  lastExplicitSeekNoteIndex.value = null;
  lyricsCursorNoteIndex.value = 1;
  stop();
};

const handleNoteClick = (noteIndex: number) => {
  lastExplicitSeekNoteIndex.value = noteIndex;
  lyricsCursorNoteIndex.value = noteIndex;
  const timeMs = getTimeMsForNoteIndex(noteIndex);
  const playing = playState.value === 'playing';
  syncAudioToSheetSeek(timeMs, playing);
  seekToIndex(noteIndex);
};

const initSn = () => {
  if (!containerRef.value) return;
  sn.value = new SimpleNotation(containerRef.value, { resize: true });
  sn.value?.on('note:click', (event) => {
    handleNoteClick(event.detail.index);
  });
};

const handleKeydown = (e: KeyboardEvent) => {
  if (e.code !== 'Space') return;
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
  if (target.closest('.cm-editor')) return;
  e.preventDefault();
  if (playState.value === 'playing') {
    pause();
  } else if (playState.value === 'paused') {
    resume();
  } else if (playState.value === 'idle' && selectedHashname.value) {
    playFromCurrentPosition();
  }
};

onMounted(() => {
  initSn();
  handleConnect();
  setupSync(playState);
  setupAudioDrivenSheetSync(playState, (timeMs) => {
    const noteIndex = getNoteIndexForTimeMs(timeMs);
    lyricsCursorNoteIndex.value = noteIndex;
    setCurrentIndex(noteIndex - 1);
    SNPointerLayer.showPointer(`note-${noteIndex}`);
  });
  window.addEventListener('keydown', handleKeydown);
});

watch(
  () => catalog.value.length,
  () => {
    const q = route.query;
    if (q.artist !== undefined && q.title !== undefined && catalog.value.length) {
      const match = catalog.value.find(
        (c) =>
          (c.artist || '') === (q.artist as string) &&
          (c.title || '') === (q.title as string),
      );
      if (match && match.hashname !== selectedHashname.value) {
        handleSelectSong(match);
      }
    }
  },
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  destroyDemoEditors();
  sn.value?.destroy();
});
</script>

<style scoped>
.demo-cm-host :deep(.cm-editor) {
  height: 100%;
  font-size: 14px;
}
.demo-cm-host :deep(.cm-scroller) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
</style>

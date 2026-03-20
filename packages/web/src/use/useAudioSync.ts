import { ref, watch, onBeforeUnmount, type Ref } from 'vue';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * 谱面与音频播放器同步逻辑，参考 osmd-extended demo 中 jianpu 相关实现。
 * 支持：播放/暂停/停止状态同步，点击谱面 seek 时同步音频位置。
 * 支持：以音频为主时钟驱动谱面指针，避免 setTimeout 累积误差导致的 drift。
 */
export function useAudioSync() {
  const audioRef = ref<HTMLAudioElement | null>(null);
  const isSyncing = ref(false);
  /** 谱面→音频 seek 未完成：与 setupSync 的 isSyncing 分离，避免阻塞播放/暂停与 RAF 误读 currentTime */
  const sheetSeekSyncPending = ref(false);
  const ignoreNextSeeked = ref(false);
  const audioTimeDisplay = ref('0:00 / 0:00');
  let rafId: number | null = null;
  /** 每次谱面驱动 seek 递增，用于在快速连点时只响应最后一次 seeked */
  let sheetSeekToken = 0;

  const updateTimeDisplay = () => {
    const el = audioRef.value;
    if (!el) return;
    const cur = el.currentTime || 0;
    const dur = el.duration || 0;
    audioTimeDisplay.value = `${formatTime(cur)} / ${formatTime(dur)}`;
  };

  const setupAudioListeners = (
    onEnded?: () => void,
    onSeek?: (timeMs: number) => void,
  ) => {
    const el = audioRef.value;
    if (!el) return;
    const boundUpdateTimeDisplay = updateTimeDisplay;
    const boundOnSeeked = () => {
      if (ignoreNextSeeked.value) {
        ignoreNextSeeked.value = false;
        return;
      }
      onSeek?.(el.currentTime * 1000);
    };
    el.removeEventListener('timeupdate', boundUpdateTimeDisplay);
    el.removeEventListener('loadedmetadata', boundUpdateTimeDisplay);
    el.addEventListener('timeupdate', boundUpdateTimeDisplay);
    el.addEventListener('loadedmetadata', boundUpdateTimeDisplay);
    if (onEnded) {
      el.removeEventListener('ended', onEnded);
      el.addEventListener('ended', onEnded);
    }
    if (onSeek) {
      el.removeEventListener('seeked', boundOnSeeked);
      el.addEventListener('seeked', boundOnSeeked);
    }
  };

  /**
   * 将谱面 seek 位置同步到音频
   * @param timeMs 目标时间（毫秒）
   * @param shouldResume 是否在 seek 后继续播放
   */
  const syncAudioToSheetSeek = (timeMs: number, shouldResume: boolean) => {
    const el = audioRef.value;
    if (!el || !el.src) {
      console.warn('[audioSync] skip: no <audio> or src（未加载 mp3 时点击谱面不会同步进度条）', {
        hasEl: !!el,
        hasSrc: !!el?.src,
      });
      return;
    }

    const seekSec = timeMs / 1000;
    const dur = el.duration;
    const canSeek =
      Number.isFinite(dur) && dur > 0 && seekSec >= 0 && seekSec <= dur;

    if (!canSeek) {
      console.warn('[audioSync] skip seek: duration 未就绪或目标超出时长', {
        timeMs,
        seekSec,
        duration: dur,
        shouldResume,
      });
      ignoreNextSeeked.value = false;
      return;
    }

    sheetSeekSyncPending.value = true;
    ignoreNextSeeked.value = true;
    const token = ++sheetSeekToken;

    const releaseSync = () => {
      if (token !== sheetSeekToken) return;
      sheetSeekSyncPending.value = false;
    };

    const onSeeked = () => releaseSync();
    el.addEventListener('seeked', onSeeked, { once: true });
    window.setTimeout(() => {
      if (token === sheetSeekToken && sheetSeekSyncPending.value) {
        releaseSync();
      }
    }, 800);

    el.currentTime = seekSec;
    if (shouldResume) {
      el.play().catch((err) => console.warn('音频播放失败:', err));
    }
  };

  const setupSync = (playState: Ref<'idle' | 'playing' | 'paused'>) => {
    watch(
      playState,
      (state) => {
        const el = audioRef.value;
        if (isSyncing.value || !el || !el.src) return;

        isSyncing.value = true;
        if (state === 'playing') {
          if (el.paused) {
            el.play().catch((err) => console.warn('音频播放失败:', err));
          }
        } else {
          if (!el.paused) {
            el.pause();
          }
        }
        isSyncing.value = false;
      },
      { immediate: true },
    );
  };

  /**
   * 以音频为主时钟驱动谱面指针，保证谱面按 tempo 匀速与音频同步。
   * 使用 requestAnimationFrame 轮询 audio.currentTime，避免 SNPlayer 的 setTimeout 累积误差导致 drift。
   * @param playState 播放状态
   * @param onTimeUpdate 回调：根据当前时间(ms)更新谱面指针
   */
  const setupAudioDrivenSheetSync = (
    playState: Ref<'idle' | 'playing' | 'paused'>,
    onTimeUpdate: (timeMs: number) => void,
  ) => {
    const tick = () => {
      const el = audioRef.value;
      if (
        playState.value !== 'playing' ||
        !el ||
        !el.src ||
        el.paused ||
        el.ended
      ) {
        rafId = null;
        return;
      }
      // 正在执行谱面→音频 seek 时，currentTime 在 seeked 前可能仍为 0 或旧值，勿驱动谱面
      if (sheetSeekSyncPending.value) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      onTimeUpdate(el.currentTime * 1000);
      rafId = requestAnimationFrame(tick);
    };

    watch(
      playState,
      (state) => {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        if (state === 'playing' && audioRef.value?.src) {
          rafId = requestAnimationFrame(tick);
        }
      },
      { immediate: true },
    );

    onBeforeUnmount(() => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    });
  };

  return {
    audioRef,
    isSyncing,
    sheetSeekSyncPending,
    audioTimeDisplay,
    setupAudioListeners,
    syncAudioToSheetSeek,
    setupSync,
    setupAudioDrivenSheetSync,
  };
}

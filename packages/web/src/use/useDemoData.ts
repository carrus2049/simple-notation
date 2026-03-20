import { ref, type Ref } from 'vue';
import type { SNTemplate } from 'simple-notation';

export interface CatalogItem {
  hashname: string;
  artist: string;
  title: string;
}

export interface Manifest {
  batches: string[];
  dataDir: string;
}

export interface CharSpan {
  start: number;
  end: number;
  status: string;
}

export interface LyricsDiffItem {
  content: string;
  type: string;
  status?: string;
  char_spans?: CharSpan[] | null;
}

export interface LyricsDiff {
  lyrics_raw_items: LyricsDiffItem[];
  score_lyric_lines: { content: string; status?: string; char_spans?: CharSpan[] | null }[];
  color_scheme: {
    light: Record<string, string>;
    dark: Record<string, string>;
  };
}

export interface DemoDataState {
  catalog: Ref<CatalogItem[]>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  batches: Ref<string[]>;
  dataDir: Ref<string>;
  lyricsDiff: Ref<LyricsDiff | null>;
  loadManifest: (serverRoot: string) => Promise<boolean>;
  loadCatalog: (baseURL: string) => Promise<void>;
  loadSong: (baseURL: string, hashname: string) => Promise<SNTemplate | null>;
}

export function useDemoData(): DemoDataState {
  const catalog = ref<CatalogItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const batches = ref<string[]>([]);
  const dataDir = ref('');
  const lyricsDiff = ref<LyricsDiff | null>(null);

  const loadManifest = async (serverRoot: string): Promise<boolean> => {
    error.value = null;
    try {
      const base = serverRoot.replace(/\/$/, '');
      const res = await fetch(`${base}/manifest.json?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!res.ok) return false;
      const data = (await res.json()) as Manifest;
      batches.value = Array.isArray(data.batches) ? data.batches : [];
      dataDir.value = data.dataDir || '';
      return true;
    } catch {
      batches.value = [];
      dataDir.value = '';
      return false;
    }
  };

  const loadCatalog = async (baseURL: string) => {
    loading.value = true;
    error.value = null;
    lyricsDiff.value = null;
    try {
      // baseURL 为 output/批次名 时，catalog 在 baseURL/catalog.json
      const url = baseURL.replace(/\/$/, '') + '/catalog.json';
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      catalog.value = Array.isArray(data) ? data : [];
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      catalog.value = [];
    } finally {
      loading.value = false;
    }
  };

  const loadSong = async (baseURL: string, hashname: string): Promise<SNTemplate | null> => {
    const base = baseURL.replace(/\/$/, '');
    const songBase = `${base}/${hashname}`;
    try {
      const jsonRes = await fetch(`${songBase}/${hashname}_simple_notation.json`, {
        cache: 'no-store',
      });
      if (!jsonRes.ok) throw new Error(`JSON: ${jsonRes.status}`);
      const json = await jsonRes.json();
      const scoreFile = json.score_file as string;
      const lyricFile = json.lyric_file as string;

      const [scoreRes, lyricRes, diffRes] = await Promise.all([
        fetch(`${songBase}/${scoreFile}`, { cache: 'no-store' }),
        fetch(`${songBase}/${lyricFile}`, { cache: 'no-store' }),
        fetch(`${songBase}/lyrics_diff.json`, { cache: 'no-store' }),
      ]);
      if (!scoreRes.ok) throw new Error(`Score: ${scoreRes.status}`);
      if (!lyricRes.ok) throw new Error(`Lyric: ${lyricRes.status}`);

      const score = await scoreRes.text();
      const lyric = await lyricRes.text();

      lyricsDiff.value =
        diffRes.ok && diffRes.status === 200
          ? ((await diffRes.json()) as LyricsDiff)
          : null;

      return {
        info: json.info,
        score,
        lyric: lyric || undefined,
      };
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      lyricsDiff.value = null;
      return null;
    }
  };

  return {
    catalog,
    loading,
    error,
    batches,
    dataDir,
    lyricsDiff,
    loadManifest,
    loadCatalog,
    loadSong,
  };
}

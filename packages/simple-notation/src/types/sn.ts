/**
 * ABC 格式数据，支持单独传入歌词。
 */
export interface SNAbcData {
  score: string;
  lyric?: string;
}

/**
 * 歌词审核：与 strip 后合并串逐字对齐的状态，供谱面歌词上色（如谱面多出标蓝）。
 */
export interface SNLyricDiffPaint {
  mergedCharStatus: string[];
  colorMap: Record<string, string>;
}

/**
 * 用于渲染内容的数据类型，可以是模板对象、ABC 字符串或 ABC 对象。
 * @typedef {SNTemplate | string | SNAbcData} SNData
 */
export type SNData = SNTemplate | string | SNAbcData;

/**
 * 简谱模板对象。
 * @property {SNDataInfo} info - 简谱基本信息。
 * @property {string} score - 乐谱内容。
 * @property {string} [lyric] - 歌词内容。
 * @property {SNLyricDiffPaint} [lyricDiffPaint] - 可选，谱面歌词 diff 上色数据。
 */
export interface SNTemplate {
  info: SNDataInfo;
  score: string;
  lyric?: string;
  lyricDiffPaint?: SNLyricDiffPaint;
}

/**
 * 简谱基本信息。
 * @property {string} title - 标题。
 * @property {string} [composer] - 作曲。
 * @property {string} [lyricist] - 作词。
 * @property {string} [beat] - 每小节几拍。
 * @property {string} [time] - 每拍时值。
 * @property {string} [key] - 调号。
 * @property {string} [tempo] - 速度。
 * @property {string} [author] - 作者。
 */
export interface SNDataInfo {
  title: string;
  composer?: string;
  lyricist?: string;
  beat?: string;
  time?: string;
  key?: SNTemplateKey | SNAbcKey;
  tempo?: string;
  author?: string;
}

export type SNTemplateKey =
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'A'
  | 'B'
  | 'C#'
  | 'D#'
  | 'E#'
  | 'F#'
  | 'G#'
  | 'A#'
  | 'B#'
  | 'Cb'
  | 'Db'
  | 'Eb'
  | 'Fb'
  | 'Gb'
  | 'Ab'
  | 'Bb';

export type SNAbcKey =
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'A'
  | 'B'
  | 'Cmin'
  | 'Dmin'
  | 'Emin'
  | 'Fmin'
  | 'Gmin'
  | 'Amin'
  | 'Bmin';

/**
 * 简谱数据类型枚举。
 * @enum {string}
 * @property {string} TEMPLATE - 默认模板写法。
 * @property {string} ABC - abc写法。
 */
export enum SNDataType {
  TEMPLATE = 'template',
  ABC = 'abc',
}

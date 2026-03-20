# Changelog

## [0.0.4] - 2026-03-20

### Added
- **歌词 diff 上色（模板 + 渲染）**：`SNTemplate` 支持可选字段 `lyricDiffPaint`（`mergedCharStatus`、`colorMap`），`SNLoader` 写入 `SNRuntime.lyricDiffPaint`；`note.ts` 按字分段绘制歌词（`tspan`），对 `extra_in_score`、`diff` 等状态着色；`SNRuntime` 增加与 Web 端一致的 `stripForLyricCompare`、`syllableStrippedLength`、`scoreOffsetAtNoteStart`，用于对齐 strip 后合并串与谱面音节
- **谱面分页配置**：`SNScoreOptions.pageContentHeightPx` 可选，覆盖默认 A4 内容区高度（约 1047px @96dpi）
- **播放器 `SNPlayer`**：`reloadNotesFromRuntime()`（`loadData` 后同步内部音符队列，避免与谱面长度不一致）；`getCurrentIndex()`；`setCurrentIndex` 同步累计 `currentTime`；连音线（tie）发声规则：同 pitch 的 tie 组内后续音不重复触发 `onNotePlay`，pitch 变化则照常播放
- **Web**：路由 `/demo`（`Demo`）；`Header` 增加「谱面 Demo」入口；`Home` 精简为导航 + 进入 Demo 的落地页
- **Web `usePlayer`**：`reloadPlayerNotesFromRuntime`、`getPlayerCurrentIndex`、`seekToIndex`（播放中 seek 保持 Transport 连续）、`getTimeMsForNoteIndex` / `getNoteIndexForTimeMs`（音频与谱面时间对齐）；`use/index` 导出 `useDemoData`、`useAudioSync`
- **Web 依赖与构建**：`diff`、`jszip`；`env.d.ts` 声明 `diff` 模块；`vite.config` 将 `/api/demo` 代理到 `http://localhost:8000`（路径重写为后端根路径）
- **CLI PDF（Puppeteer）**：未设置 `PUPPETEER_EXECUTABLE_PATH` 时自动探测 macOS / Linux 常见 Chrome/Chromium 路径；找不到系统浏览器时给出警告并尝试使用 Puppeteer 自带 Chromium；捕获「Could not find Chrome」并输出可操作的解决提示

### Changed
- **`SvgUtils.createTspan`**：`font-size` / `font-family` / `font-weight` / `fill` / `text-anchor` 仅在传入时写入，避免子 `tspan` 覆盖父 `<text>` 的锚点与样式（多段上色歌词居中）
- **`usePlayer` 移调与发声**：旋律与和弦向 `playNote` 传入的音名与内部移调逻辑对齐，避免重复移调导致音高错误

### Fixed
- **CLI PDF**：生成流程用 `try/finally` 确保关闭 browser，并在成功路径的 `finally` 中关闭本地静态 server，避免泄漏
- **播放器**：`loadData` 更新 `SNRuntime.parsedScore` 后内部 `notes` 未刷新导致 seek / 时间计算异常的问题（通过 `reloadNotesFromRuntime` 与 Web 侧调用配合修复）

---

## [0.0.3] - 2026-03-09

### Added
- **批量输出工具 (batch)**：新增 `batch <data_dir>` 子命令，扫描 `data_dir/output` 下子目录中的 `{hash}_simple_notation.json`，批量渲染为 PDF 到 `data_dir/rendered_images/{hash}.pdf`
  - 支持 `-w, --width <px>` 指定渲染宽度（默认 800）
  - 支持 JSON 模板中的 `score_file` / `lyric_file` 引用外部文件

---

## [0.0.2] - 2026-03-08

### Added
- **命令行工具 (CLI)**：新增 `simple-notation` / `sn-pdf` 命令，可将谱面和歌词渲染为 PDF
  - 支持 JSON 模板文件 (.json) 和 ABC 格式 (.txt)
  - 谱面：`[score]` 位置参数或 `-s, --score-text` 直接传入文本
  - 歌词：`-l, --lyrics` 指定文件或 `-y, --lyrics-text` 直接传入
  - 输出：`-o, --output` 指定 PDF 路径（默认 output.pdf）
  - 渲染：`-w, --width` 指定宽度（像素，默认 800）
  - JSON 模板支持 `score_file` / `lyric_file` 引用外部文件

---

## [0.0.1] - 2026-03-08

### Changed
- **info.ts**: 调整速度标记位置（dy从-10改为30），重构四分音符符号渲染方式，使用tspan元素并添加Unicode音乐符号字体支持
- **note.ts**: 优化中文字体配置，将"微软雅黑"添加到字体族列表首位，简化歌词文本字体族配置
- **measure.ts**: 修复小节索引显示格式，临时禁用小节计数显示（注释drawCount方法）
- **vite.config.ts**: 添加simple-notation源码路径别名配置，支持热重载开发模式

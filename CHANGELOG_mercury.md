# Changelog

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

# Changelog

## [0.0.1] - 2026-03-08

### Changed
- **info.ts**: 调整速度标记位置（dy从-10改为30），重构四分音符符号渲染方式，使用tspan元素并添加Unicode音乐符号字体支持
- **note.ts**: 优化中文字体配置，将"微软雅黑"添加到字体族列表首位，简化歌词文本字体族配置
- **measure.ts**: 修复小节索引显示格式，临时禁用小节计数显示（注释drawCount方法）
- **vite.config.ts**: 添加simple-notation源码路径别名配置，支持热重载开发模式

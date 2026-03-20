# Simple Notation 开发和批量渲染指南

本文档介绍如何开发 Simple Notation 项目以及如何实现批量渲染功能。

## 项目结构

本项目是一个 monorepo，使用 pnpm 管理依赖，包含以下主要包：

- `packages/simple-notation/` - 核心简谱渲染库
- `packages/web/` - 基于 Vue 3 的 Web 应用
- `packages/docs/` - 文档站点

## 开发环境搭建

### 前置要求

- Node.js >= 18
- pnpm >= 8

### 安装依赖

```bash
# 安装所有依赖
pnpm install
```

### 开发模式

```bash
# 启动 Web 应用开发服务器（支持热重载）
pnpm dev:web

# 启动文档站点开发服务器
pnpm dev:docs
```

### 构建

```bash
# 构建核心库
pnpm build:lib

# 构建 Web 应用
pnpm build:web

# 构建库和 Web 应用（用于部署）
pnpm deploy:web
```

## 开发流程

### 核心库开发（simple-notation）

核心库位于 `packages/simple-notation/src/`，主要模块包括：

- `components/` - 渲染组件（谱面、小节、音符等）
- `core/` - 核心功能（加载器、解析器、播放器等）
- `config/` - 配置管理
- `layers/` - 图层系统（连音线、和弦、指法等）
- `types/` - TypeScript 类型定义
- `utils/` - 工具函数

#### 热重载配置

Web 应用通过 Vite 配置直接引用 simple-notation 源码，实现热重载：

```typescript
// packages/web/vite.config.ts
resolve: {
  alias: {
    'simple-notation': simpleNotationSrc, // 直接使用源码
    '@components': path.resolve(simpleNotationSrc, 'components'),
    // ... 其他别名
  }
}
```

修改 `simple-notation` 源码后，Web 应用会自动重新加载，无需手动构建。

### Web 应用开发

Web 应用位于 `packages/web/src/`，主要功能：

- 简谱编辑器
- 钢琴卷帘视图
- PDF 导出（批量渲染）
- MIDI/MP3 导入
- 音频播放

#### 主要组件

- `components/editor/` - 编辑器组件
- `components/PanelOperate.vue` - 操作面板（包含批量渲染功能）
- `pages/Home.vue` - 主页
- `pages/PianoRoll.vue` - 钢琴卷帘页面

## 批量渲染实现

### 概述

批量渲染功能用于将简谱批量导出为 PDF 文件。实现位于 `packages/web/src/components/PanelOperate.vue` 的 `print` 函数中。

### 技术栈

- **snapdom** (`@zumer/snapdom`) - 将 DOM/SVG 转换为 Canvas
- **jsPDF** (`jspdf`) - 生成 PDF 文件

### 实现流程

#### 1. 准备渲染环境

```typescript
// 等待字体加载完成（确保自定义字体如 Bravura 已加载）
await document.fonts.ready;

// 临时设置容器样式，确保所有内容可见
container.style.overflow = 'visible';
container.style.maxHeight = 'none';
```

#### 2. 识别分页位置

简谱渲染时会自动添加分页符（`sn-tag="break-line"`），通过查找这些元素确定每页的起始位置：

```typescript
const breakLines = document.querySelectorAll('[sn-tag="break-line"]');
const pageBreakYPositions: number[] = [0]; // 存储每页的起始 Y 坐标

breakLines.forEach((element) => {
  const relativeTop = 
    element.getBoundingClientRect().top - container.getBoundingClientRect().top;
  pageBreakYPositions.push(relativeTop);
});

pageBreakYPositions.push(containerHeight); // 添加最后一页
```

#### 3. 捕获整个谱面到 Canvas

使用 `snapdom` 将整个容器内容捕获为高分辨率 Canvas：

```typescript
const result = await snapdom(container, {
  embedFonts: false,  // 不嵌入字体（字体已在 PDF 中）
  scale: 2,          // 2倍分辨率，提高清晰度
  backgroundColor: '#fff', // 白色背景
});

const fullCanvas = await result.toCanvas();
```

#### 4. 分页切割并生成 PDF

遍历分页位置，从大 Canvas 中切割每一页，并添加到 PDF：

```typescript
const pdf = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: 'a4',
});

for (let i = 0; i < pageBreakYPositions.length - 1; i++) {
  const startY = pageBreakYPositions[i];
  const endY = pageBreakYPositions[i + 1];
  const segmentHeight = endY - startY;
  
  // 创建临时画布，从大画布中截取当前页
  const pageCanvas = document.createElement('canvas');
  const pageCtx = pageCanvas.getContext('2d');
  const scaleFactor = fullCanvas.width / container.offsetWidth;
  
  pageCanvas.width = fullCanvas.width;
  pageCanvas.height = segmentHeight * scaleFactor;
  
  pageCtx.drawImage(
    fullCanvas,
    0, scaledStartY,
    fullCanvas.width, scaledSegmentHeight,
    0, 0,
    pageCanvas.width, pageCanvas.height
  );
  
  // 转换为图片并添加到 PDF
  const imgData = pageCanvas.toDataURL('image/png');
  if (i > 0) pdf.addPage();
  pdf.addImage(imgData, 'PNG', margin, margin + 10, imgWidth, imgHeight);
  
  // 添加页码
  pdf.setFontSize(10);
  pdf.text(`- ${i + 1} -`, x, y);
}

// 保存 PDF
pdf.save(`[SimpleNotation]${SNRuntime.info.title || '未命名曲谱'}.pdf`);
```


### Build CLI工具
在 simple-notation 根目录下进入 `packages/cli` 子目录，并运行 `npm run build` 构建 CLI 工具：

```bash
cd packages/cli
npm run build
```

*构建完成后，`dist` 目录下会生成可用于 Node.js 执行的命令行入口文件。*


### 命令行批量渲染

使用 CLI 的 `batch` 子命令可对 Kraken 生成的 output 目录进行批量 PDF 渲染：


```bash
# 进入 simple-notation 根目录
cd simple-notation


# 批量渲染（data_dir 为包含 output 子目录的数据根目录）
node packages/cli/dist/index.js batch C:\Data\melody_jianpu_notation_gen\batch_3

# 指定渲染宽度（默认 800 像素）
node packages/cli/dist/index.js batch C:\Data\melody_jianpu_notation_gen\batch_3 -w 1000
```

- 扫描 `data_dir/output` 下各子目录中的 `{hash}_simple_notation.json`
- 输出到 `data_dir/rendered_images/{hash}.pdf`
- 需先执行 `pnpm build:lib` 构建 CLI

### Web 应用使用方式

在 Web 应用中，点击"💾保存pdf"按钮即可触发批量渲染：

```vue
<Button type="ghost" :disabled="isPrinting" @click="print">
  {{ isPrinting ? '⏳保存中...' : '💾保存pdf' }}
</Button>
```

### 注意事项

1. **字体加载**：必须等待 `document.fonts.ready`，确保所有自定义字体已加载
2. **容器样式**：渲染前需要临时修改容器样式（`overflow: visible`），渲染后恢复
3. **分辨率**：使用 `scale: 2` 提高 Canvas 分辨率，确保 PDF 清晰度
4. **分页处理**：依赖简谱渲染时自动添加的 `break-line` 元素进行分页
5. **内存管理**：大谱面可能占用较多内存，注意浏览器内存限制

### 扩展批量渲染

如需实现真正的批量渲染（一次处理多个谱面），可以：

1. **准备数据**：准备多个谱面数据数组
2. **循环处理**：
   ```typescript
   for (const scoreData of scoreDataList) {
     // 加载数据
     sn.loadData(scoreData);
     
     // 等待渲染完成
     await new Promise(resolve => setTimeout(resolve, 100));
     
     // 执行 PDF 导出
     await print();
   }
   ```
3. **合并 PDF**：使用 jsPDF 的合并功能，将多个 PDF 合并为一个文件

### 性能优化建议

- 对于大量谱面，考虑使用 Web Worker 进行后台处理
- 使用 `requestIdleCallback` 分批处理，避免阻塞主线程
- 对于超大谱面，考虑分块渲染或降低分辨率

## 测试

```bash
# 运行核心库测试
pnpm test:lib

# 生成测试覆盖率报告
pnpm coverage:lib
```

## 常见问题

### Q: 修改 simple-notation 源码后，Web 应用没有更新？

A: 检查 `packages/web/vite.config.ts` 中的别名配置是否正确指向源码目录。

### Q: PDF 导出时字体显示不正确？

A: 确保已等待 `document.fonts.ready`，并且字体文件已正确加载。

### Q: 批量渲染时内存占用过高？

A: 考虑降低 `scale` 参数，或实现分批处理机制。

## 相关资源

- [Simple Notation 官网](https://www.s-n.xyz/)
- [GitHub 仓库](https://github.com/Encaik/simple-notation)
- [npm 包](https://www.npmjs.com/package/simple-notation)

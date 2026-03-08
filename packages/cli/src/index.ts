#!/usr/bin/env node

import { program } from 'commander';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { generatePdf } from './pdf.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

program
  .name('simple-notation')
  .description('将谱面和歌词文本渲染为 PDF')
  .version('1.0.0');

// pnpm 会传入 "--" 作为首个参数，导致 Commander 将后续 -o 等视为位置参数，需移除
if (process.argv[2] === '--') {
  process.argv.splice(2, 1);
}

program
  .argument('[score]', '谱面文件路径或 JSON 模板文件路径（.json/.txt）')
  .option('-l, --lyrics <path>', '歌词文件路径（可选，用于 ABC 格式）')
  .option('-o, --output <path>', '输出 PDF 文件路径', 'output.pdf')
  .option('-s, --score-text <text>', '谱面文本（直接传入，与 score 二选一）')
  .option('-y, --lyrics-text <text>', '歌词文本（直接传入，与 --lyrics 二选一）')
  .option('-w, --width <px>', '渲染宽度（像素）', '800')
  .action(async (score, options) => {
    // #region agent log
    fetch('http://127.0.0.1:7849/ingest/8f6d0948-5a18-4b93-b754-2d53a1508db5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d69157'},body:JSON.stringify({sessionId:'d69157',location:'index.ts:action',message:'CLI args',data:{argv:process.argv,score,optionsOutput:options.output,options:Object.keys(options).reduce((a,k)=>({...a,[k]:options[k]}),{})},timestamp:Date.now(),hypothesisId:'H1,H2'})}).catch(()=>{});
    // #endregion
    try {
      let scoreData: string;
      let lyricsData: string | undefined;
      let dataType: 'template' | 'abc' = 'template';

      if (options.scoreText) {
        scoreData = options.scoreText;
        lyricsData = options.lyricsText;
        dataType = scoreData.trim().startsWith('{') ? 'template' : 'abc';
      } else if (score) {
        // #region agent log
        const stat = existsSync(score) ? statSync(score) : null;
        fetch('http://127.0.0.1:7849/ingest/8f6d0948-5a18-4b93-b754-2d53a1508db5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d69157'},body:JSON.stringify({sessionId:'d69157',location:'index.ts:beforeRead',message:'Before readFileSync',data:{score,exists:existsSync(score),isDirectory:stat?.isDirectory?.()},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
        // #endregion
        if (!existsSync(score)) {
          console.error(`错误: 谱面文件不存在: ${score}`);
          process.exit(1);
        }
        if (statSync(score).isDirectory()) {
          console.error(`错误: 谱面路径不能是目录: ${score}`);
          process.exit(1);
        }
        scoreData = readFileSync(score, 'utf-8');
        const ext = score.toLowerCase().split('.').pop();
        if (ext === 'json') {
          dataType = 'template';
          const parsed = JSON.parse(scoreData) as Record<string, unknown>;
          if ('score_file' in parsed && typeof parsed.score_file === 'string') {
            const scoreDir = dirname(resolve(process.cwd(), score));
            const scoreFilePath = resolve(scoreDir, parsed.score_file as string);
            const lyricFilePath =
              'lyric_file' in parsed && typeof parsed.lyric_file === 'string'
                ? resolve(scoreDir, parsed.lyric_file as string)
                : null;
            if (existsSync(scoreFilePath)) {
              const fullScore = readFileSync(scoreFilePath, 'utf-8');
              const fullLyric = lyricFilePath && existsSync(lyricFilePath)
                ? readFileSync(lyricFilePath, 'utf-8')
                : '';
              const { score_file, lyric_file, ...rest } = parsed;
              scoreData = JSON.stringify({ ...rest, score: fullScore, lyric: fullLyric });
            }
          }
        } else {
          dataType = 'abc';
          if (options.lyrics) {
            if (existsSync(options.lyrics)) {
              lyricsData = readFileSync(options.lyrics, 'utf-8');
            } else {
              console.error(`错误: 歌词文件不存在: ${options.lyrics}`);
              process.exit(1);
            }
          } else if (options.lyricsText) {
            lyricsData = options.lyricsText;
          }
        }
      } else {
        console.error('错误: 请指定谱面文件路径或使用 --score-text 传入谱面文本');
        program.help();
        process.exit(1);
      }

      const outputPath = resolve(process.cwd(), options.output);
      // #region agent log
      fetch('http://127.0.0.1:7849/ingest/8f6d0948-5a18-4b93-b754-2d53a1508db5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d69157'},body:JSON.stringify({sessionId:'d69157',location:'index.ts:outputPath',message:'Output path',data:{outputPath,optionsOutput:options.output,cwd:process.cwd()},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      const outputDir = dirname(outputPath);
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      const width = parseInt(options.width, 10) || 800;
      await generatePdf(scoreData, lyricsData, dataType, outputPath, width, __dirname);
      console.log(`PDF 已生成: ${outputPath}`);
    } catch (err) {
      console.error('生成 PDF 失败:', err);
      process.exit(1);
    }
  });

program.parse();

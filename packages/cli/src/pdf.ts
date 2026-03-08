import { createServer, type Server } from 'http';
import { createReadStream, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import puppeteer from 'puppeteer';

function getRenderHtml(
  data: unknown,
  dataType: 'template' | 'abc',
  scriptUrl: string,
  width: number,
): string {
  const dataJson = JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
      background: #fff;
      padding: 20px;
    }
    #container {
      overflow: visible;
    }
    [font-family='Bravura'] { font-family: 'Bravura', sans-serif; }
    @media print {
      body { padding: 0 !important; margin: 0 !important; }
      #container { padding: 0 !important; }
    }
  </style>
</head>
<body>
  <div id="container"></div>
  <script src="${scriptUrl}"></script>
  <script>
    (function() {
      var data = ${dataJson};
      var dataType = ${JSON.stringify(dataType)};
      var width = ${width};
      var container = document.getElementById('container');
      if (!container || !window.SN) {
        console.error('SimpleNotation not loaded');
        return;
      }
      var sn = new SN.SimpleNotation(container, { width: width, resize: false });
      if (dataType === 'template') {
        sn.loadData(data, SN.SNDataType.TEMPLATE);
      } else {
        sn.loadData(data, SN.SNDataType.ABC);
      }
    })();
  </script>
</body>
</html>`;
}

function serveStatic(port: number, rootDir: string): Promise<Server> {
  return new Promise((resolvePromise) => {
    const server = createServer((req, res) => {
      const url = req.url === '/' ? '/index.html' : req.url || '/';
      const filePath = join(rootDir, url.split('?')[0]);
      if (!existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      const ext = filePath.split('.').pop();
      const types: Record<string, string> = {
        html: 'text/html',
        js: 'application/javascript',
        cjs: 'application/javascript',
      };
      res.setHeader('Content-Type', types[ext || ''] || 'application/octet-stream');
      createReadStream(filePath).pipe(res);
    });
    server.listen(port, () => resolvePromise(server));
  });
}

export async function generatePdf(
  scoreData: string,
  lyricsData: string | undefined,
  dataType: 'template' | 'abc',
  outputPath: string,
  width: number,
  cliDir: string,
): Promise<void> {
  const snDistPath = resolve(cliDir, '../../simple-notation/dist');
  const umdPath = join(snDistPath, 'simple-notation.umd.cjs');
  if (!existsSync(umdPath)) {
    throw new Error(
      `simple-notation 未构建，请先运行: pnpm run build:lib\n` +
        `期望路径: ${umdPath}`,
    );
  }

  let data: unknown;
  if (dataType === 'template') {
    try {
      const parsed = JSON.parse(scoreData) as Record<string, unknown>;
      data = parsed;
    } catch {
      throw new Error('模板格式应为 JSON，解析失败');
    }
    if (lyricsData !== undefined && typeof data === 'object' && data !== null) {
      (data as Record<string, unknown>).lyric = lyricsData;
    }
  } else {
    data = lyricsData ? { score: scoreData, lyric: lyricsData } : scoreData;
  }

  const workDir = join(tmpdir(), `sn-cli-${randomBytes(8).toString('hex')}`);
  mkdirSync(workDir, { recursive: true });

  const html = getRenderHtml(data, dataType, '/simple-notation.umd.cjs', width);
  writeFileSync(join(workDir, 'index.html'), html);
  const umdContent = readFileSync(umdPath, 'utf-8');
  writeFileSync(join(workDir, 'simple-notation.umd.cjs'), umdContent);

  const port = 39281 + Math.floor(Math.random() * 1000);
  const serverPromise = serveStatic(port, workDir);

  const server = await serverPromise;
  const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  };
  let execPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (!execPath && process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    for (const p of candidates) {
      if (existsSync(p)) {
        execPath = p;
        break;
      }
    }
  }
  if (execPath) {
    launchOptions.executablePath = execPath;
  }
  const browser = await puppeteer.launch(launchOptions);

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: width + 100, height: 4000 });
    await page.goto(`http://127.0.0.1:${port}/`, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    await page.evaluate(() => document.fonts.ready);

    await page.pdf({
      path: outputPath,
      format: 'a4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
    });
  } finally {
    await browser.close();
    server.close();
  }
}

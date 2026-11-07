import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { profileHTML, projectsHTML, orbsHTML } from './src/status.js';
import { pageMeta, headTags, robotsTxt, sitemapXml, llmsTxt } from './src/seo.js';

// 개발 서버에서만 <head> 맨 앞에 검수 훅을 넣는다 (배포 빌드에는 없음).
// 훅은 CDP 로 미리 넣은 설정이 있을 때만 켜진다 (tools/qa-hook.js).
const qaHook = {
  name: 'arcade-qa-hook',
  apply: 'serve',
  transformIndexHtml: {
    order: 'pre',
    handler: (html, ctx) => ctx.path === '/index.html' || ctx.path === '/'
      ? [{ tag: 'script', children: readFileSync(new URL('./tools/qa-hook.js', import.meta.url), 'utf8'), injectTo: 'head-prepend' }]
      : html,
  },
};

// 검색엔진·AI 크롤러용 (개발·빌드 공통): content.js 로 도착 화면 창·메뉴 마크업, canonical·OG·JSON-LD 를 index.html 에 미리 넣고
// 빌드 때 robots.txt · sitemap.xml · llms.txt 를 dist/ 에 만든다. 창은 그대로 닫혀 있고, 런타임은 이 마크업에 이벤트만 붙인다
const crawlerFiles = () => {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  return { 'robots.txt': robotsTxt(), 'sitemap.xml': sitemapXml(), 'llms.txt': llmsTxt(pageMeta(html)) };
};
const HEAD_MARK = '<!-- arcade-prerender: canonical·OG·Twitter 카드·JSON-LD -->';
const prerender = {
  name: 'arcade-prerender',
  transformIndexHtml(html) {
    const fill = (id, inner) => {
      const empty = new RegExp(`(id="${id}"[^>]*>)(</)`);
      if (!empty.test(html)) throw new Error(`index.html 에 빈 #${id} 가 없음`);
      html = html.replace(empty, (_, open, close) => open + inner + close);
    };
    fill('orbs', orbsHTML());
    fill('profile-body', profileHTML());
    fill('projects-body', projectsHTML());
    // index.html 의 표시 주석 자리에 넣는다 (스크립트보다 앞)
    if (!html.includes(HEAD_MARK)) throw new Error('index.html 에 머리 태그 표시 주석이 없음');
    return html.replace(HEAD_MARK, headTags(pageMeta(html)));
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const path = req.url.split('?')[0].slice(1), body = /^(robots\.txt|sitemap\.xml|llms\.txt)$/.test(path) && crawlerFiles()[path];
      if (!body) return next();
      res.setHeader('Content-Type', path.endsWith('.xml') ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8');
      res.end(body);
    });
  },
  generateBundle() {
    for (const [fileName, source] of Object.entries(crawlerFiles()))
      this.emitFile({ type: 'asset', fileName, source });
  },
};

export default defineConfig({
  base: './',   // 저장소 이름과 상관없이 GitHub Pages 하위 경로에서 동작
  // 없는 주소는 GitHub Pages 처럼 404 (SPA 대체 응답이면 /.well-known/ard.json 등에 index.html 이 200 으로 나가 Lighthouse 가 깨진 파일로 봄)
  appType: 'mpa',
  plugins: [qaHook, prerender],
  build: {
    target: 'es2022',
    // three 본체는 한 덩어리(약 600kB, gzip 150kB)라 경고 기준을 올리고 이름을 붙여 따로 둔다
    chunkSizeWarningLimit: 700,
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'three', test: /node_modules[\\/]three/ }] } } },
  },
});

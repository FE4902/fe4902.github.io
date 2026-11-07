import { SITE_URL, PROFILE } from './content.js';

// ---------- 빌드 전용: 검색엔진·AI 크롤러가 JS 없이 읽을 정보 (vite.config.js 가 불러옴, 런타임 번들에는 없음) ----------
// 모두 content.js 에서 만든다. 화면에 실제로 뜨는 내용만 쓴다 (숨긴 정보가 화면과 다르면 클로킹)
export const OG_IMAGE = { path: 'og.png', width: 1200, height: 630, type: 'image/png', alt: '서커스 무대를 사자를 타고 달리는 1인칭 도트 3D 화면' };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const isWeb = href => /^https?:\/\//.test(href);
const repoOf = links => links.find(([, href]) => /^https:\/\/github\.com\/[^/]+\/[^/]+/.test(href))?.[1];
const webLinks = () => PROFILE.menu.filter(m => isWeb(m.href));
const email = () => PROFILE.menu.find(m => m.href?.startsWith('mailto:'))?.href.slice(7);
const stat = key => PROFILE.stats.find(([k]) => k === key)?.[1];

// index.html 의 <title>·description 을 그대로 OG·Twitter·JSON-LD 에도 쓴다
export const pageMeta = html => ({
  title: html.match(/<title>([^<]*)<\/title>/)[1],
  description: html.match(/<meta name="description" content="([^"]*)">/)[1],
});

// ---------- JSON-LD: ProfilePage + Person + 프로젝트(CreativeWork / 저장소가 있으면 SoftwareSourceCode) ----------
export function jsonLd({ title, description }) {
  const person = SITE_URL + '#person', loc = stat('위치'), mail = email();
  const works = PROFILE.items.map((item, i) => {
    const repo = repoOf(item.links), url = item.links.map(([, href]) => href).find(href => isWeb(href) && href !== repo);
    return {
      '@type': repo ? 'SoftwareSourceCode' : 'CreativeWork', '@id': `${SITE_URL}#project-${i + 1}`,
      name: item.name, description: item.desc, dateCreated: item.date, keywords: item.tags.join(', '),
      creator: { '@id': person },
      ...(url && { url }), ...(repo && { codeRepository: repo }),
    };
  });
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': SITE_URL + '#website', url: SITE_URL, name: title, inLanguage: 'ko' },
      {
        '@type': 'ProfilePage', '@id': SITE_URL, url: SITE_URL, name: title, description, inLanguage: 'ko',
        isPartOf: { '@id': SITE_URL + '#website' }, mainEntity: { '@id': person },
        primaryImageOfPage: { '@type': 'ImageObject', url: SITE_URL + OG_IMAGE.path, width: OG_IMAGE.width, height: OG_IMAGE.height },
        hasPart: works,
      },
      {
        '@type': 'Person', '@id': person, name: PROFILE.name, jobTitle: PROFILE.role, url: SITE_URL,
        description: `${PROFILE.tagline} ${PROFILE.intro}`,
        ...(loc && { homeLocation: { '@type': 'Place', name: loc } }),
        ...(mail && { email: mail }),
        ...(webLinks().length && { sameAs: webLinks().map(m => m.href) }),
      },
    ],
  };
}

// ---------- <head> 에 넣을 태그: canonical · OG · Twitter 카드 · JSON-LD ----------
export function headTags(meta) {
  const og = SITE_URL + OG_IMAGE.path;
  const tag = (attr, key, content) => `<meta ${attr}="${key}" content="${esc(content)}">`;
  return [
    `<link rel="canonical" href="${esc(SITE_URL)}">`,
    tag('property', 'og:type', 'website'), tag('property', 'og:site_name', meta.title), tag('property', 'og:locale', 'ko_KR'),
    tag('property', 'og:url', SITE_URL), tag('property', 'og:title', meta.title), tag('property', 'og:description', meta.description),
    tag('property', 'og:image', og), tag('property', 'og:image:type', OG_IMAGE.type),
    tag('property', 'og:image:width', OG_IMAGE.width), tag('property', 'og:image:height', OG_IMAGE.height), tag('property', 'og:image:alt', OG_IMAGE.alt),
    tag('name', 'twitter:card', 'summary_large_image'), tag('name', 'twitter:title', meta.title),
    tag('name', 'twitter:description', meta.description), tag('name', 'twitter:image', og), tag('name', 'twitter:image:alt', OG_IMAGE.alt),
    // </script> 가 섞여도 깨지지 않게 < 를 이스케이프
    `<script type="application/ld+json">${JSON.stringify(jsonLd(meta)).replace(/</g, '\\u003c')}</script>`,
  ].join('\n');
}

// ---------- 크롤러 파일 (dist/ 에 생성) ----------
// GitHub Pages 프로젝트 주소(…github.io/<저장소>/)면 robots.txt·llms.txt 는 도메인 루트가 아니라서 크롤러가 찾지 않는다.
// 사용자 페이지(<사용자명>.github.io)나 개인 도메인이면 그대로 동작
const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User',
  'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'CCBot'];
export const robotsTxt = () => `# 검색엔진과 AI 크롤러 모두 허용
User-agent: *
Allow: /

${AI_BOTS.map(b => `User-agent: ${b}`).join('\n')}
Allow: /

Sitemap: ${SITE_URL}sitemap.xml
`;

export const sitemapXml = (date = new Date().toLocaleDateString('sv')) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${esc(SITE_URL)}</loc><lastmod>${date}</lastmod></url>
</urlset>
`;

// https://llmstxt.org 형식: H1 · 인용 요약 · 섹션별 링크 목록
export function llmsTxt({ title, description }) {
  const { name, role, stats, tagline, intro, history, items } = PROFILE;
  const md = s => String(s).replace(/([[\]])/g, '\\$1');
  const link = (label, href) => isWeb(href) || href.startsWith('mailto:') ? `[${md(label)}](${href})` : md(label);
  return `# ${name}

> ${description}

${name} (${role}) — ${tagline} ${intro}

${stats.map(([k, v]) => `- ${k}: ${v}`).join('\n')}

이 사이트(${title})는 스크롤로 진행하는 아케이드 게임 형식입니다. 위 소개와 아래 프로젝트는 게임을 클리어한 뒤 도착 화면의 PROFILE · PROJECTS 창에 나옵니다.

## 기록

${history.map(h => `- ${h}`).join('\n')}

## 프로젝트

${items.map(item => {
    const links = item.links.filter(([, href]) => isWeb(href)).map(([label, href]) => link(label, href)).join(' · ');
    return `- **${md(item.name)}** (${item.date}, ${item.tags.join(' · ')}): ${item.desc}${links ? ` — ${links}` : ''}`;
  }).join('\n')}

## 링크

- [${md(title)}](${SITE_URL}): 포트폴리오 사이트
${PROFILE.menu.filter(m => m.href && (isWeb(m.href) || m.href.startsWith('mailto:'))).map(m => `- ${link(m.label, m.href)}`).join('\n')}
`;
}

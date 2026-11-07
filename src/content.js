// ---------- 배포 주소 (끝에 / 포함) ----------
// GitHub 사용자 페이지 저장소 fe4902.github.io — 도메인 루트라 robots.txt·llms.txt 가 동작한다. canonical·OG·JSON-LD·sitemap·robots·llms.txt 가 모두 이 값을 쓴다
export const SITE_URL = 'https://fe4902.github.io/';

// ---------- 도착 화면: 소개 내용은 여기만 고친다 (지금은 임시 문구) ----------
// 빌드 때 이 내용으로 창 마크업·구조화 데이터·llms.txt 를 만들어 index.html 에 미리 넣는다 (src/seo.js)
export const PROFILE = {
  name: 'FE4902',
  role: 'CREATOR · CODER',
  stats: [['클래스', '크리에이터 · 코더'], ['위치', 'SEOUL, KR']],
  tagline: '놀 거리를 코드로 만듭니다.',
  intro: '게임처럼 즐길 수 있는 웹과 작은 도구들을 기획하고 직접 만듭니다. 이 페이지도 그중 하나예요.',
  history: ['現 ○○ 크리에이터', '前 ○○ 기획 · 개발', '1인 웹 · 게임 제작'],
  // 보너스 3개 = 프로젝트 3개. icon: disk · cart · chip
  items: [
    { icon: 'disk', name: '프로젝트 하나', date: '2026-10', desc: '무엇을 만들었고 어떤 점이 재미있는지 한두 줄로 씁니다.', tags: ['React', 'TypeScript'], links: [['사용해 보기', '#'], ['GITHUB', '#']] },
    { icon: 'cart', name: '프로젝트 둘', date: '2026-08', desc: '무엇을 만들었고 어떤 점이 재미있는지 한두 줄로 씁니다.', tags: ['Three.js', 'WebGL'], links: [['플레이', '#'], ['GITHUB', '#']] },
    { icon: 'chip', name: '프로젝트 셋', date: '2026-03', desc: '무엇을 만들었고 어떤 점이 재미있는지 한두 줄로 씁니다.', tags: ['Chrome Extension'], links: [['설치하기', '#']] },
  ],
  // 공간에 떠 있는 아이템 4개: open 은 창을 열고, href 는 날아가며 링크를 연다
  menu: [
    { icon: 'profile', label: 'PROFILE', open: 'profile-window' },
    { icon: 'folder', label: 'PROJECTS', open: 'projects-window' },
    { icon: 'term', label: 'GITHUB', href: 'https://github.com/FE4902' },
    { icon: 'mail', label: 'EMAIL', href: 'mailto:hello@example.com' },
  ],
};
// 12×12 아이템 도트 (a 하늘 · b 흰색 · c 남색 · d 노랑 · e 분홍 · f 바탕 · g 진노랑). 공간에선 이 도트를 복셀로 세운다
export const ICON_INK = { a: '#6fd3ff', b: '#e6f6ff', c: '#1d5a8a', d: '#e8d020', e: '#d84060', f: '#04121f', g: '#a88a10' };
export const ICONS = {
  disk: ['aaaaaaaaaaa.', 'aacbbbbbcaaa', 'aacbbcbbcaaa', 'aacbbbbbcaaa', 'aaaccccccaaa', 'aaaaaaaaaaaa',
         'aabbbbbbbbaa', 'aabddddddbaa', 'aabbbbbbbbaa', 'aabddddbbbaa', 'aabbbbbbbbaa', 'aaaaaaaaaaaa'],
  cart: ['.cccccccccc.', 'caaaaaaaaaac', 'cabbbbbbbbac', 'cabeeeeeebac', 'cabebbbbebac', 'cabeeeeeebac',
         'cabbbbbbbbac', 'caaaaaaaaaac', 'caaaaaaaaaac', 'cadadadadaac', '.cdcdcdcdcc.', '............'],
  chip: ['..d.d.d.d...', '.cccccccccc.', 'dcaaaaaaaacd', '.caccccccac.', 'dcacbbbbcacd', '.cacbaabcac.',
         'dcacbaabcacd', '.cacbbbbcac.', 'dcaccccccacd', '.caaaaaaaac.', '.cccccccccc.', '..d.d.d.d...'],
  term: ['aaaaaaaaaaaa', 'aeadadaaaaaa', 'aaaaaaaaaaaa', 'affffffffffa', 'afbffffffffa', 'affbfffffffa',
         'afffbffffffa', 'affbfffffffa', 'afbffbbbbffa', 'affffffffffa', 'affffffffffa', 'aaaaaaaaaaaa'],
  mail: ['............', 'aaaaaaaaaaaa', 'acbbbbbbbbca', 'abcbbbbbbcba', 'abbcbbbbcbba', 'abbbcbbcbbba',
         'abbbbccbbbba', 'abbbbbbbbbba', 'abbbbbbbbbba', 'aaaaaaaaaaaa', '............', '............'],
  profile: ['.bbbbbbbaa..', '.bbbbbbbaaa.', '.beebbbbbbb.', '.beebcccbbb.', '.bbbbbbbbbb.', '.bccccccccb.',
            '.bbbbbbbbbb.', '.bcccccbbbb.', '.bbbbbbbbbb.', '.bccccccccb.', '.bbbbbbbbbb.', '.bbbbbbbbbb.'],
  folder: ['............', '.dddd.......', 'dddddd......', 'dddddddddddd', 'deeaabbbcccd', 'gggggggggggg',
           'gggggggggggg', 'gggddddddggg', 'gggggggggggg', 'gggggggggggg', 'gggggggggggg', '............'],
};

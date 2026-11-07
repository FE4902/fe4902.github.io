# FE4902 Portfolio

원작 아케이드 게임 **서커스 찰리 · 남극탐험 · 크롬 공룡**을 1인칭 도트 3D로 재해석한 개발자 소개 페이지.
처음 진입하면 미완료 테마를 우선해 랜덤으로 시작하며, 타이틀의 PRESS START를 누르고 스크롤로 달린다. 어느 무대든 GAME CLEAR 후 같은 **이세계 전송**(노이즈·글리치 위 시스템 창 → 화면 속 통로)이 이어지고, 디지털 공간에 떠 있는 **PROFILE · PROJECTS · GITHUB · EMAIL** 아이템으로 개발자·프로젝트 소개와 연락처를 본다.

## 보기

- `pnpm install` 뒤 `pnpm dev` 로 개발 서버를 열거나, `pnpm build` 로 `dist/` 를 만든다 (Vite). 배포된 페이지는 GitHub Pages.
- 사운드는 PRESS START 이후에 시작한다. 오른쪽 아래 스피커 또는 M으로 음소거하고, 10칸 막대로 BGM과 효과음의 음량을 조절한다. 휠로 시작하면 브라우저에 따라 다음 클릭·키 입력 때 소리가 켜진다.
- `?theme=circus` / `?theme=antarctic` / `?theme=dino` → 검수·공유용 테마 지정 URL. 화면에는 테마 선택 UI가 없으며 기본 진입은 미완료 우선 랜덤이다.
- `?theme=antarctic&p=0.5` → 타이틀을 건너뛰고 남극 중간 지점부터.
- 타이틀의 `PRESS START`, Enter/Space, 아래로 스크롤 → `STAGE-0N READY!` → 주행.
- 시스템 창에서 수락하면 전송된다. 거절·Esc·20초 무응답은 붉은 경고 뒤 강제 전송. 도착 화면에서 PROFILE·PROJECTS를 누르면 창이 뜨고(✕·Esc·바깥 클릭으로 닫힘), GITHUB·EMAIL은 날아가며 링크가 열린다. 다음 무대 카드는 없다.
- 저장하는 값은 현재 탭의 클리어 테마 목록(`sessionStorage`)뿐이다. 다시 들어오면 미완료 테마를 우선해 타이틀에서 시작한다.
- 그림 교체: `src/assets/<이름>.webp` 를 넣으면 코드로 그린 그림 대신 쓴다 (빌드 때 목록을 정함).

## 구성

| 경로 | 내용 |
|---|---|
| `index.html`, `src/` | 서커스·남극·크롬 공룡 통합 본편 (Vite). 테마는 `src/themes/`, 공통 부품은 `src/core/` |
| `src/audio/index.js` | 테마별 BGM, 합성 효과음, 음량·음소거 |
| `src/content.js` | 도착 화면 소개·프로젝트·연락처, 배포 주소 `SITE_URL` |
| `src/seo.js`, `public/` | 빌드 때 만드는 메타·JSON-LD·`robots.txt`·`sitemap.xml`·`llms.txt`, 파비콘·공유 이미지 |
| `vite.config.js`, `package.json` | Vite·pnpm 설정 |
| `.github/workflows/deploy.yml` | GitHub Pages 배포 |
| `index-bgm.html` | 이전 사운드 시안 (비교용 단일 HTML) |
| `tools/shot.py` | 헤드리스 검수 스크린샷 |
| `tools/check_merged*.mjs` | 세 테마 공통 흐름·화면·전송·도착 메뉴 검수 |
| `tools/check_dino*.mjs` | 본편 공룡 주행·Chrome 실제 입력 검수 |
| `tools/check_bgm_browser.mjs` | 본편 BGM 실제 오디오·음소거·음량 검수 (9335 Chrome) |
| `tools/check_sfx_browser.mjs` | 효과음 출력·음량·주행/클릭 연결 검사 (9336 Chrome) |

`_`로 시작하는 폴더(검수 캡처 등)는 로컬 전용이라 저장소에 올리지 않는다. 검사 도구를 돌리면 `_artifacts/`에 캡처가 생긴다.

## 내용 바꾸기

- 시스템 창 문구: `src/portal.js` 의 `SYSTEM_COPY`
- 도착 화면 소개·프로젝트·연락처: `src/content.js` 의 `PROFILE` (지금은 임시 문구). 떠 있는 아이템은 `PROFILE.menu`, 아이콘 도트는 `ICONS`. 빌드 때 같은 내용이 `index.html`(닫힌 창 안)·JSON-LD·`llms.txt` 에 들어가 JS 없이도 읽힌다
- 배포 주소: `src/content.js` 의 `SITE_URL` (`https://fe4902.github.io/` — canonical·공유 카드·sitemap 이 모두 이 값을 씀). 공유 이미지는 `public/og.png`

이미지 파일은 품질 100의 WebP를 사용한다. 현재 별도 게임 에셋 파일은 없으며 코드로 그린 그림을 사용한다.

## 검수

```bash
node tools/check_merged.mjs
node tools/check_dino.mjs
python3 -I tools/shot.py index.html --theme circus --p 0.32 --steps 10 --out /tmp/circus.webp
python3 -I tools/shot.py index.html --theme antarctic --p 0.5 --size 430x800 --steps 10 --out /tmp/antarctic.webp
python3 -I tools/shot.py index.html --theme dino --p 0.3 --steps 10 --out /tmp/dino.webp
```

`tools/shot.py` 는 본편을 찍을 때 Vite 개발 서버를 잠깐 띄운다. `node tools/check_merged_browser.mjs` 는 9334 포트로 띄운 헤드리스 Chrome 이 필요하다 (개발 서버는 스스로 띄움). 움직임 줄이기에서는 통로 대신 0.7초 페이드로 전송한다.

import { audio } from './audio/index.js';
import { theme, startButton } from './flow.js';
import { renderStatus } from './status.js';

// 뒤늦게 추가되는 프로젝트 이미지도 기본 드래그를 막는다.
document.addEventListener('dragstart', e => {
  if (e.target.matches?.('img, canvas')) e.preventDefault();
});

audio.init();
renderStatus();

// 타이틀(HTML)을 먼저 그린 뒤 3D 를 불러온다 (탭이 숨겨져 rAF 가 멈춰도 0.2초 뒤에는 진행)
await new Promise(resolve => { requestAnimationFrame(() => setTimeout(resolve)); setTimeout(resolve, 200); });
// 고른 테마만 불러온다 (테마마다 따로 나뉜 파일)
const stages = { circus: () => import('./themes/circus.js'), antarctic: () => import('./themes/antarctic.js'), dino: () => import('./themes/dino.js') };
try {
  await (await stages[theme]()).run();
} catch (error) {
  console.error(error); startButton.textContent = '다시 불러오기'; startButton.disabled = false;
  startButton.addEventListener('click', () => location.reload(), { once: true });
  document.getElementById('intro-help').hidden = false;
  document.getElementById('intro-help').textContent = '화면을 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.';
}

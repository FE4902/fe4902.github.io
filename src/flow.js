import { audio } from './audio/index.js';
// ---------- 공통 흐름: 타이틀 · READY · 동일한 소개 ----------
const params = new URLSearchParams(location.search);
// 예전 링크의 진행 상태는 제거하고 테마·검수 진행률만 받는다.
if (['stage', 'cleared', 'ready'].some(key => params.has(key))) {
  ['stage', 'cleared', 'ready'].forEach(key => params.delete(key));
  history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
}
try { window.localStorage.removeItem('arcade-visited'); } catch {}
export const THEMES = {
  circus: { name: '서커스 찰리', label: 'CIRCUS CHARLIE' },
  antarctic: { name: '남극탐험', label: 'ANTARCTIC ADVENTURE' },
  dino: { name: '크롬 공룡', label: 'CHROME DINO' },
};
export const keys = Object.keys(THEMES);
function readCompleted() {
  try {
    const value = JSON.parse(window.sessionStorage.getItem('arcade-cleared') || '[]');
    return Array.isArray(value) ? [...new Set(value.filter(v => keys.includes(v)))] : [];
  } catch { return []; }
}
export const completed = readCompleted();
const choices = keys.filter(key => !completed.includes(key));
export const theme = keys.includes(params.get('theme')) ? params.get('theme') : (choices.length ? choices : keys)[Math.floor(Math.random() * (choices.length || keys.length))];
// 깬 무대를 다시 하면 그 무대를 깬 순서의 번호를 유지한다.
export const stageNumber = completed.includes(theme) ? completed.indexOf(theme) + 1 : completed.length + 1;
const stageLabel = `STAGE-${String(stageNumber).padStart(2, '0')}`;
export const initialProgress = Number.parseFloat(params.get('p'));
export let started = Number.isFinite(initialProgress) && initialProgress >= 0;
export const intro = document.getElementById('intro'), ready = document.getElementById('ready'), startButton = document.getElementById('start');
let gameLoaded = false;
document.body.dataset.theme = theme;
document.getElementById('theme-title').textContent = 'PORTFOLIO';
document.getElementById('stage-number').textContent = stageLabel;
document.getElementById('ready-stage').textContent = stageLabel;
document.getElementById('title-foot').textContent = `1 PLAYER · ${stageLabel}`;
intro.setAttribute('aria-label', '포트폴리오 타이틀');
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
export function startRide() {
  if (started || !gameLoaded) return;
  started = true; intro.hidden = true; ready.hidden = false; scrollTo(0, 0);
  audio.start(theme);
  setTimeout(() => { ready.hidden = true; document.body.classList.remove('waiting'); }, 1200);
}
export function activateStage() {
  gameLoaded = true; startButton.disabled = false; startButton.textContent = 'PRESS START';
  if (started) { intro.hidden = true; document.body.classList.remove('waiting'); }
}
startButton.addEventListener('click', startRide);
addEventListener('keydown', e => {
  if (intro.hidden || e.target.closest('a, button, input, textarea, select')) return;
  if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); startRide(); }
});
intro.addEventListener('wheel', e => { e.preventDefault(); if (e.deltaY > 0) startRide(); }, { passive: false });
let touchY = null;
intro.addEventListener('touchstart', e => { touchY = e.touches[0].clientY; }, { passive: true });
intro.addEventListener('touchmove', e => { if (touchY !== null && touchY - e.touches[0].clientY > 20) { touchY = null; startRide(); } }, { passive: true });

export function onClear() {
  if (!completed.includes(theme)) completed.push(theme);
  try { window.sessionStorage.setItem('arcade-cleared', JSON.stringify(completed)); } catch {}
}

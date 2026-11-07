import { audio } from './audio/index.js';
import { PROFILE, ICON_INK, ICONS } from './content.js';

// ---------- 도착 화면의 창(PROFILE · PROJECTS)과 떠 있는 메뉴 버튼. 내용은 content.js ----------
// 마크업 함수는 DOM 을 쓰지 않는다: 빌드 때 vite.config.js 가 같은 함수로 index.html 에 미리 넣고(크롤러용),
// 런타임은 미리 들어간 마크업에 이벤트만 붙인다 (비어 있을 때만 채움)
const iconSVG = name => `<svg viewBox="0 0 12 12" aria-hidden="true">${ICONS[name].flatMap((row, y) =>
  [...row].map((ch, x) => ICON_INK[ch] ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${ICON_INK[ch]}"/>` : '')).join('')}</svg>`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const external = href => /^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '';
const linkList = links => `<p class="status-links">${links.map(([label, href]) => `<a href="${esc(href)}"${external(href)}>${esc(label)}</a>`).join('')}</p>`;

export const profileHTML = ({ name, role, stats, tagline, intro, history } = PROFILE) => `
    <section class="status-part" style="--i:0"><h3>프로필</h3><p class="status-role">${esc(role)}</p><h2 class="status-name">${esc(name)}</h2>
      <dl class="status-stats">${stats.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></section>
    <section class="status-part" style="--i:1"><h3>소개</h3><p class="status-tagline">${esc(tagline)}</p><p class="status-intro">${esc(intro)}</p></section>
    <section class="status-part" style="--i:2"><h3>기록</h3><ul class="status-history">${history.map(h => `<li>${esc(h)}</li>`).join('')}</ul></section>`;
// 프로젝트 설명은 셋 다 넣고 고른 것만 보인다 (처음엔 첫 번째)
export const projectsHTML = ({ items } = PROFILE) => `
    <section class="status-part" style="--i:0"><h3>프로젝트 <small>${items.length}/${items.length}</small></h3>
      <div class="slots">${items.map((item, i) => `<button class="slot" data-item="${i}" aria-pressed="${i === 0}" aria-controls="item-detail" aria-label="${esc(item.name)}">${iconSVG(item.icon)}<span class="slot-name">${esc(item.name)}</span></button>`).join('')}</div>
      <div class="item-detail" id="item-detail" aria-live="polite">${items.map((item, i) => `<article class="item-entry" data-entry="${i}"${i ? ' hidden' : ''}><h4>${esc(item.name)} <small>${esc(item.date)}</small></h4><p>${esc(item.desc)}</p>${item.tags.map(t => `<span class="chip">${esc(t)}</span>`).join(' ')}${linkList(item.links)}</article>`).join('')}</div></section>`;
// 아이템 버튼: 실제 클릭·키보드 대상. 그림(복셀)은 arrivalSpace 가 이 버튼 위치에 맞춰 그린다
export const orbsHTML = ({ menu } = PROFILE) => menu.map(({ label, open, href }, i) => open
  ? `<button class="orb" data-orb="${i}" aria-haspopup="dialog"><span class="orb-label">${esc(label)}</span></button>`
  : `<a class="orb" data-orb="${i}" href="${esc(href)}"${external(href)}><span class="orb-label">${esc(label)}</span></a>`).join('');

export function renderStatus() {
  const fill = (id, html) => { const el = document.getElementById(id); if (!el.firstElementChild) el.innerHTML = html; };
  fill('profile-body', profileHTML());
  fill('projects-body', projectsHTML());
  fill('orbs', orbsHTML());
  const slots = document.querySelectorAll('.slot'), entries = document.querySelectorAll('.item-entry');
  const pick = i => {
    slots.forEach(s => s.setAttribute('aria-pressed', String(s.dataset.item === String(i))));
    entries.forEach(e => { e.hidden = e.dataset.entry !== String(i); });
  };
  slots.forEach(s => s.addEventListener('click', () => { pick(Number(s.dataset.item)); audio.sfx('select', 'arrival'); }));
  // 창: 닫기 버튼 · Esc · 바깥(배경) 클릭으로 닫힘
  document.querySelectorAll('.info-window').forEach(win => {
    win.addEventListener('close', () => audio.sfx('close', 'arrival'));
    win.querySelector('.window-close').addEventListener('click', () => win.close());
    win.addEventListener('click', e => { if (e.target === win) win.close(); });
  });
}

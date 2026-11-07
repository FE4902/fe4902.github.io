import * as THREE from 'three';
import { started, theme, stageNumber } from './flow.js';

// ---------- 인게임 HUD: 같은 저해상도·CRT 안에서 표시 ----------
export function gameHUD(post) {
  const surface = document.createElement('canvas'), ctx = surface.getContext('2d');
  const texture = new THREE.CanvasTexture(surface);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  post.uniforms.hudMap = { value: texture };
  // 5×7 고정 도트: 폰트 로딩·안티앨리어싱 없이 무대 도트와 맞춘다.
  const glyphs = {
    '0': [14,17,17,17,17,17,14], '1': [4,12,4,4,4,4,14], '2': [14,17,1,2,4,8,31],
    '3': [30,1,1,14,1,1,30], '4': [2,6,10,18,31,2,2], '5': [31,16,16,30,1,1,30],
    '6': [14,16,16,30,17,17,14], '7': [31,1,2,4,8,8,8], '8': [14,17,17,14,17,17,14],
    '9': [14,17,17,15,1,1,14], 'A': [14,17,17,31,17,17,17], 'D': [30,17,17,17,17,17,30],
    'E': [31,16,16,30,16,16,31], 'F': [31,16,16,30,16,16,16], 'G': [14,17,16,23,17,17,15],
    'H': [17,17,17,31,17,17,17], 'I': [14,4,4,4,4,4,14], 'K': [17,18,20,24,20,18,17],
    'L': [16,16,16,16,16,16,31], 'M': [17,27,21,21,17,17,17], 'P': [30,17,17,30,16,16,16],
    'R': [30,17,17,30,20,18,17], 'S': [15,16,16,14,1,1,30], 'T': [31,4,4,4,4,4,4],
    '/': [1,2,2,4,8,8,16], ' ': [0,0,0,0,0,0,0],
  };
  function text(str, center, y, color) {
    const x = Math.round(center - (str.length * 6 - 1) / 2);
    const draw = (dx, dy, ink) => {
      ctx.fillStyle = ink;
      [...str].forEach((ch, i) => (glyphs[ch] || glyphs[' ']).forEach((row, gy) => {
        for (let gx = 0; gx < 5; gx++) if (row & (1 << (4 - gx))) ctx.fillRect(x + i * 6 + gx + dx, y + gy + dy, 1, 1);
      }));
    };
    // 불빛·눈 위에서도 읽히도록 사방 테두리
    const edge = theme === 'circus' ? '#000' : '#0038ad';
    [[1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => draw(dx, dy, edge));
    draw(0, 0, color);
  }
  let previous = '';
  const score = document.getElementById('score'), distance = document.getElementById('distance');
  const flags = document.getElementById('flags'), speed = document.getElementById('speedbar');
  return () => {
    const { x: w, y: h } = post.uniforms.res.value;
    const visible = started && !document.body.classList.contains('waiting') && !document.body.classList.contains('portal-mode');
    const level = Math.round((Number(speed.style.opacity || .35) - .35) / .65 * 8);
    const finished = document.getElementById('clear').classList.contains('on');
    const state = [w, h, visible, finished, score.textContent, distance.textContent, flags.textContent, level].join('|');
    if (state === previous) return;
    previous = state;
    if (surface.width !== w || surface.height !== h) { surface.width = w; surface.height = h; }
    ctx.clearRect(0, 0, w, h);
    if (visible) {
      const span = Math.min(w - 28, 360), left = (w - span) / 2, top = Math.max(14, Math.round(h * .065));
      const columns = [left + span / 6, w / 2, left + span * 5 / 6];
      const label = theme === 'circus' ? '#d84060' : '#ffed55';
      [['1P', score.textContent], ['HI', String(Math.max(20000, Number(score.textContent))).padStart(6, '0')], ['STAGE', String(stageNumber).padStart(2, '0')]].forEach(([name, value], i) => {
        text(name, columns[i], top, label);
        text(value, columns[i], top + 11, '#fff');
      });
      if (theme === 'antarctic' && !finished) {   // 도착하면 올라간 깃발을 가리지 않게 거둔다
        text('REST ' + distance.textContent + 'KM', columns[0] + 8, top + 27, '#fff');
        text('FLAGS ' + flags.textContent + '/3', w < 300 ? columns[2] - 8 : columns[1], top + 27, '#fff');
        if (w >= 300) {
          text('SPEED', columns[2], top + 27, '#fff');
          for (let i = 0; i < 8; i++) {
            ctx.fillStyle = i < level ? '#ffed55' : '#0038ad';
            ctx.fillRect(Math.round(columns[2] - 15 + i * 4), top + 37, 2, 3);
          }
        }
      }
    }
    texture.needsUpdate = true;
  };
}

// ---------- 크롬 공룡 HUD: 오른쪽 위 점수만 ----------
export function dinoHUD(post){
  const surface=document.createElement('canvas'),ctx=surface.getContext('2d'),texture=new THREE.CanvasTexture(surface);
  texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;post.uniforms.hudMap={value:texture};
  const glyphs={
    '0':[14,17,17,17,17,17,14],'1':[4,12,4,4,4,4,14],'2':[14,17,1,2,4,8,31],
    '3':[30,1,1,14,1,1,30],'4':[2,6,10,18,31,2,2],'5':[31,16,16,30,1,1,30],
    '6':[14,16,16,30,17,17,14],'7':[31,1,2,4,8,8,8],'8':[14,17,17,14,17,17,14],
    '9':[14,17,17,15,1,1,14],'H':[17,17,17,31,17,17,17],'I':[14,4,4,4,4,4,14],' ':[0,0,0,0,0,0,0]
  };
  function text(str,right,y,color){
    const left=Math.round(right-(str.length*6-1));ctx.fillStyle=color;
    [...str].forEach((ch,i)=>(glyphs[ch]||glyphs[' ']).forEach((row,gy)=>{
      for(let x=0;x<5;x++)if(row&(1<<(4-x)))ctx.fillRect(left+i*6+x,y+gy,1,1);
    }));
  }
  let previous='';
  return()=>{
    const {x:w,y:h}=post.uniforms.res.value,score=String(Number(document.getElementById('score').textContent)).padStart(5,'0');
    const visible=started&&!document.body.classList.contains('waiting')&&!document.body.classList.contains('portal-mode');
    const state=[w,h,score,visible].join('|');if(state===previous)return;previous=state;
    if(surface.width!==w||surface.height!==h){surface.width=w;surface.height=h;}ctx.clearRect(0,0,w,h);
    if(visible){const right=w-Math.max(14,Math.round(w*.065)),top=Math.max(14,Math.round(h*.065));text(score,right,top,'#535353');text(`HI ${String(Math.max(20000,Number(score))).padStart(5,'0')}`,right-score.length*6-12,top,'#777777');}
    texture.needsUpdate=true;
  };
}

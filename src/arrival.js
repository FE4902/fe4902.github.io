import { audio } from './audio/index.js';
import * as THREE from 'three';
import { theme } from './flow.js';
import { PROFILE, ICON_INK, ICONS } from './content.js';
import { CHARLIE, LION_A, PENTA_BACK, PENTA_WALK, DINO_ROWS } from './sprites.js';

// ---------- 도착한 이세계: 저해상도 디지털 공간 (격자 바닥 · 떠오르는 데이터 조각 · 흩어진 복셀 아이템) ----------
export function arrivalSpace({ renderer, reduced }) {
  audio.arrive();
  const dark = new THREE.Color(0x06070a);   // 통로가 끝나는 어둠과 같은 색
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(58, 1, .1, 120);
  scene.background = dark; scene.fog = new THREE.Fog(dark, 12, 75);
  const fading = [];
  const mat = m => { m.transparent = true; m.toneMapped = false; fading.push([m, m.opacity]); return m; };
  // 격자 바닥: 카메라 뒤로 넘어가는 선은 일부 GPU 에서 사라지므로 카메라 앞(z 8)에서 끊는다
  const lines = [], gridColors = [], gridInk = new THREE.Color(0x337b9c);
  const gridPoint = (x, z) => {
    lines.push(x, 0, z);
    const fade = 1 - THREE.MathUtils.smoothstep(-z, 4, 32);
    gridColors.push(gridInk.r * fade, gridInk.g * fade, gridInk.b * fade);
  };
  // 먼 선은 짧게 나누어 어둠으로 지운다. 수평선의 촘촘한 띠를 없앤다.
  for (let x = -48; x <= 48; x += 3) {
    for (let z = -34; z < 8; z += 2) { gridPoint(x, z); gridPoint(x, z + 2); }
  }
  for (let z = -34; z <= 8; z += 3) { gridPoint(-48, z); gridPoint(48, z); }
  const gridGeo = new THREE.BufferGeometry(); gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  gridGeo.setAttribute('color', new THREE.Float32BufferAttribute(gridColors, 3));
  scene.add(new THREE.LineSegments(gridGeo, mat(new THREE.LineBasicMaterial({ vertexColors: true, opacity: .72 }))));
  // 떠 있는 와이어 상자
  const edgeMat = mat(new THREE.LineBasicMaterial({ color: 0x6fd3ff, opacity: .6 }));
  const cubes = [[30, 2.6, -26, 4], [38, 14, -50, 6], [12, 17, -58, 3], [-34, 2, -58, 5], [16, 2, -14, 1.4]].map(([x, y, z, s], i) => {
    const cube = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(s, s, s)), edgeMat);
    cube.position.set(x, y, z); cube.rotation.set(i * .7, i * 1.1, 0); scene.add(cube); return cube;
  });
  // 바닥에서 천천히 떠오르는 데이터 조각 (앰비언트라 움직임 줄이기에서도 흐름)
  const BITS = 240, bits = new THREE.InstancedMesh(new THREE.BoxGeometry(.2, .2, .2), mat(new THREE.MeshBasicMaterial()), BITS);
  const palette = [0x6fd3ff, 0x6fd3ff, 0x2f9dff, 0xe6f6ff, 0x3fe0b0].map(c => new THREE.Color(c));
  const seeds = Array.from({ length: BITS }, (_, i) => {
    bits.setColorAt(i, palette[i % palette.length]);
    return { x: (Math.random() - .5) * 80, y: Math.random() * 20, z: -Math.random() * 74, v: .25 + Math.random() * .6 };
  });
  scene.add(bits);
  const m4 = new THREE.Matrix4(), corner = new THREE.Vector3();
  const hitMatrix = new THREE.Matrix4(), hitPos = new THREE.Vector3(), hitQuat = new THREE.Quaternion(), hitEuler = new THREE.Euler(), hitScale = new THREE.Vector3();
  // 떠 있는 아이템 4개: 도트 아이콘을 복셀로 세우고(빛·후광으로 입체감), 겹쳐 둔 HTML 버튼과 위치를 맞춘다
  scene.add(new THREE.AmbientLight(0xbfd8ff, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8); sun.position.set(-4, 7, 9); scene.add(sun);
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, '#fff'); r.addColorStop(1, '#fff0'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const glow = opacity => mat(new THREE.SpriteMaterial({ map: glowTex, color: 0x6fd3ff, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  const VOX = .2, orbs = [...document.querySelectorAll('.orb')];
  const items = PROFILE.menu.map((entry, i) => {
    const cells = [];
    ICONS[entry.icon].forEach((row, y) => [...row].forEach((ch, x) => { if (ICON_INK[ch]) cells.push([x, y, ch]); }));
    const vox = new THREE.InstancedMesh(new THREE.BoxGeometry(VOX, VOX, VOX * 2), mat(new THREE.MeshLambertMaterial()), cells.length);
    cells.forEach(([x, y, ch], k) => { vox.setMatrixAt(k, m4.makeTranslation((x - 5.5) * VOX, (5.5 - y) * VOX, 0)); vox.setColorAt(k, new THREE.Color(ICON_INK[ch])); });
    const aura = new THREE.Sprite(glow(entry.open ? .25 : .16)); aura.scale.setScalar(4.4); aura.position.z = -.6;
    const inner = new THREE.Group(); inner.add(aura, vox); scene.add(inner);
    const bounds = new THREE.Box3();
    cells.forEach(([x, y]) => {
      const cx = (x - 5.5) * VOX, cy = (5.5 - y) * VOX;
      bounds.expandByPoint(new THREE.Vector3(cx - VOX / 2, cy - VOX / 2, -VOX));
      bounds.expandByPoint(new THREE.Vector3(cx + VOX / 2, cy + VOX / 2, VOX));
    });
    return { inner, bounds, label: [0, 0, 0, 0], covered: false, base: new THREE.Vector3(), tilt: [ -.12, .10, .14, -.16 ][i], turn: [ -.28, .24, -.36, .20 ][i], fit: 1, hover: 0, hoverOn: false, hopAt: -1, sentAt: -1 };
  });
  // 화면 안의 비대칭 지점을 서로 다른 깊이로 펼쳐 놓는다.
  const layout = () => {
    const wide = camera.aspect >= 1.35;
    const places = wide
      ? [[.29, .30, 15, 1.12], [.57, .49, 11.5, 1.16], [.77, .20, 20, 1.05], [.23, .60, 17.5, .9]]
      : [[.27, .28, 11.8, .76], [.67, .49, 10.5, .78], [.74, .13, 16, .61], [.29, .66, 14, .6]];
    camera.position.set(0, 3, 10); camera.lookAt(0, 4.5, -30); camera.updateMatrixWorld();
    items.forEach((it, i) => {
      const [x, y, depth, fit] = places[i], halfH = depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      it.fit = fit;
      it.base.set((x * 2 - 1) * halfH * camera.aspect, (1 - y * 2) * halfH, -depth).applyMatrix4(camera.matrixWorld);
    });
  };
  orbs.forEach((el, i) => {
    const it = items[i], entry = PROFILE.menu[i];
    el.addEventListener('pointerenter', () => { it.hoverOn = true; });
    el.addEventListener('pointerleave', () => { it.hoverOn = false; });
    el.addEventListener('focus', () => { it.hoverOn = el.matches(':focus-visible'); });
    el.addEventListener('blur', () => { it.hoverOn = false; });
    // 클릭 반응(움직임 줄이기와 무관): 창 아이템은 통 튀고 창이 뜸, 연락 아이템은 위로 날아가며(보내짐) 링크가 열림
    el.addEventListener('click', e => {
      if (entry.open) { it.hopAt = performance.now(); document.getElementById(entry.open).showModal(); audio.sfx('open', 'arrival'); return; }
      if (entry.href === '#') e.preventDefault();   // 임시 링크
      if (it.sentAt < 0) { it.sentAt = performance.now(); el.classList.add('away'); audio.sfx('send', 'arrival'); }
    });
  });
  // 가끔 뒤쪽 바닥을 가로지르는 세 무대의 캐릭터. 말·반짝이 없이 누르면 점프만 한다.
  // 어둠에 묻히지 않게 하늘색 1px 외곽선을 두른다 (공룡은 밤 모드처럼 밝게)
  const WALK_INK = { K: '#000000', W: '#ffffff', P: '#d84060', C: '#60d0e0', S: '#ffc8b8', O: '#e05000', Y: '#e8d020', N: '#c07000', '#': '#e8e8e8' };
  const WALKERS = {
    circus: { frames: [[[LION_A, 0, 21], [CHARLIE, 4, 1]]], px: .12, jump: 2.4, pace: 1.1 },   // pace: 걷는 빠르기 (펭귄은 느리게, 공룡은 빠르게)
    antarctic: { frames: [[[PENTA_WALK[0], 0, 0]], [[PENTA_WALK[1], 0, 0]]], air: [[PENTA_BACK, 0, 0]], px: .1, jump: 1.4, pace: .75 },   // 점프는 원작 점프 자세
    dino: { frames: [[[DINO_ROWS.run0, 0, 0]], [[DINO_ROWS.run1, 0, 0]]], air: [[DINO_ROWS.idle, 0, 0]], px: .06, jump: 2.6, pace: 1.35 },
  };
  const walkerTex = (layers, flip) => {
    const cells = [];
    layers.forEach(([rows, ox, oy]) => rows.forEach((row, y) => [...row].forEach((ch, x) => { if (WALK_INK[ch]) cells.push([ox + x + 1, oy + y + 1, WALK_INK[ch]]); })));
    const w = Math.max(...cells.map(([x]) => x)) + 2, h = Math.max(...cells.map(([, y]) => y)) + 2;
    const c = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = c.getContext('2d');
    const at = x => flip ? w - 1 - x : x;
    g.fillStyle = '#6fd3ff'; cells.forEach(([x, y]) => g.fillRect(at(x) - 1, y - 1, 3, 3));
    cells.forEach(([x, y, ink]) => { g.fillStyle = ink; g.fillRect(at(x), y, 1, 1); });
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  Object.values(WALKERS).forEach(k => {
    k.tex = [false, true].map(flip => k.frames.map(f => walkerTex(f, flip)));
    k.airTex = k.air && [false, true].map(flip => walkerTex(k.air, flip));
  });
  const walkSprite = new THREE.Sprite(new THREE.SpriteMaterial({ alphaTest: .5, toneMapped: false, fog: false }));
  walkSprite.center.set(.5, 0); walkSprite.visible = false; scene.add(walkSprite);
  // 방금 깬 무대의 캐릭터부터 차례로, 첫 등장은 도착 2.5초 뒤
  const walkOrder = [theme, ...Object.keys(WALKERS).filter(k => k !== theme)];
  const walker = { kind: null, n: 0, dir: 1, x: 0, z: -18, farZ: -18, y: 0, close: false, end: 0, speed: 0, jumpAt: -1, nextAt: performance.now() + 2500 };
  const walkPoint = new THREE.Vector3();
  const spawnWalker = () => {
    const k = WALKERS[walker.kind = walkOrder[walker.n++ % walkOrder.length]];
    // 매번 다른 깊이·방향. 이상해 보이지 않게: 늘 화면 밖에서 들어와 밖으로 나가고, 발은 바닥(y 0),
    // 깊이는 메뉴 뒤(z −13 ~ −30)에서 직전과 5 이상 떨어진 곳, 진행은 화면과 나란히
    // 가끔(첫 등장 제외, 연속 없이 1/4) 바닥이 아니라 카메라 코앞(z 4.5~6)을 둥실 떠서 빠르게 스쳐 간다
    walker.close = walker.n > 1 && !walker.close && Math.random() < .25;
    const w = k.tex[0][0].image.width * k.px, h = k.tex[0][0].image.height * k.px;
    let z;
    if (walker.close) z = 4.5 + Math.random() * 1.5;
    else {   // z −30 ~ −13 에서 직전 깊이 ±5 구간을 빼고 한 번에 고른다
      const gapLo = Math.max(-30, walker.farZ - 5), gapHi = Math.min(-13, walker.farZ + 5);
      z = -30 + Math.random() * (17 - (gapHi - gapLo));
      if (z >= gapLo) z += gapHi - gapLo;
      walker.farZ = z;
    }
    walker.z = z;
    walker.y = walker.close ? 3 - h / 2 + (Math.random() - .5) * 1.2 : 0;   // 코앞은 눈높이, 아니면 바닥
    walker.dir = Math.random() < .5 ? 1 : -1;
    const halfW = (10 - z) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    walker.end = halfW + w;
    walker.x = -walker.dir * walker.end;
    walker.speed = 2 * walker.end / (walker.close ? Math.min(5, Math.max(3, 2 * walker.end / (3 * k.pace)))
                                                  : Math.min(16, Math.max(6, 2 * walker.end / (3.2 * k.pace))));
    walker.jumpAt = -1;
    walkSprite.scale.set(w, h, 1);
    walkSprite.visible = true;
  };
  // 화면 좌표로 캐릭터 상자를 구해 클릭·커서를 판정 (투명한 큰 판을 두지 않는다)
  const walkerRect = () => {
    walkPoint.copy(walkSprite.position).project(camera);
    const cx = (walkPoint.x + 1) / 2 * innerWidth, bottom = (1 - walkPoint.y) / 2 * innerHeight;
    walkPoint.set(walkSprite.position.x + walkSprite.scale.x / 2, walkSprite.position.y + walkSprite.scale.y, walkSprite.position.z).project(camera);
    return { cx, bottom, hw: Math.abs((walkPoint.x + 1) / 2 * innerWidth - cx), top: (1 - walkPoint.y) / 2 * innerHeight };
  };
  const walkerHit = e => {
    if (!walker.kind) return false;
    const r = walkerRect();
    return Math.abs(e.clientX - r.cx) <= r.hw + 10 && e.clientY >= r.top - 10 && e.clientY <= r.bottom + 10;
  };
  // 화면의 한 점이 캐릭터 도트의 불투명 픽셀 위인지 (텍스처마다 알파를 한 번만 읽어 둔다)
  const walkAlpha = new Map();
  const walkerOpaque = (r, x, y) => {
    const u = (x - (r.cx - r.hw)) / (2 * r.hw), v = (y - r.top) / (r.bottom - r.top);
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
    const img = walkSprite.material.map.image;
    if (!walkAlpha.has(img)) walkAlpha.set(img, img.getContext('2d').getImageData(0, 0, img.width, img.height).data);
    return walkAlpha.get(img)[(Math.floor(v * img.height) * img.width + Math.floor(u * img.width)) * 4 + 3] > 0;
  };
  const endingEl = document.getElementById('ending');
  endingEl.addEventListener('pointermove', e => { endingEl.style.cursor = !e.target.closest('.orb') && walkerHit(e) ? 'pointer' : ''; });
  endingEl.addEventListener('click', e => {
    if (e.target.closest('.orb') || !walkerHit(e)) return;
    if (walker.jumpAt < 0) { walker.jumpAt = performance.now(); audio.sfx('jump', walker.kind); }   // 클릭 반응: 움직임 줄이기와 무관
  });
  // 라벨 크기는 글꼴·화면 폭이 바뀔 때만 잰다 (매 프레임 읽으면 브라우저가 레이아웃을 다시 계산함)
  const labelSize = [];
  const measureLabels = () => orbs.forEach((el, i) => { labelSize[i] = [el.firstElementChild.offsetWidth, el.firstElementChild.offsetHeight]; });
  const resize = () => {
    const px = innerWidth < 600 ? 2 : 3;
    renderer.setSize(Math.round(innerWidth / px), Math.round(innerHeight / px), false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); layout(); measureLabels();
  };
  addEventListener('resize', resize); resize();
  document.fonts?.ready.then(measureLabels);
  const born = performance.now();
  let last = born;
  const drift = () => {
    const now = performance.now(), t = (now - born) / 1000, dt = Math.min(.1, (now - last) / 1000), calm = reduced();
    last = now;
    const appear = calm ? 1 : Math.min(1, t / 1.2);
    fading.forEach(([m, o]) => { m.opacity = o * appear; });
    seeds.forEach((s, i) => {
      s.y += s.v * dt; if (s.y > 20) s.y -= 20;
      bits.setMatrixAt(i, m4.makeTranslation(s.x, s.y, s.z));
    });
    bits.instanceMatrix.needsUpdate = true;
    // 큰 움직임(카메라 흔들림·상자 회전)은 움직임 줄이기에서 멈춘다
    const sway = calm ? 0 : t;
    camera.position.set(Math.sin(sway * .12) * .8, 3 + Math.sin(sway * .2) * .3, 10);
    camera.lookAt(0, 4.5, -30);
    cubes.forEach((c, i) => { c.rotation.y = i * 1.1 + sway * .15; c.rotation.x = i * .7 + sway * .08; });
    camera.updateMatrixWorld();
    items.forEach((it, i) => {
      it.hover += ((it.hoverOn ? 1 : 0) - it.hover) * Math.min(1, dt * 10);
      const bob = calm ? 0 : Math.sin(t * (.7 + i * .16) + i * 1.7) * .22;
      const driftX = calm ? 0 : Math.sin(t * .38 + i * 2.1) * .12;
      const tilt = it.tilt + (calm ? 0 : Math.sin(t * .55 + i) * .045);
      let y = it.base.y + bob, spin = it.turn + (calm ? 0 : Math.sin(t * .65 + i * 2) * .18) + (calm ? 0 : it.hover * Math.sin(t * 5) * .18);
      let size = it.fit * (1 + it.hover * .08), sx = 1, sy = 1;
      if (it.hopAt >= 0) {
        const s = (now - it.hopAt) / 1000;
        if (s > .4) it.hopAt = -1; else y += Math.sin(s / .4 * Math.PI) * .7;
      }
      if (it.sentAt >= 0) {
        const s = (now - it.sentAt) / 1000;
        if (s < .15) { sx = 1 + s / .15 * .15; sy = 1 - s / .15 * .25; }   // 꾹 눌렸다가
        else if (s < .8) { const k = (s - .15) / .65; y += k * k * 16; spin += k * 8; sx = 1 - k * .3; sy = 1 + k * .4; }   // 위로 날아감
        else if (s < 1.3) size = 0;
        else if (s < 1.6) size *= (s - 1.3) / .3;   // 제자리에 다시 생김
        else { it.sentAt = -1; orbs[i].classList.remove('away'); }
      }
      it.inner.position.set(it.base.x + driftX, y, it.base.z); it.inner.rotation.set(0, spin, tilt); it.inner.scale.set(size * sx, size * sy, size);
      // 복셀의 실제 외곽에 버튼을 맞추고 라벨은 아래 10px에 붙인다.
      // 연락처가 날아가는 동안에는 원래 자리의 버튼을 유지한다.
      hitMatrix.compose(
        hitPos.set(it.base.x + driftX, it.base.y + bob, it.base.z),
        hitQuat.setFromEuler(hitEuler.set(0, it.sentAt >= 0 ? it.turn : spin, tilt)),
        hitScale.setScalar(it.fit * (1 + it.hover * .08)));
      const { min, max } = it.bounds;
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      for (let k = 0; k < 8; k++) {   // 외곽 상자의 꼭짓점 8개
        corner.set(k & 1 ? max.x : min.x, k & 2 ? max.y : min.y, k & 4 ? max.z : min.z).applyMatrix4(hitMatrix).project(camera);
        const px = (corner.x + 1) * innerWidth / 2, py = (1 - corner.y) * innerHeight / 2;
        left = Math.min(left, px); right = Math.max(right, px); top = Math.min(top, py); bottom = Math.max(bottom, py);
      }
      const [labelW, labelH] = labelSize[i];
      const w = Math.max(64, right - left + 16, labelW + 8), h = bottom - top + 10 + labelH + 8;
      Object.assign(orbs[i].style, { width: `${w}px`, height: `${h}px`, transform: `translate(${(left + right - w) / 2}px, ${top - 8}px)` });
      it.label = [(left + right - labelW) / 2, top - 8 + h - labelH, labelW, labelH];   // 이름표의 화면 상자
    });
    // 지나가는 캐릭터: 걷기(움직임 줄이기에서는 들썩임·뒤뚱 없이 미끄러짐), 누르면 점프
    if (!walker.kind && now >= walker.nextAt) spawnWalker();
    if (walker.kind) {
      const k = WALKERS[walker.kind], side = walker.dir > 0 ? 0 : 1;
      walker.x += walker.dir * walker.speed * dt;
      // 걸을 때는 발걸음 들썩임, 코앞을 떠 갈 때는 느린 둥실
      let lift = calm ? 0 : walker.close ? Math.sin(t * 2.2) * .25 : Math.abs(Math.sin(t * 7)) * .12, map = k.tex[side][Math.floor(t * 8) % k.tex[side].length];
      if (walker.jumpAt >= 0) {
        const s = (now - walker.jumpAt) / 700;
        if (s >= 1) walker.jumpAt = -1; else { lift = Math.sin(s * Math.PI) * k.jump; if (k.airTex) map = k.airTex[side]; }
      }
      walkSprite.material.map = map;
      walkSprite.material.rotation = calm || walker.jumpAt >= 0 ? 0 : walker.close ? Math.sin(t * 1.6) * .1 : walker.kind === 'antarctic' ? Math.sin(t * 9) * .12 : 0;
      walkSprite.position.set(walker.x, walker.y + lift, walker.z);
      if (walker.dir * walker.x > walker.end) {
        walker.kind = null; walkSprite.visible = false; endingEl.style.cursor = '';
        walker.nextAt = now + 7000 + Math.random() * 6000;
      }
    }
    // 코앞을 지나는 캐릭터가 이름표의 가운데·네 모서리 중 하나라도 덮으면 그 메뉴를 잠시 숨긴다
    const cover = walker.kind && walker.close ? walkerRect() : null;
    items.forEach((it, i) => {
      const [lx, ly, lw, lh] = it.label;
      const covered = !!cover && [[.5, .5], [0, 0], [1, 0], [0, 1], [1, 1]].some(([a, b]) => walkerOpaque(cover, lx + lw * a, ly + lh * b));
      if (covered !== it.covered) { it.covered = covered; orbs[i].classList.toggle('covered', covered); }
    });
    renderer.setRenderTarget(null); renderer.render(scene, camera);
  };
  drift();   // 첫 프레임 전에 메뉴 버튼 자리를 잡는다 (안 그러면 한 프레임 동안 왼쪽 위에 겹침)
  renderer.setAnimationLoop(drift);
  return drift;
}

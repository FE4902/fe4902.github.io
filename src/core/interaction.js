import * as THREE from 'three';

// ---------- 클릭은 캐릭터만: 픽셀 커서 + CRT 굴곡을 따르는 레이캐스트, 투명한 도트는 통과 ----------
// playing(): 달리는 중인지 (타이틀·READY 동안은 클릭 없음), reduced(): 움직임 줄이기
// surfaces 를 주면(공룡) 그 판을 모두 맞혀 보고, 클릭 대상이 아닌 소품의 불투명 도트는 뒤 캐릭터를 가린다
export function createInteraction({ renderer, scene, camera, PAL, playing, reduced, surfaces }) {
  const clickables = [];
  const clickable = (obj, onClick) => {
    obj.userData.onClick = onClick;
    const img = obj.material.map.image;
    obj.userData.interaction = { scale: obj.scale.clone(), hover: 0, cue: 0, near: false,
      alpha: img.getContext('2d').getImageData(0, 0, img.width, img.height) };
    clickables.push(obj);
    return obj;
  };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pointer = { x: 0, y: 0, inside: false, type: 'mouse', downX: 0, downY: 0, dragged: false };
  const cursorEl = document.createElement('div');
  cursorEl.className = 'pixel-cursor';
  cursorEl.setAttribute('aria-hidden', 'true');
  const cursorRows = {
    arrow: ['K...............','KK..............','KWK.............','KWWK............','KWWWK...........',
      'KWWWWK..........','KWWWWWK.........','KWWWWWWK........','KWWWWWWWK.......','KWWWWKKKKK......',
      'KWWKWK..........','KWK.KWK.........','KK..KWK.........','K....KWK........','.....KK.........','................'],
    hand: ['.....KK.........','....KYYK........','....KYYK........','....KYYK........','....KYYKKKK.....',
      '....KYYKYYKKK...','.KK.KYYYYYKYYK..','KYYKKYYYYYYYYK..','KYYYKYYYYYYYYK..','.KYYYYYYYYYYYK..',
      '.KYYYYYYYYYYYK..','..KYYYYYYYYYK...','...KYYYYYYYYK...','...KYYYYYYYK....','....KKKKKKK.....','................'],
  };
  cursorEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">${Object.entries(cursorRows).map(([name, rows]) =>
    `<g data-shape="${name}">${rows.map((row, y) => [...row].map((ch, x) => PAL[ch]
      ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${PAL[ch]}"/>` : '').join('')).join('')}</g>`).join('')}</svg>`;
  document.body.append(cursorEl);
  function updateCursor(hit) {
    const show = playing() && pointer.inside && pointer.type !== 'touch' && !document.body.classList.contains('portal-mode');
    cursorEl.style.visibility = show ? 'visible' : 'hidden';
    renderer.domElement.style.cursor = show ? 'none' : '';
    cursorEl.dataset.hit = String(!!hit);
    // 화살표 꼭짓점·검지 끝을 실제 클릭 좌표에 맞춤
    cursorEl.style.transform = `translate(${Math.round(pointer.x) - (hit ? 15 : 0)}px, ${Math.round(pointer.y)}px)`;
  }
  const hitOffsets = Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)]);
  const hitWorld = new THREE.Vector3(), cueScreen = new THREE.Vector3();
  const blockedHit = { blocked: true };
  function pick(e) {
    if (!playing() || document.body.classList.contains('portal-mode')) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const test = (x, y) => {
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return;
      ndc.set((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2);
      ndc.multiplyScalar(1 + ndc.lengthSq() * .04);   // 화면에 보이는 CRT 굴곡과 같은 좌표
      if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1) return;
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(surfaces || clickables, false).find(h => {
        for (let parent = h.object; parent; parent = parent.parent) if (!parent.visible) return false;
        if (h.distance > 36) return false;
        const map = h.object.material.map;
        // 공룡: 움직이는 날개·다리의 현재 프레임을 기준으로 투명 픽셀을 통과시킨다.
        const a = surfaces ? map.userData.alpha || (map.userData.alpha = map.image.getContext('2d').getImageData(0, 0, map.image.width, map.image.height))
          : h.object.userData.interaction.alpha;
        const ix = Math.min(a.width - 1, Math.max(0, Math.floor(h.uv.x * a.width)));
        const iy = Math.min(a.height - 1, Math.max(0, Math.floor((1 - (h.uv.y * map.repeat.y + map.offset.y)) * a.height)));
        return a.data[(iy * a.width + ix) * 4 + 3] >= 128;   // 투명한 모서리는 제외
      });
      if (!surfaces) return hit;
      // 소품의 불투명 도트는 뒤 캐릭터를 가리되 클릭 반응은 주지 않는다.
      return hit ? (hit.object.userData.onClick && hit.object.userData.clickEnabled !== false ? hit : blockedHit) : undefined;
    };
    const direct = test(e.clientX, e.clientY);
    if (direct === blockedHit) return;
    if (direct) return direct;
    const padding = (e.pointerType || pointer.type) === 'touch' ? 18 : 10;
    for (const radius of [.5, 1]) for (const [ox, oy] of hitOffsets) {
      const hit = test(e.clientX + ox * padding * radius, e.clientY + oy * padding * radius);
      if (hit && hit !== blockedHit) return hit;
    }
  }
  renderer.domElement.addEventListener('pointerdown', e => {
    Object.assign(pointer, { downX: e.clientX, downY: e.clientY, type: e.pointerType, dragged: false });
  });
  renderer.domElement.addEventListener('pointermove', e => {
    Object.assign(pointer, { x: e.clientX, y: e.clientY, type: e.pointerType, inside: true });
    if (e.buttons && Math.hypot(e.clientX - pointer.downX, e.clientY - pointer.downY) > 8) pointer.dragged = true;
    updateCursor(e.pointerType === 'touch' ? null : pick(e));   // 관성 없이 입력 위치에 즉시 표시
  });
  renderer.domElement.addEventListener('pointerleave', () => { pointer.inside = false; updateCursor(null); });
  renderer.domElement.addEventListener('pointercancel', () => { pointer.inside = false; pointer.dragged = true; updateCursor(null); });
  addEventListener('blur', () => { pointer.inside = false; updateCursor(null); });
  renderer.domElement.addEventListener('click', e => {
    if (pointer.dragged) return;
    scene.updateMatrixWorld(true);
    const hit = pick(e);
    hit?.object.userData.onClick(hit);
  });
  // 커서가 멈춰 있어도 스크롤·카메라 위치를 따라 판정하고, 화면에 막 들어온 캐릭터는 한 번 들썩여 알린다
  function updateInteraction(dt) {
    scene.updateMatrixWorld(true);
    const hit = pointer.inside && pointer.type !== 'touch' ? pick({ clientX: pointer.x, clientY: pointer.y }) : null;
    updateCursor(hit);
    const ending = document.body.classList.contains('portal-mode'), reduce = reduced();
    clickables.forEach(obj => {
      const state = obj.userData.interaction;
      const active = hit?.object === obj ? 1 : 0;
      state.hover = reduce ? active : state.hover + (active - state.hover) * (1 - Math.exp(-dt * 14));
      obj.getWorldPosition(hitWorld);
      cueScreen.copy(hitWorld).project(camera);
      const near = !ending && obj.userData.clickEnabled !== false && obj.visible && camera.position.distanceTo(hitWorld) < 26 && cueScreen.z > -1 && cueScreen.z < 1
        && Math.abs(cueScreen.x) < 1 && Math.abs(cueScreen.y) < 1;
      state.cue = reduce ? 0 : Math.max(0, state.cue - dt / .85);
      if (near && !state.near && !reduce) state.cue = 1;
      state.near = near;
    });
  }
  return { clickables, clickable, pick, updateInteraction };
}

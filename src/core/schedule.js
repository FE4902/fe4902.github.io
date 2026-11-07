// ---------- 긴 초기화를 조각으로: 정해진 시간이 지나면 브라우저에 양보 (타이틀·입력이 먼저) ----------
const yieldNow = () => globalThis.scheduler?.yield ? globalThis.scheduler.yield()
  : new Promise(resolve => { const ch = new MessageChannel(); ch.port1.onmessage = () => resolve(); ch.port2.postMessage(0); });
// step(): 마지막 양보 뒤 budget(ms)가 지났을 때만 양보한다. 느린 기기(CPU 4배)에서도 한 조각이 50ms 를 넘지 않게
export function slicer(budget = 8) {
  let last = performance.now();
  return async () => {
    if (performance.now() - last < budget) return;
    await yieldNow();
    last = performance.now();
  };
}

// 첫 프레임 전에 텍스처를 올리고 셰이더를 미리 컴파일한다 (조각마다 양보, 컴파일 완료는 비동기로 기다림)
// 장면은 composer 버퍼에 그려지므로 그 렌더 타깃을 걸어 둔 채 컴파일해야 첫 프레임에 다시 컴파일하지 않는다.
export async function prewarm({ renderer, composer, camera, scenes, step }) {
  const textures = new Set(), addTex = v => v?.isTexture && textures.add(v);
  const collect = m => {
    Object.values(m).forEach(addTex);
    Object.values(m.uniforms || {}).forEach(u => addTex(u.value));
  };
  scenes.forEach(scene => scene.traverse(o => [].concat(o.material || []).forEach(collect)));
  for (const t of textures) { renderer.initTexture(t); await step(); }
  const pending = [];
  const compile = (obj, scene, target) => {
    renderer.setRenderTarget(target);
    pending.push(renderer.compileAsync(obj, camera, scene));
    renderer.setRenderTarget(null);
  };
  for (const scene of scenes) for (const obj of [...scene.children]) { compile(obj, scene, composer.readBuffer); await step(); }
  await Promise.all(pending.splice(0));
  // 첫 프레임에 몰리는 형태 업로드·그리기 준비를 몇 묶음씩 나눠 미리 한다 (보이지 않는 버퍼에 그림, 끝나면 보이기 상태 복구)
  for (const scene of scenes) {
    const kids = [...scene.children], shown = kids.map(o => o.visible);
    for (let i = 0; i < kids.length; i += 40) {
      kids.forEach((o, k) => o.visible = shown[k] && (o.isLight || k >= i && k < i + 40));   // 조명 수가 바뀌면 셰이더를 다시 컴파일하므로 조명은 그대로
      renderer.setRenderTarget(composer.readBuffer);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      await step();
    }
    kids.forEach((o, k) => o.visible = shown[k]);
  }
  // 후처리: composer 를 한 번 '그리는 척'만 한다. 패스가 실제로 거는 렌더 타깃·define 그대로 컴파일되고 버퍼도 이때 만들어진다
  const render = renderer.render;
  renderer.render = (obj, cam) => { if (!scenes.includes(obj)) pending.push(renderer.compileAsync(obj, cam)); };
  try { composer.render(0); } finally { renderer.render = render; }
  await Promise.all(pending);
}

// 3D 데모는 준비되면 페이드인 (움직임 줄이기·검수 중이면 바로 표시). 그 전엔 CSS 바탕색만 보인다
export function reveal(canvas, instant) {
  canvas.classList.add(instant ? 'shown-now' : 'shown');
}

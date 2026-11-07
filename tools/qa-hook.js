// 검수 훅: 개발 서버(vite.config.js)만 index.html <head> 맨 앞에 넣는다. 배포 빌드에는 없다.
// 설정은 검수 도구가 CDP 로 먼저 넣은 window.__arcadeQAConfig.
//   seed    Math.random 고정 (같은 장면을 다시 찍어 비교)
//   motion  '움직임 줄이기'를 끈 상태로 강제 (JS reduce + CSS)
//   steps   테마 루프를 1/30초씩 직접 돌릴 프레임 수 (헤드리스는 초당 1~2프레임뿐)
//   js      steps 뒤 테마 함수 안에서 실행할 코드. LOOP·scr(월드좌표)·click(월드좌표)과 테마의 지역 변수를 쓸 수 있다
//   after   js 뒤 더 돌릴 프레임 수
// 진행률은 ?p= 값으로 고정되고, window.__qaProgress 를 넣으면 그 값을 따른다.
(() => {
  const config = window.__arcadeQAConfig;
  if (!config) return;
  if (config.seed != null) {
    let s = config.seed;
    Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  }
  if (config.motion) {
    // CSS 의 움직임 줄이기 규칙을 되돌린다 (:root 를 붙여 순서와 상관없이 이김)
    const style = document.createElement('style');
    style.textContent = ':root .blink{animation:blink 1s steps(1) infinite}:root .ending{transition:opacity .6s,visibility 0s .6s}'
      + ':root .system-window[open]{animation:system-appear .3s ease-out both}'
      + ':root .system-window[open] .system-line{animation:system-line .01s steps(1) both;animation-delay:calc(.34s + var(--i)*.22s)}';
    document.head.append(style);
  }
  const HELPERS = 'const scr = w => { const v = w.clone().project(camera); return { clientX: (v.x + 1) / 2 * innerWidth, clientY: (1 - v.y) / 2 * innerHeight }; };\n'
    + 'const click = w => { const h = pick(scr(w)); console.log("CLICK", h ? h.object.type : "none"); h?.object.userData.onClick(h); };\n';
  window.__arcadeQA = {
    motion: !!config.motion,
    progress: p0 => window.__qaProgress ?? p0,
    // 테마 루프 대신 불린다. run 은 테마 함수 안의 eval
    attach({ LOOP, run, renderer, composer }) {
      const { steps = 0, after = 0, js = '' } = config;
      if (!steps && !js) { renderer.setAnimationLoop(LOOP); return; }
      run('clock.getDelta = () => 1 / 30;');
      for (let k = 0; k < steps; k++) LOOP();
      run(HELPERS + js);
      for (let k = 0; k < after; k++) LOOP();
      // 이세계 전송이 이미 시작됐으면 그쪽 루프를 유지한다
      if (!document.body.classList.contains('portal-mode')) renderer.setAnimationLoop(() => composer.render());
    },
  };
})();

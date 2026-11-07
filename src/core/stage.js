import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// ---------- 렌더러: 저해상도로 그리고 CSS(pixelated)로 키운다 ----------
export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  document.body.prepend(renderer.domElement);
  return renderer;
}

// 최종 화면: CRT(굴곡·색수차·스캔라인·깜빡임) + 디더 전환 + 필름 그레인 + 색 단계 디더링 (서커스·남극)
export const crtPass = levels => new ShaderPass({
  uniforms: { tDiffuse: { value: null }, levels: { value: levels }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) },
              wipe: { value: 0 }, motion: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `
    uniform sampler2D tDiffuse, hudMap; uniform float levels, time, wipe, motion; uniform vec2 res; varying vec2 vUv;
    float b2(vec2 a) { a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }
    float b4(vec2 a) { return b2(.5 * a) * .25 + b2(a); }
    float rnd(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv * 2. - 1.;
      uv *= 1. + dot(uv, uv) * .04;                                        // CRT 굴곡
      uv = uv * .5 + .5;
      if (any(lessThan(uv, vec2(0.))) || any(greaterThan(uv, vec2(1.)))) { gl_FragColor = vec4(0., 0., 0., 1.); return; }
      uv = (floor(uv * res) + .5) / res;                                   // 화면 전체의 도트 크기 유지
      vec2 ca = (uv - .5) * .008;                                            // 가장자리 색수차
      vec3 c = vec3(texture2D(tDiffuse, uv + ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - ca).b);
      vec4 hud = texture2D(hudMap, uv);                                    // 작은 글자의 색 번짐은 줄이고 같은 CRT 좌표에 합성
      c = mix(c, hud.rgb, hud.a);
      c += (rnd(gl_FragCoord.xy + fract(time * 7.) * 100.) - .5) * .05 * (.3 + c);   // 필름 그레인 (어두운 곳은 덜 들뜨게)
      c *= 1. - .03 * motion * (.5 + .5 * sin(time * 50.));                  // 깜빡임
      c *= mod(gl_FragCoord.y, 2.) < 1. ? .85 : 1.;                          // 스캔라인
      if (b4(floor(gl_FragCoord.xy / 4.)) < wipe) c = vec3(0.);              // 디더 전환
      gl_FragColor = vec4(floor(c * levels + b4(gl_FragCoord.xy)) / levels, 1.);
    }`,
});

// 화면 크기에 맞춰 저해상도 버퍼·카메라를 맞춘다 (모바일은 도트 2px, 세로 화면은 시야를 넓힘)
export function fitStage({ renderer, composer, post, camera, pixel, portraitFov }) {
  const px = innerWidth < 600 ? 2 : pixel, w = Math.ceil(innerWidth / px), h = Math.ceil(innerHeight / px);
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  post.uniforms.res.value.set(w, h);
  camera.aspect = w / h;
  camera.fov = w < h ? portraitFov : 60;
  camera.updateProjectionMatrix();
}

import { audio } from '../audio/index.js';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { clamp, ease, hash, fbm } from '../core/math.js';
import { createRenderer, crtPass, fitStage } from '../core/stage.js';
import { canvas, pixTex, art, lit, dotKit } from '../core/textures.js';
import { createInteraction } from '../core/interaction.js';
import { slicer, prewarm, reveal } from '../core/schedule.js';
import { qa } from '../core/qa.js';
import { started, ready, initialProgress, activateStage } from '../flow.js';
import { gameHUD } from '../hud.js';
import { enterPortal } from '../portal.js';
import { CHARLIE, LION_A } from '../sprites.js';

// ---------- 서커스 찰리: 사자를 타고 불고리를 넘는 1인칭 트랙 ----------
export async function run() {
const step = slicer();                             // 장면 생성을 짧은 조각으로 나눠 사이마다 양보
const PIXEL = 3;                                   // 화면 도트 크기 (모바일은 2)
const LEVELS = 14;                                 // 채널당 색 단계 (낮출수록 거친 도트 그라데이션)
const START = 6, RINGS = [-20, -50, -80], POTS = [-35, -65, -95], GOAL = -110, STOP = GOAL + 4;   // 고리 하나 = 프로젝트 하나
const LEN = 240, MID = -90;                        // 무대 길이와 중심
const mq = matchMedia('(prefers-reduced-motion: reduce)');
let reduce = import.meta.env.DEV && qa?.motion ? false : mq.matches;
mq.addEventListener('change', e => reduce = e.matches);

// ---------- 원작 팔레트 + 스프라이트 ----------
const PAL = { K:'#000000', W:'#ffffff', P:'#d84060', C:'#60d0e0', S:'#ffc8b8', O:'#e05000', Y:'#e8d020', N:'#c07000', G:'#50a000', E:'#bcbcbc' };
const POT = ['NNNNNNNNNN', '.NYYYYYYN.', '.NNNNNNNN.'];
const BAG = ['....YY....', '...Y..Y...', '....NN....', '..NNNNNN..', '.NNYYYYNN.', 'NNNYNNNNNN', 'NNNNYYNNNN', 'NNNNNNYNNN', 'NNNYYYYNNN', '.NNNNNNNN.', '..NNNNNN..'];

document.querySelector('.title-penguin').style.backgroundImage = `url(${(() => { const el = document.createElement('canvas'); el.width = 26; el.height = 34; const ctx = el.getContext('2d'); [ [LION_A, 0, 21], [CHARLIE, 4, 1] ].forEach(([rows, ox, oy]) => rows.forEach((row,y) => [...row].forEach((ch,x) => { if (PAL[ch]) { ctx.fillStyle = PAL[ch]; ctx.fillRect(ox+x,oy+y,1,1); } }))); return el.toDataURL(); })()})`;

await step();
// ---------- 렌더러: 저해상도 + 색 단계 제한 + 베이어 디더링 ----------
const renderer = createRenderer();
const scene = new THREE.Scene();
scene.background = new THREE.Color('#000');
scene.fog = new THREE.Fog('#000', 45, 150);   // 원작처럼 멀리는 검은 어둠으로
const camera = new THREE.PerspectiveCamera(60, 1, .05, 400);
scene.add(camera);
const look = new THREE.Vector3();

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), .35, .15, 1.4));   // 밝기 1.4 넘는 불꽃 심지·불티만 살짝 번짐
composer.addPass(new OutputPass());
const post = crtPass(LEVELS);
composer.addPass(post);
const updateHUD = gameHUD(post);

await step();
const { sprite, box } = dotKit(scene, PAL);

// ---------- 클릭 상호작용 (캐릭터만, 대사 없이 키치한 움직임: 찰리 공중 두 바퀴, 원숭이 그네 한 바퀴) + 입자 풀 ----------
const fx = { bonus: 0 };
// 입자 풀: 도트 사각형 (지금은 상시 색종이에만 사용)
const MAXP = 800, pPos = new Float32Array(MAXP * 3).fill(-1e3), pCol = new Float32Array(MAXP * 3), pVel = new Float32Array(MAXP * 3);
const pLife = new Float32Array(MAXP), pGrav = new Float32Array(MAXP), pFlut = new Float32Array(MAXP);
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const parts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: .25, vertexColors: true }));
parts.frustumCulled = false;
scene.add(parts);
let pNext = 0;
function burst(p, n, { speed = 4, up = 2, grav = -9, life = 1.2, flutter = 0, spread = [0, 0, 0], colors = [PAL.Y, PAL.O, PAL.W] } = {}) {
  const col = new THREE.Color();
  for (let k = 0; k < n; k++) {
    const i = pNext, a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1), s = speed * (.4 + Math.random() * .6);
    pNext = (pNext + 1) % MAXP;
    pPos.set([p.x + (Math.random() - .5) * spread[0], p.y + (Math.random() - .5) * spread[1], p.z + (Math.random() - .5) * spread[2]], i * 3);
    pVel.set([Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s * .5 + up, Math.sin(b) * Math.sin(a) * s], i * 3);
    pLife[i] = life * (.6 + Math.random() * .4);
    pGrav[i] = grav;
    pFlut[i] = flutter;
    pCol.set(col.set(colors[k % colors.length]).toArray(), i * 3);
  }
  pGeo.attributes.color.needsUpdate = true;
}
const CONFETTI = [PAL.P, PAL.C, PAL.Y, PAL.W, PAL.G, PAL.O];
// 색종이 한 장: 카메라(z) 가까운 앞쪽, 관중석 위까지 넓게 (멀리 생기면 소실점인 화면 가운데로 몰림)
const confetti = (z, y, life) => burst({ x: (Math.random() - .5) * 20, y, z: z - 2 - Math.random() * 28 }, 1,
  { speed: .5, up: 0, grav: -3, life, flutter: 8, colors: [CONFETTI[Math.floor(Math.random() * CONFETTI.length)]] });
const { clickables, clickable, pick, updateInteraction } = createInteraction({ renderer, scene, camera, PAL, playing: () => started && ready.hidden, reduced: () => reduce });

await step();
// 8px 픽셀 폰트 글자 → 거리 표지판 (주황 테두리 + 검정 바탕 + 흰 글자)
await document.fonts.load('8px "Press Start 2P"').catch(() => {});
function signRows(str) {
  const c = canvas(str.length * 8 + 1, 9), x = c.getContext('2d');
  x.font = '8px "Press Start 2P"'; x.textBaseline = 'top'; x.fillStyle = '#fff'; x.fillText(str, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const t = Array.from({ length: c.height }, (_, y) => 'OK' + Array.from({ length: c.width }, (_, i) => d[(y * c.width + i) * 4 + 3] < 128 ? 'K' : 'W').join('') + 'KO');
  const edge = 'O'.repeat(t[0].length), pad = 'OK' + 'K'.repeat(t[0].length - 4) + 'KO';
  return [edge, pad, ...t, pad, edge];
}

await step();
// ---------- 원작 서커스 무대: 트랙 양옆과 끝에 관중석 ----------
scene.add(new THREE.AmbientLight('#ffffff', 1.1));
const swagTex = (len) => pixTex(16, 14, c => {
  c.fillStyle = PAL.W; c.fillRect(0, 0, 16, 14);
  for (let x = 0; x < 16; x++) {
    const u = x % 8, sag = Math.round(3 * Math.sin(Math.PI * (u + .5) / 8));
    c.fillStyle = PAL.C; c.fillRect(x, sag, 1, 1);
    if (u > 0) { c.fillStyle = u < 4 ? PAL.P : PAL.C; c.fillRect(x, sag + 1, 1, 12 - sag - Math.abs(4 - u)); }
  }
}, [len / 2, 1]);
const crowdTex = (len) => pixTex(16, 8, c => {
  c.fillStyle = PAL.O; c.fillRect(0, 0, 16, 8);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) {
    const cx = (x + (y >> 2 & 1) * 2) % 4, cy = y % 4;
    const col = cy === 0 && (cx === 1 || cx === 2) ? PAL.W : cy === 1 || (cy === 2 && cx > 0 && cx < 3) ? PAL.Y : cy === 3 && cx === 0 ? PAL.K : null;
    if (col) { c.fillStyle = col; c.fillRect(x, y, 1, 1); }
  }
}, [len / 2, 1]);
const railTex = (len) => pixTex(16, 5, c => {
  c.fillStyle = PAL.E;
  for (let x = 0; x < 16; x += 4) c.fillRect(x, 0, 2, 1);
  [PAL.E, PAL.W, PAL.O, PAL.W].forEach((col, i) => { c.fillStyle = col; c.fillRect(0, i + 1, 16, 1); });
}, [len / 2, 1]);
// 관중석 한 벌: inner = 트랙을 바라보는 면 번호, out = 트랙에서 멀어지는 방향
function stands(len, place) {
  const swag = lit(swagTex(len)), crowd = lit(crowdTex(len)), rail = lit(railTex(len));
  place(.4, 1.8, 0, .9, swag, '#888');
  for (let i = 0; i < 3; i++) place(1.1, .9, .75 + i * 1.1, 2.25 + i * .9, crowd, '#7a2a00');
  place(.3, .5, 3.5, 4.75, rail, '#bbb');
}
[[-1, 0], [1, 1]].forEach(([side, inner]) => stands(LEN, (depth, h, off, y, mat, top) => {
  const faces = ['#3a1500', '#3a1500', top, '#3a1500', '#3a1500', '#3a1500'];
  faces[inner] = mat;
  return box([depth, h, LEN], [side * (5 + off), y, MID], faces);
}));
stands(24, (depth, h, off, y, mat, top) => box([24, h, depth], [0, y, GOAL - 16 - off], ['#3a1500', '#3a1500', top, '#3a1500', mat, '#3a1500']));
await step();
// 초록 바닥 + 검은 레인 줄
const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, LEN), lit(pixTex(40, 4, c => {
  c.fillStyle = PAL.G; c.fillRect(0, 0, 40, 4);
  c.fillStyle = PAL.K; c.fillRect(10, 0, 1, 4); c.fillRect(30, 0, 1, 4);
}, [1, LEN / 2])));
floor.rotation.x = -Math.PI / 2;
floor.position.z = MID;
scene.add(floor);
// 결승 시상대
const stripe = lit(pixTex(8, 4, c => { for (let x = 0; x < 8; x++) { c.fillStyle = x % 4 < 2 ? PAL.P : PAL.W; c.fillRect(x, 0, 1, 4); } }, [3, 1]));
box([2.6, .9, 2.6], [0, .45, GOAL], [stripe, stripe, '#fff', '#888', stripe, stripe]);

await step();
// ---------- 불: 깜빡이는 조명 + 번짐 ----------
const haloTex = (() => {
  const c = canvas(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, '#fff'); g.addColorStop(1, '#0000');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const flickers = [];
function fireLight(x, y, z, power, size, mat) {
  const light = new THREE.PointLight('#ff8a36', power, 14, 2);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: '#ff7a20', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.set(size, size, 1);
  light.position.set(x, y, z);
  glow.position.set(x, y, z);
  scene.add(light, glow);
  flickers.push({ light, glow, power, mat, z });
}
// 불꽃 셰이더: 위로 계속 일렁이고(원작 색 주황·노랑·흰), flare 가 오르면 화르륵 치솟음
const fireU = { time: { value: 0 } };
const NOISE = `
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float v = 0., a = .5; for (int i = 0; i < 4; i++) { v += a * n(p); p *= 2.03; a *= .5; } return v; }
  vec3 ramp(float i) { return i > .78 ? vec3(1.6) : i > .52 ? vec3(.807, .631, .014) : vec3(.745, .08, 0.); }   // 흰 심지만 블룸 문턱을 넘음
`;
const fireMat = frag => new THREE.ShaderMaterial({
  uniforms: { time: fireU.time, flare: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform float time, flare; varying vec2 vUv; ${NOISE} void main() { ${frag} }`,
  side: THREE.DoubleSide,
});
// 고리: 타원 띠 바깥으로 불꽃, 위쪽일수록 높이 솟음
const RING_FRAG = `
  vec2 p = (vUv - .5) * vec2(6., 7.);
  float s = (length(p / vec2(1.5, 2.)) - 1.) * 1.8;
  float nz = fbm(p * 1.8 - vec2(0., time * 3.));
  float th = .25 + .5 * nz * (1. + flare * 1.5) + .25 * max(0., p.y / 2.);
  float i = (1. - smoothstep(0., th, s)) * smoothstep(-.3, -.08, s) * (.55 + .9 * nz) * (1. + flare * .25);
  if (abs(s) < .05 && i < .52) { gl_FragColor = vec4(.04, .02, .01, 1.); return; }
  if (i < .3) discard;
  gl_FragColor = vec4(ramp(i), 1.);`;
// 항아리 불: 위로 갈수록 좁아지는 불길
const POT_FRAG = `
  vec2 q = vUv;
  float nz = fbm(vec2(q.x * 4., q.y * 3. - time * 4.));
  float w = max(.42 - q.y * .32, .01);
  float i = (1. - abs(q.x - .5 + (nz - .5) * .25 * q.y) / w) * (1. - q.y * .9) * (.7 + .7 * nz) * (1. + flare);
  if (i < .3) discard;
  gl_FragColor = vec4(ramp(i), 1.);`;
// 불고리 + 매달린 보너스 돈주머니 = 프로젝트
const bags = RINGS.map(z => {
  const mat = fireMat(RING_FRAG), hoop = new THREE.Mesh(new THREE.PlaneGeometry(6, 7), mat);
  hoop.position.set(0, 3.1, z);
  scene.add(hoop);
  fireLight(0, 3.1, z + .5, 12, 8, mat);
  return sprite(BAG, .07, [0, 3.7, z]);
});
POTS.forEach(z => {
  const mat = fireMat(POT_FRAG), flame = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.4).translate(0, .7, 0), mat);
  flame.position.set(0, .25, z);
  scene.add(flame);
  fireLight(0, .8, z + .4, 6, 3, mat);
  sprite(POT, .1, [0, 0, z]);
});
await step();
// 불티: 고리 둘레와 항아리에서 피어올라 흩어짐 (도트 크기 점)
const ember = { pos: [], seed: [], kind: [] };
[[RINGS, 3.1, 80, 1], [POTS, .6, 24, 0]].forEach(([zs, y, count, kind]) => zs.forEach(z => {
  for (let i = 0; i < count; i++) { ember.pos.push(0, y, z); ember.seed.push(Math.random()); ember.kind.push(kind); }
}));
const emberGeo = new THREE.BufferGeometry();
emberGeo.setAttribute('position', new THREE.Float32BufferAttribute(ember.pos, 3));
emberGeo.setAttribute('seed', new THREE.Float32BufferAttribute(ember.seed, 1));
emberGeo.setAttribute('kind', new THREE.Float32BufferAttribute(ember.kind, 1));
const embers = new THREE.Points(emberGeo, new THREE.ShaderMaterial({
  uniforms: { time: fireU.time },
  vertexShader: `uniform float time; attribute float seed, kind; varying float vLife;
    void main() {
      float life = fract(time * (.25 + seed * .35) + seed * 7.), a = seed * 6.2832;
      vec3 off = kind > .5 ? vec3(cos(a) * 1.5, sin(a) * 2., 0.) : vec3((fract(seed * 13.) - .5) * .5, .4, 0.);
      vec3 p = position + off + vec3(sin(time * 2. + seed * 40.) * .3 * life, life * (1. + fract(seed * 7.) * 2.), (fract(seed * 3.) - .5) * .4);
      vLife = life;
      gl_PointSize = 2. - life;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
    }`,
  fragmentShader: 'varying float vLife; void main() { gl_FragColor = vec4(mix(vec3(1., .63, .02), vec3(.75, .08, 0.), vLife) * (1. - vLife) * 2., 1.); }',
  blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
}));
embers.frustumCulled = false;
scene.add(embers);
await step();
// 천장 그네 (원작 2스테이지): 빈 그네(오른쪽) → 빈 그네(왼쪽) → 원숭이 그네(오른쪽, 왼쪽 레인 찰리의 반대편)
// 원숭이를 클릭하면 그네째 한 바퀴 휙
const MONKEY = ['.NN......NN.', '..N......N..', '..N......N..', '...N....N...', '...NNNNNN...', '..NNSSSSNN..', '..NSKSSKSN..', '..NSSSSSSN..',
                '...NSPPSN...', '....NNNN....', '...NNNNNN...', '...NNSSNN...', '...NNNNNN.N.', '...N....N..N', '..NN....NN.N', '..........N.'];
const ropeMat = new THREE.LineBasicMaterial({ color: PAL.E }), barMat = new THREE.MeshLambertMaterial({ color: PAL.E });
const swings = [[-8, 2.2, false], [-38, -2.2, false], [-68, 2.2, true]].map(([z, x, withMonkey], i) => {
  const pivot = new THREE.Group(), bar = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 1.1).rotateZ(Math.PI / 2), barMat);
  pivot.position.set(x, 11, z);   // 천장 고정점
  [-.5, .5].forEach(x => pivot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, -4, 0)]), ropeMat)));
  bar.position.y = -4;
  pivot.add(bar);
  scene.add(pivot);
  const s = { pivot, loop: 0, phase: i * 1.7 };
  if (withMonkey) {
    const monkey = sprite(MONKEY, .13, [0, -4, 0]);
    monkey.center.set(.5, 1);   // 두 손으로 막대에 매달림
    pivot.add(monkey);
    s.monkey = monkey;   // 검수용 접근: swings[2].monkey
    clickable(monkey, () => {
      s.loop = 1; audio.sfx('spin', 'circus');
      fx.bonus += 1000;
    });
  }
  return s;
});
await step();
[40, 30, 20, 10].forEach(m => sprite(signRows(`${m}M`), .045, [3.4, 0, GOAL + m * 2.5]));
// 옆 레인의 찰리 (트랙 첫 번째 자리): 클릭하면 사자 등에서 높이 뛰어 공중 두 바퀴, 착지하면 사자가 찌그러졌다 펴짐
const sideLion = sprite(LION_A, .12, [-3.2, 0, -12]), sideCharlie = sprite(CHARLIE, .1, [-3.2, 2.25, -12]);
sideCharlie.center.set(.5, .5);   // 몸 가운데를 축으로 회전
const side = { jump: 0, squash: 0, landed: true, cw: sideCharlie.scale.x, ch: sideCharlie.scale.y, lw: sideLion.scale.x, lh: sideLion.scale.y };
clickable(sideCharlie, () => {
  Object.assign(side, { jump: 1, landed: false });
  audio.sfx('jump', 'circus');
  fx.bonus += 1000;
});

await step();
// ---------- 화면 앞: 원작 사자 갈기만 ----------
const fg = new THREE.Group();
camera.add(fg);
// transparent: 스프라이트보다 나중에 그려져야 항아리·표지판이 갈기 위로 비치지 않음
const fgMat = map => new THREE.MeshBasicMaterial({ map, alphaTest: .5, transparent: true, depthTest: false, depthWrite: false, fog: false });
const mane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fgMat(art('mane', 160, 100, (c) => {
  const cx = 80, cy = 112;
  c.lineCap = 'round';
  // 주황 갈기만 (귀·정수리 없이): 밑에 털 덩어리를 깔고 그 위로 털 가닥
  c.fillStyle = '#a83a00'; c.beginPath(); c.ellipse(80, 104, 46, 30, 0, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 1400; i++) {
    const a = Math.PI + hash(i * 1.7) * Math.PI, r0 = 18 + hash(i * 3.3) * 30, r1 = r0 + 14 + fbm(a * 3, i * .01) * 34;
    c.strokeStyle = r1 > 66 && hash(i * 5.7) < .4 ? '#f08a30' : hash(i * 9.1) < .55 ? PAL.O : '#a83a00';
    c.lineWidth = 1 + hash(i * 4.4) * 2;
    c.beginPath();
    c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * .9);
    c.lineTo(cx + Math.cos(a + (hash(i) - .5) * .3) * r1, cy + Math.sin(a) * r1 * .9);
    c.stroke();
  }
})));
await step();
mane.renderOrder = 10;
fg.add(mane);
const lay = {};   // 화면 비율별 기본 위치 (하차 연출의 기준)
function layoutForeground() {
  const hh = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), hw = hh * camera.aspect;
  const mw = Math.min(hw * 1.3, hh * 2), mh = mw * 100 / 160;
  Object.assign(lay, { mh, maneY: -hh + mh * .42 });
  mane.scale.set(mw, mh, 1);
}

function resize() {
  fitStage({ renderer, composer, post, camera, pixel: PIXEL, portraitFov: 75 });
  layoutForeground();
}
addEventListener('resize', resize);
resize();

await step();
// ---------- 엔딩: GAME CLEAR 1.5초 뒤 공통 이세계 전송 ----------
const clearEl = document.getElementById('clear'), clearScore = document.getElementById('clearScore');
let portalTimer;
const toPortal = () => enterPortal({ renderer, composer, post, reduced: () => reduce });

// ---------- 루프: 스크롤 = 달리기 ----------
const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') return;
  ptr.tx = e.clientX / innerWidth - .5; ptr.ty = e.clientY / innerHeight - .5;
});
const ride = document.querySelector('.ride'), scoreEl = document.getElementById('score');
const clock = new THREE.Timer();
let t = 0, sp = 0, shown = null, speed = 0, prevZ = START, bobAmp = 0, fgY = 0, fgV = 0, wipeT = 1, confettiAcc = 0;
const lookS = new THREE.Vector3(0, 2.4, START - 20);   // 부드럽게 따라가는 시선
// ?p=0.5 → 해당 진행률 위치로 바로 이동 (공유 링크·확인용)
const p0 = Number.isFinite(initialProgress) ? clamp(initialProgress) : 0;
if (started) { if (!(import.meta.env.DEV && qa)) scrollTo(0, p0 * (ride.offsetHeight - innerHeight)); sp = p0; }
// 들어오자마자 이미 흩날리고 있도록 공중 곳곳에 색종이를 미리 뿌려 둠
const trackZ = p => START + (STOP - START) * clamp((p - .05) / .85);
const podiumHop = p => ease(clamp((p - .9) / .06));
const z0 = trackZ(sp);
for (let i = 0; i < 220; i++) confetti(z0, Math.random() * 9, 1.5 + Math.random() * 4.5);
await prewarm({ renderer, composer, camera, scenes: [scene], step });   // 텍스처·셰이더를 첫 프레임 전에 나눠서

const rideSfx = audio.ride('circus', [...RINGS.map(z => z + 6), ...POTS.map(z => z + 3)], RINGS, [...RINGS.map(z => ['fire', z + 1]), ['land', GOAL]]);
activateStage();
const LOOP = () => {
  clock.update();
  const dt = Math.min(clock.getDelta(), .1);
  t += dt;   // 불꽃·불티 같은 작은 움직임은 항상, 큰 움직임(들썩임·흔들림·깜빡임·전환)은 각각 reduce 를 따름
  const target = (import.meta.env.DEV ? qa?.progress(p0) : undefined) ?? clamp(scrollY / Math.max(1, ride.offsetHeight - innerHeight));
  sp += ((started && ready.hidden ? target : 0) - sp) * (reduce ? 1 : 1 - Math.exp(-dt * 3));   // 스크롤을 관성 있게 따라감

  // 달리기: 고리·불항아리 앞에서 점프, 결승 앞에서 멈춘 뒤 시상대로 뛰어오름 (hop)
  let z = trackZ(sp), jump = 0;
  if (!started) z = START - (reduce ? 0 : (t * .8) % 12);
  fg.visible = started && ready.hidden;
  RINGS.forEach(r => { const d = z - r; if (Math.abs(d) < 6) jump = Math.max(jump, Math.cos(d / 6 * Math.PI / 2)); });
  POTS.forEach(q => { const d = z - q; if (Math.abs(d) < 3) jump = Math.max(jump, .5 * Math.cos(d / 3 * Math.PI / 2)); });
  const hop = podiumHop(sp);
  z += (GOAL - STOP) * hop;
  const cleared = started && sp > .95;
  // 한 프레임에 클리어와 착지가 겹치면 먼저 음악을 전환해 착지음을 보존한다.
  if (cleared && !shown) audio.scene('clear');
  if (started && ready.hidden) rideSfx(z, trackZ(target) + (GOAL - STOP) * podiumHop(target));
  // 달리는 속도만큼 들썩이고, 멈추면 서서히 잦아듦
  speed += (Math.abs(z - prevZ) / Math.max(dt, 1e-3) - speed) * (1 - Math.exp(-dt * 6));
  prevZ = z;
  bobAmp += ((reduce ? 0 : clamp(speed / 5)) * (1 - hop) - bobAmp) * (1 - Math.exp(-dt * 5));
  const gait = z * 1.1, bob = (1 - Math.cos(gait * 2)) * .06 * bobAmp * (1 - jump);
  camera.position.set(0, 2.3 + bob + jump + .5 * hop + Math.sin(hop * Math.PI) * 1.2, z);
  look.set(ptr.x * 3, 2.4 + jump * .3 - ptr.y * 2, z - 20);
  lookS.lerp(look, 1 - Math.exp(-dt * 8));
  camera.lookAt(lookS);
  camera.rotateZ(Math.sin(gait * .5) * .012 * bobAmp * (1 - jump));
  // 갈기는 스프링으로 한 박자 늦게 출렁임
  const fgT = -bob * .3 - jump * .04 + (reduce ? 0 : Math.sin(t * 1.6) * .004);
  fgV += ((fgT - fgY) * 160 - fgV * 16) * dt;
  fgY += fgV * dt;
  fg.position.y = fgY;
  // 결승에서 내리면 사자 갈기가 화면 아래로 빠짐
  mane.position.set(0, lay.maneY - hop * lay.mh, -1);

  fireU.time.value = t;
  flickers.forEach((fl, n) => {
    const flare = Math.exp(-((z - fl.z - 1) ** 2) / 20);   // 다가가 통과할 때 화르륵
    fl.mat.uniforms.flare.value = flare;
    const k = (reduce ? 1 : 1 + Math.sin(t * 13 + n * 2) * .2 + Math.sin(t * 7.3 + n) * .12) * (1 + flare * 1.5);
    fl.light.intensity = fl.power * k;
    fl.glow.material.opacity = .45 * k * clamp((camera.position.distanceTo(fl.glow.position) - 2) / 6);   // 코앞에선 번짐이 화면을 덮지 않게
  });
  ptr.x += (ptr.tx - ptr.x) * Math.min(1, dt * 3);
  ptr.y += (ptr.ty - ptr.y) * Math.min(1, dt * 3);
  updateInteraction(dt);   // 커서가 멈춰 있어도 스크롤·카메라 위치를 따라 판정
  // 그네: 평소엔 좌우로 흔들림, 원숭이를 클릭하면 그네째 앞뒤로 한 바퀴
  swings.forEach(s => {
    s.loop = Math.max(0, s.loop - dt * .9);
    const mi = s.monkey?.userData.interaction;
    const mc = mi?.cue > 0 ? Math.sin((1 - mi.cue) * Math.PI) : 0;
    s.pivot.rotation.z = reduce ? 0 : Math.sin(t * 1.6 + s.phase) * .3;
    s.pivot.rotation.x = s.loop > 0 ? -ease(1 - s.loop) * Math.PI * 2
      : reduce ? 0 : mc * .1 + (mi?.hover || 0) * .05;   // 안내·호버도 그네째 앞뒤로
    if (mi) s.monkey.scale.copy(mi.scale).multiplyScalar(1 + mi.hover * .05 + (s.loop ? 0 : mc * .02));
  });
  side.jump = Math.max(0, side.jump - dt * .9);
  const ci = sideCharlie.userData.interaction;
  const cc = ci.cue > 0 && !side.jump ? Math.sin((1 - ci.cue) * Math.PI) : 0;
  sideCharlie.position.y = 2.25 + Math.sin((1 - side.jump) * Math.PI) * 3 * (side.jump > 0);
  sideCharlie.material.rotation = side.jump > 0 ? ease(1 - side.jump) * Math.PI * 4
    : reduce ? 0 : cc * .12 + ci.hover * .06;
  if (!side.jump && !side.landed) Object.assign(side, { landed: true, squash: 1 });
  side.squash = Math.max(0, side.squash - dt * 2.5);
  const sq = Math.sin(side.squash * Math.PI) * .3;
  sideLion.scale.set(side.lw * (1 + sq), side.lh * (1 - sq), 1);
  const charScale = 1 + ci.hover * .05 + cc * .02;
  sideCharlie.scale.set(side.cw * (1 + sq * .5) * charScale, side.ch * (1 - sq * .5) * charScale, 1);
  // 색종이: 앞쪽 무대 위에서 상시로 천천히 흩날림 (초당 50장)
  confettiAcc += dt * 50;
  for (; confettiAcc >= 1; confettiAcc--) confetti(camera.position.z, 9, 6);
  // 입자: 중력 + 색종이 팔랑임
  for (let i = 0; i < MAXP; i++) {
    if (pLife[i] <= 0) continue;
    const j = i * 3;
    pLife[i] -= dt;
    pVel[j] += Math.sin(t * 9 + i) * pFlut[i] * dt;
    pVel[j + 1] = Math.max(pVel[j + 1] + pGrav[i] * dt, pFlut[i] ? -2.5 : -40);
    pPos[j] += pVel[j] * dt;
    pPos[j + 1] = pLife[i] > 0 ? pPos[j + 1] + pVel[j + 1] * dt : -1e3;
    pPos[j + 2] += pVel[j + 2] * dt;
  }
  pGeo.attributes.position.needsUpdate = true;

  // 돈주머니 획득 + 결승 도착(시상대에 오르면) GAME CLEAR, 뜰 때 디더 전환
  bags.forEach((b, i) => b.visible = z > RINGS[i]);
  const got = RINGS.filter(r => z <= r).length;
  scoreEl.textContent = String(Math.floor((START - z) * 10) * 10 + got * 5000 + fx.bonus).padStart(6, '0');
  if (cleared !== shown) {
    clearEl.classList.toggle('on', cleared); clearEl.setAttribute('aria-hidden', String(!cleared));
    clearScore.textContent = scoreEl.textContent;
    clearTimeout(portalTimer);   // 1.5초 안에 위로 돌아가면 전송 취소
    if (cleared) { wipeT = 0; portalTimer = setTimeout(toPortal, 1500); }   // GAME CLEAR 1.5초 뒤 이세계 전송
    shown = cleared;
  }
  if (shown) clearScore.textContent = scoreEl.textContent;   // 시상대에 오르는 동안의 점수까지 맞춘다
  // 화면 효과: 도트 크기는 일정하게, GAME CLEAR 때만 0.5초 디더 전환
  const u = post.uniforms;
  wipeT += dt;
  u.time.value = t;
  u.wipe.value = reduce || wipeT >= .5 ? 0 : Math.sin(Math.PI * wipeT / .5) * .7;   // 끝나면 정확히 0 (아주 작은 값이 남으면 검은 점이 남음)
  u.motion.value = reduce ? 0 : 1;
  updateHUD();
  composer.render();
};
// 검수 훅이 있으면 프레임을 직접 돌린다 (eval 은 이 함수 안의 변수를 쓰기 위함, 개발 서버 전용)
if (import.meta.env.DEV && qa) qa.attach({ LOOP, run: code => eval(code), renderer, composer }); else renderer.setAnimationLoop(LOOP);
reveal(renderer.domElement, reduce || (import.meta.env.DEV && !!qa));
}
